import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ApiError, type OwnerBarberConfig } from "../../lib/api.ts"
import {
  buildOwnerBarberUpdatePayload,
  createInitialOwnerBarberForm,
  formatCommissionPercent,
  getSyncedStaffIdUpdate,
  mapOwnerBarberError,
  parseCommissionPercentToBps,
  reconcileOwnerBarberFormAfterRefresh,
} from "../../lib/ownerBarber.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, "../../..")

test("createInitialOwnerBarberForm handles unlinked and linked states while preserving 0 commission", () => {
  const unlinked: OwnerBarberConfig = {
    linked: false,
    enabled: false,
    staff_id: null,
    staff: null,
  }
  assert.deepEqual(createInitialOwnerBarberForm(unlinked, "Budi", "08123"), {
    name: "Budi",
    commissionPercent: "0",
    contact: "08123",
    linkStaffId: "",
  })

  const enabledZeroCommission: OwnerBarberConfig = {
    linked: true,
    enabled: true,
    staff_id: 42,
    staff: {
      id: 42,
      shop_id: 1,
      name: "Budi (Owner)",
      active: true,
      commission_bps: 0,
      contact: "",
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  }
  assert.deepEqual(createInitialOwnerBarberForm(enabledZeroCommission, "Budi", "08123"), {
    name: "Budi (Owner)",
    commissionPercent: "0",
    contact: "",
    linkStaffId: "",
  })

  assert.equal(formatCommissionPercent(3500), "35")
  assert.equal(formatCommissionPercent(1250), "12.5")
  assert.equal(formatCommissionPercent(0), "0")
})

test("parseCommissionPercentToBps validates 0-100% bounds and preserves 0", () => {
  assert.deepEqual(parseCommissionPercentToBps("0", "en"), { bps: 0, error: null })
  assert.deepEqual(parseCommissionPercentToBps("", "id"), { bps: 0, error: null })
  assert.deepEqual(parseCommissionPercentToBps("40", "en"), { bps: 4000, error: null })
  assert.deepEqual(parseCommissionPercentToBps("12.5", "en"), { bps: 1250, error: null })

  const neg = parseCommissionPercentToBps("-1", "en")
  assert.equal(neg.bps, null)
  assert.ok(neg.error && neg.error.includes("0%"))

  const over = parseCommissionPercentToBps("101", "id")
  assert.equal(over.bps, null)
  assert.ok(over.error && over.error.includes("100%"))
})

test("buildOwnerBarberUpdatePayload builds enable, link, edit, and disable payloads", () => {
  const enableRes = buildOwnerBarberUpdatePayload(
    true,
    { name: "Budi Owner", commissionPercent: "0", contact: "0812", linkStaffId: "" },
    false,
    "en",
  )
  assert.deepEqual(enableRes, {
    payload: {
      enabled: true,
      name: "Budi Owner",
      commission_bps: 0,
      contact: "0812",
    },
    error: null,
  })

  const linkRes = buildOwnerBarberUpdatePayload(
    true,
    { name: "Existing Barber", commissionPercent: "30", contact: "", linkStaffId: "15" },
    false,
    "en",
  )
  assert.deepEqual(linkRes, {
    payload: {
      enabled: true,
      link_staff_id: 15,
      name: "Existing Barber",
      commission_bps: 3000,
    },
    error: null,
  })

  const disableRes = buildOwnerBarberUpdatePayload(
    false,
    { name: "Budi Owner", commissionPercent: "0", contact: "", linkStaffId: "" },
    true,
    "id",
  )
  assert.deepEqual(disableRes, {
    payload: { enabled: false },
    error: null,
  })

  const missingName = buildOwnerBarberUpdatePayload(
    true,
    { name: "   ", commissionPercent: "20", contact: "", linkStaffId: "" },
    false,
    "en",
  )
  assert.equal(missingName.payload, null)
  assert.ok(missingName.error && missingName.error.includes("required"))
})

test("mapOwnerBarberError maps 401, 403, shop_suspended, 404, 409 conflicts, 400, and network errors", () => {
  const unauth = mapOwnerBarberError(new ApiError(401, "unauthenticated", "unauth"), "en")
  assert.equal(unauth.requiresRelogin, true)

  const suspended = mapOwnerBarberError(new ApiError(403, "shop_suspended", "suspended"), "id")
  assert.equal(suspended.shouldRefresh, true)
  assert.ok(suspended.message.includes("ditangguhkan"))

  const forbidden = mapOwnerBarberError(new ApiError(403, "forbidden", "forbidden"), "en")
  assert.equal(forbidden.requiresRelogin, false)
  assert.ok(forbidden.message.includes("owner"))

  const notFound = mapOwnerBarberError(new ApiError(404, "staff_not_found", "missing"), "en")
  assert.equal(notFound.shouldRefresh, true)

  const alreadyLinked = mapOwnerBarberError(
    new ApiError(409, "staff_already_linked", "linked"),
    "en",
  )
  assert.equal(alreadyLinked.shouldRefresh, true)
  assert.ok(alreadyLinked.message.includes("already linked"))

  const busy = mapOwnerBarberError(new ApiError(409, "scheduling_busy", "busy"), "id")
  assert.equal(busy.shouldRefresh, true)
  assert.ok(busy.message.includes("janji temu"))

  const badReq = mapOwnerBarberError(new ApiError(400, "invalid_request", "Invalid commission"), "en")
  assert.equal(badReq.message, "Invalid commission")

  const netErr = mapOwnerBarberError(new TypeError("Failed to fetch"), "en")
  assert.equal(netErr.code, "network_error")
  assert.ok(netErr.message.includes("Network error"))

  // Regression: apiFetch wraps fetch failures as ApiError(0, "network_error", ...)
  const apiFetchNetErrEn = mapOwnerBarberError(
    new ApiError(0, "network_error", "Failed to reach server: Failed to fetch"),
    "en",
  )
  assert.equal(apiFetchNetErrEn.code, "network_error")
  assert.ok(apiFetchNetErrEn.message.includes("Network error"))

  const apiFetchNetErrId = mapOwnerBarberError(
    new ApiError(0, "network_error", "Failed to reach server: Failed to fetch"),
    "id",
  )
  assert.equal(apiFetchNetErrId.code, "network_error")
  assert.ok(apiFetchNetErrId.message.includes("Gagal terhubung ke server"))
})

test("reconcileOwnerBarberFormAfterRefresh preserves draft after 409/404 errors and resets on success", () => {
  const unsavedDraft = {
    name: "Budi Custom Draft",
    commissionPercent: "25",
    contact: "0899999",
    linkStaffId: "12",
  }

  const serverConfigAfterError: OwnerBarberConfig = {
    linked: false,
    enabled: false,
    staff_id: null,
    staff: null,
  }

  // Error-triggered background refreshes for 409 staff_already_linked, 409 scheduling_busy, 404 staff_not_found
  for (const err of [
    new ApiError(409, "staff_already_linked", "already linked"),
    new ApiError(409, "scheduling_busy", "busy"),
    new ApiError(404, "staff_not_found", "not found"),
  ]) {
    const mapped = mapOwnerBarberError(err, "en")
    assert.equal(mapped.shouldRefresh, true)
    const nextForm = reconcileOwnerBarberFormAfterRefresh(
      unsavedDraft,
      serverConfigAfterError,
      true,
      "Budi",
      "08123",
    )
    assert.deepEqual(nextForm, unsavedDraft)
  }

  // Initial load or post-success refresh initializes from authoritative server response
  const authoritativeConfig: OwnerBarberConfig = {
    linked: true,
    enabled: true,
    staff_id: 77,
    staff: {
      id: 77,
      shop_id: 1,
      name: "Budi Authoritative",
      active: true,
      commission_bps: 3000,
      contact: "0811111",
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  }
  const resetForm = reconcileOwnerBarberFormAfterRefresh(
    unsavedDraft,
    authoritativeConfig,
    false,
    "Budi",
    "08123",
  )
  assert.deepEqual(resetForm, {
    name: "Budi Authoritative",
    commissionPercent: "30",
    contact: "0811111",
    linkStaffId: "",
  })
})

test("getSyncedStaffIdUpdate extracts staff_id cleanly", () => {
  assert.deepEqual(
    getSyncedStaffIdUpdate({
      linked: true,
      enabled: true,
      staff_id: 99,
      staff: null,
    }),
    { staff_id: 99 },
  )
  assert.deepEqual(
    getSyncedStaffIdUpdate({
      linked: false,
      enabled: false,
      staff_id: null,
      staff: null,
    }),
    { staff_id: undefined },
  )
})

test("API client, OwnerBarberSection, and SettingsContent wire Owner-as-Barber cleanly", () => {
  const apiSource = fs.readFileSync(path.join(frontendRoot, "src/lib/api.ts"), "utf8")
  assert.match(apiSource, /getOwnerBarber\(\):\s*Promise<OwnerBarberConfig>/)
  assert.match(apiSource, /updateOwnerBarber\(data:\s*UpdateOwnerBarberRequest\):\s*Promise<OwnerBarberConfig>/)
  assert.match(apiSource, /"\/api\/shop\/owner-barber"/)

  const sectionSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/OwnerBarberSection.tsx"),
    "utf8",
  )
  assert.match(sectionSource, /shopApi\.getOwnerBarber\(\)/)
  assert.match(sectionSource, /shopApi\.updateOwnerBarber\(/)
  assert.match(sectionSource, /isDisableConfirmOpen/)
  assert.match(sectionSource, /if \(isSubmitting\) return/)
  assert.match(sectionSource, /loadConfig\(\{\s*preserveDraft:\s*true\s*\}\)/)
  assert.match(sectionSource, /\},\s*\[refreshSession,\s*user\?\.name,\s*user\?\.phone\],?\s*\)/)
  const syncBlock = sectionSource.match(/const syncAfterUpdate[\s\S]*?\n  \)/)?.[0] ?? ""
  assert.ok(syncBlock.includes("updateCurrentShop(getSyncedStaffIdUpdate(updated))"))
  assert.ok(!syncBlock.includes("refreshSession("))

  const authContextSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/auth/AuthContext.tsx"),
    "utf8",
  )
  assert.match(authContextSource, /"staff_id" in updates/)

  const settingsContentSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/SettingsContent.tsx"),
    "utf8",
  )
  assert.match(settingsContentSource, /<OwnerBarberSection\s+staffList=\{staffList\}\s+onUpdated=\{loadStaff\}/)
})
