import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ApiError } from "../../lib/api.ts"
import {
  commissionPercentToBps,
  DEFAULT_LEGAL_VERSION,
  mapOnboardingApiError,
  ONBOARDING_TIMEZONES,
  validateOnboardingInput,
  type OnboardingFormInput,
} from "../../lib/onboarding.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, "../../..")

function makeValidInput(overrides: Partial<OnboardingFormInput> = {}): OnboardingFormInput {
  return {
    shopName: "Pangkas Rapi Jakarta",
    ownerName: "Budi Santoso",
    phone: "+6281234567890",
    timezone: ONBOARDING_TIMEZONES[0].value,
    cutsHair: false,
    commissionPercent: "40",
    termsAccepted: true,
    privacyAccepted: true,
    ...overrides,
  }
}

test("commissionPercentToBps converts percentages to basis points and rejects out-of-range inputs", () => {
  assert.equal(commissionPercentToBps(""), 0)
  assert.equal(commissionPercentToBps("0"), 0)
  assert.equal(commissionPercentToBps("40"), 4000)
  assert.equal(commissionPercentToBps("33.5"), 3350)
  assert.equal(commissionPercentToBps("100"), 10000)
  assert.equal(commissionPercentToBps("-1"), null)
  assert.equal(commissionPercentToBps("101"), null)
  assert.equal(commissionPercentToBps("abc"), null)
})

test("validateOnboardingInput validates required shop name, commission bounds, and legal consents", () => {
  assert.equal(validateOnboardingInput(makeValidInput(), "en"), null)
  assert.equal(validateOnboardingInput(makeValidInput(), "id"), null)

  const missingShopEn = validateOnboardingInput(makeValidInput({ shopName: "   " }), "en")
  assert.ok(missingShopEn && missingShopEn.includes("required"))

  const missingShopId = validateOnboardingInput(makeValidInput({ shopName: "" }), "id")
  assert.ok(missingShopId && missingShopId.includes("wajib"))

  const badCommission = validateOnboardingInput(
    makeValidInput({ cutsHair: true, commissionPercent: "120" }),
    "en"
  )
  assert.ok(badCommission && badCommission.includes("0%"))

  const validCommission = validateOnboardingInput(
    makeValidInput({ cutsHair: true, commissionPercent: "45" }),
    "en"
  )
  assert.equal(validCommission, null)

  const missingTerms = validateOnboardingInput(makeValidInput({ termsAccepted: false }), "en")
  assert.ok(missingTerms && missingTerms.includes("Terms"))

  const missingPrivacy = validateOnboardingInput(makeValidInput({ privacyAccepted: false }), "id")
  assert.ok(missingPrivacy && missingPrivacy.includes("Kebijakan Privasi"))
})

test("mapOnboardingApiError maps expired sessions, conflicts, validation errors, and network failures", () => {
  const expiredErr = new ApiError(401, "onboarding_session_required", "session expired")
  const mappedExpired = mapOnboardingApiError(expiredErr, "en")
  assert.equal(mappedExpired.expired, true)
  assert.ok(mappedExpired.message.includes("expired"))

  const conflictErr = new ApiError(409, "owner_conflict", "duplicate email")
  const mappedConflict = mapOnboardingApiError(conflictErr, "id")
  assert.equal(mappedConflict.expired, false)
  assert.ok(mappedConflict.message.includes("terdaftar"))

  const consentErr = new ApiError(400, "consent_required", "consent required")
  const mappedConsent = mapOnboardingApiError(consentErr, "en")
  assert.equal(mappedConsent.expired, false)
  assert.ok(mappedConsent.message.includes("Terms of Service"))

  const networkErr = new TypeError("Failed to fetch")
  const mappedNetworkEn = mapOnboardingApiError(networkErr, "en")
  assert.equal(mappedNetworkEn.expired, false)
  assert.ok(mappedNetworkEn.message.includes("Network error"))

  const mappedNetworkId = mapOnboardingApiError(networkErr, "id")
  assert.equal(mappedNetworkId.expired, false)
  assert.ok(mappedNetworkId.message.includes("Kesalahan jaringan"))
})

test("DEFAULT_LEGAL_VERSION and ONBOARDING_TIMEZONES provide expected defaults", () => {
  assert.equal(DEFAULT_LEGAL_VERSION, "2026-11-01")
  assert.deepEqual(
    ONBOARDING_TIMEZONES.map((z) => z.value),
    ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]
  )
})

test("api.ts exposes onboardingStatus, onboardingCancel (with empty JSON body), and onboardingComplete", () => {
  const apiSource = fs.readFileSync(path.join(frontendRoot, "src/lib/api.ts"), "utf8")
  assert.match(
    apiSource,
    /onboardingStatus\(\):\s*Promise<OnboardingStatusResponse>\s*\{\s*return apiFetch<OnboardingStatusResponse>\("\/api\/auth\/onboarding\/status"/
  )
  assert.match(
    apiSource,
    /onboardingCancel\(\):\s*Promise<\{\s*success:\s*boolean\s*\}>\s*\{\s*return apiFetch<\{\s*success:\s*boolean\s*\}>\("\/api\/auth\/onboarding\/cancel",\s*\{\s*method:\s*"POST",\s*body:\s*\{\s*\}/
  )
  assert.match(
    apiSource,
    /onboardingComplete\(payload:\s*OnboardingCompleteRequest\):\s*Promise<OnboardingCompleteResponse>\s*\{\s*return apiFetch<OnboardingCompleteResponse>\("\/api\/auth\/onboarding\/complete"/
  )
})

test("OnboardingPage.tsx and App.tsx wire status, conflict, cancel, retry, double-submit guard, and no browser storage", () => {
  const onboardingSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/auth/OnboardingPage.tsx"),
    "utf8"
  )
  const appSource = fs.readFileSync(path.join(frontendRoot, "src/App.tsx"), "utf8")

  assert.match(onboardingSource, /authApi\.onboardingStatus\(\)/)
  assert.match(onboardingSource, /authApi\.onboardingCancel\(\)/)
  assert.match(onboardingSource, /authApi\.onboardingComplete\(/)
  assert.match(onboardingSource, /await refreshSession\(\)/)
  assert.match(onboardingSource, /conflict === "active_session"/)
  assert.match(onboardingSource, /if \(isSubmitting \|\| isCancelling\) return/)
  assert.match(onboardingSource, /t\("common\.retry"\)/)
  assert.match(onboardingSource, /t\("onboarding\.trialBadge"\)/)
  assert.doesNotMatch(onboardingSource, /localStorage|sessionStorage/)

  assert.doesNotMatch(appSource, /OnboardingRoutePlaceholder/)
  assert.match(appSource, /<OnboardingPage/)
  assert.match(appSource, /handleOnboardingCompleted/)
})
