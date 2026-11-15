import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ApiError, authApi } from "../../lib/api.ts"
import {
  AUTH_SECURITY_CHANNEL,
  computeReauthExpiryMs,
  formatReauthRemaining,
  isReauthWindowActive,
  isUnauthenticatedSessionError,
  mapAccountSecurityError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  REAUTH_WINDOW_SECONDS,
  shouldFetchMethodsInBackground,
  shouldRefreshOnOAuthNotice,
  validateInitialPassword,
} from "../../lib/accountSecurity.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, "../../..")

test("validateInitialPassword enforces 8-128 char bounds and confirmation match in en and id", () => {
  assert.equal(validateInitialPassword("Str0ngPass!", "Str0ngPass!", "en"), null)
  assert.equal(validateInitialPassword("Str0ngPass!", "Str0ngPass!", "id"), null)

  const emptyEn = validateInitialPassword("", "", "en")
  assert.ok(emptyEn && emptyEn.includes("required"))

  const shortId = validateInitialPassword("short", "short", "id")
  assert.ok(shortId && shortId.includes(`${PASSWORD_MIN_LENGTH}`))

  const tooLong = "a".repeat(PASSWORD_MAX_LENGTH + 1)
  const longEn = validateInitialPassword(tooLong, tooLong, "en")
  assert.ok(longEn && longEn.includes(`${PASSWORD_MAX_LENGTH}`))

  const mismatchEn = validateInitialPassword("Str0ngPass!", "Different!", "en")
  assert.ok(mismatchEn && mismatchEn.includes("match"))

  const mismatchId = validateInitialPassword("Str0ngPass!", "Different!", "id")
  assert.ok(mismatchId && mismatchId.includes("cocok"))
})

test("reauthentication 10-minute window helpers track expiry accurately", () => {
  assert.equal(REAUTH_WINDOW_SECONDS, 600)
  const now = 1_700_000_000_000
  const expiry = computeReauthExpiryMs(600, now)
  assert.equal(expiry, now + 600_000)

  assert.equal(isReauthWindowActive(expiry, true, now + 1000), true)
  assert.equal(isReauthWindowActive(expiry, true, expiry), false)
  assert.equal(isReauthWindowActive(expiry, false, now + 1000), false)
  assert.equal(isReauthWindowActive(null, true, now), true)

  assert.equal(formatReauthRemaining(expiry, now + 15_000), "09:45")
  assert.equal(formatReauthRemaining(expiry, expiry), null)
})

test("mapAccountSecurityError maps reauth_required, invalid_credentials, lockout prevention, and network errors", () => {
  const reauthErr = new ApiError(403, "reauth_required", "reauth required")
  const mappedReauth = mapAccountSecurityError(reauthErr, "en")
  assert.equal(mappedReauth.requiresReauth, true)
  assert.ok(mappedReauth.message.includes("10 minutes"))

  const badPassErr = new ApiError(401, "invalid_credentials", "Invalid password")
  const mappedBadPass = mapAccountSecurityError(badPassErr, "id")
  assert.equal(mappedBadPass.requiresReauth, false)
  assert.ok(mappedBadPass.message.includes("salah"))

  const lockoutErr = new ApiError(
    400,
    "cannot_unlink_last_auth_method",
    "Set a password before unlinking"
  )
  const mappedLockout = mapAccountSecurityError(lockoutErr, "en")
  assert.equal(mappedLockout.requiresReauth, false)
  assert.ok(mappedLockout.message.includes("lockout"))

  const alreadySetErr = new ApiError(409, "password_already_set", "Already set")
  assert.ok(mapAccountSecurityError(alreadySetErr, "id").message.includes("sudah"))

  const networkErr = new TypeError("Failed to fetch")
  const mappedNetwork = mapAccountSecurityError(networkErr, "en")
  assert.equal(mappedNetwork.requiresReauth, false)
  assert.ok(mappedNetwork.message.includes("Network error"))
})

test("api.ts exposes Phase 4 auth methods with POST JSON bodies for CSRF-safe mutations", () => {
  const apiSource = fs.readFileSync(path.join(frontendRoot, "src/lib/api.ts"), "utf8")
  assert.match(apiSource, /methods\(\):\s*Promise<AuthMethodsResponse>/)
  assert.match(apiSource, /"\/api\/auth\/methods"/)
  assert.match(apiSource, /reauthenticate\(password:\s*string\):\s*Promise<ReauthenticateResponse>/)
  assert.match(apiSource, /"\/api\/auth\/reauthenticate"/)
  assert.match(
    apiSource,
    /googleLinkStart\(\):\s*Promise<GoogleLinkStartResponse>\s*\{\s*return apiFetch<GoogleLinkStartResponse>\("\/api\/auth\/google\/link\/start",\s*\{\s*method:\s*"POST",\s*body:\s*\{\s*\}/
  )
  assert.match(
    apiSource,
    /googleUnlink\(\):\s*Promise<\{\s*success:\s*boolean\s*\}>\s*\{\s*return apiFetch<\{\s*success:\s*boolean\s*\}>\("\/api\/auth\/google\/unlink",\s*\{\s*method:\s*"POST",\s*body:\s*\{\s*\}/
  )
  assert.match(
    apiSource,
    /setPassword\(newPassword:\s*string\):\s*Promise<\{\s*success:\s*boolean\s*\}>\s*\{\s*return apiFetch<\{\s*success:\s*boolean\s*\}>\("\/api\/auth\/set-password"/
  )
})

test("AccountSecuritySection, ReauthModal, and SettingsPage implement security guards and no browser storage", () => {
  const sectionSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/AccountSecuritySection.tsx"),
    "utf8"
  )
  const modalSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/ReauthModal.tsx"),
    "utf8"
  )
  const settingsPageSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/SettingsPage.tsx"),
    "utf8"
  )

  assert.match(sectionSource, /authApi\.methods\(\)/)
  assert.match(sectionSource, /authApi\.googleLinkStart\(\)/)
  assert.match(sectionSource, /window\.location\.assign\(res\.authorize_url\)/)
  assert.match(sectionSource, /authApi\.googleUnlink\(\)/)
  assert.match(sectionSource, /authApi\.setPassword\(newPassword\)/)
  assert.match(sectionSource, /if \(isLinking \|\| isUnlinking\) return/)
  assert.match(sectionSource, /if \(isSettingPassword\) return/)
  assert.match(sectionSource, /!methods\.has_password/)
  assert.match(sectionSource, /t\("security\.unlinkRequiresPassword"\)/)
  assert.match(sectionSource, /t\("common\.retry"\)/)
  assert.doesNotMatch(sectionSource, /localStorage|sessionStorage/)

  assert.match(modalSource, /authApi\.reauthenticate\(password\)/)
  assert.match(modalSource, /if \(isSubmitting\) return/)
  assert.doesNotMatch(modalSource, /localStorage|sessionStorage/)

  assert.match(settingsPageSource, /Account & Security/)
  assert.match(settingsPageSource, /settings\.sectionAccountSecurity/)
})

test("SEC-01/02/03/04 regressions: background refresh throttle, notice deduplication, BroadcastChannel cleanup, and link lock", () => {
  const now = 1_700_000_000_000
  assert.equal(shouldFetchMethodsInBackground(true, 0, now), false)
  assert.equal(shouldFetchMethodsInBackground(false, now - 500, now, 2000), false)
  assert.equal(shouldFetchMethodsInBackground(false, now - 2500, now, 2000), true)

  const key1 = shouldRefreshOnOAuthNotice({ kind: "success", code: "google_linked" }, null)
  assert.equal(key1, "success:google_linked")
  assert.equal(shouldRefreshOnOAuthNotice({ kind: "success", code: "google_linked" }, key1), null)
  assert.equal(shouldRefreshOnOAuthNotice(null, key1), null)

  const sectionSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/AccountSecuritySection.tsx"),
    "utf8"
  )

  // SEC-01: focus, visibilitychange, BroadcastChannel with cleanup & no sensitive payload
  assert.match(sectionSource, /window\.addEventListener\("focus",\s*handleWindowFocus\)/)
  assert.match(sectionSource, /window\.removeEventListener\("focus",\s*handleWindowFocus\)/)
  assert.match(sectionSource, /document\.addEventListener\("visibilitychange",\s*handleVisibilityChange\)/)
  assert.match(sectionSource, /document\.removeEventListener\("visibilitychange",\s*handleVisibilityChange\)/)
  assert.match(sectionSource, /new BroadcastChannel\(AUTH_SECURITY_CHANNEL\)/)
  assert.match(sectionSource, /channel\.close\(\)/)
  assert.match(sectionSource, /type:\s*"auth-methods-updated"/)
  assert.match(sectionSource, /inFlightMethodsRef\.current/)

  // SEC-02: tab restoration / sleep check against wall-clock expiry
  assert.match(sectionSource, /reauthExpiresAtRef\.current/)

  // SEC-03: executeGoogleLinkStart keeps isLinking=true during navigation (no finally reset)
  const linkFnMatch = sectionSource.match(/const executeGoogleLinkStart = useCallback\(async \(\) => \{[\s\S]*?\}, \[[^\]]+\]\)/)
  assert.ok(linkFnMatch, "executeGoogleLinkStart should exist")
  assert.doesNotMatch(linkFnMatch[0], /finally\s*\{/)

  // SEC-04: oauthNotice effect uses shouldRefreshOnOAuthNotice
  assert.match(sectionSource, /shouldRefreshOnOAuthNotice\(oauthNotice,\s*lastHandledNoticeRef\.current\)/)
})

test("Phase 5 — Google Account Unlinking enforces confirmation modal, reauth, lockout guard, and 404 sync", () => {
  const notLinkedErr = new ApiError(404, "google_not_linked", "No Google account is linked")
  const mappedNotLinkedEn = mapAccountSecurityError(notLinkedErr, "en")
  assert.equal(mappedNotLinkedEn.requiresReauth, false)
  assert.ok(mappedNotLinkedEn.message.includes("No Google account"))

  const mappedNotLinkedId = mapAccountSecurityError(notLinkedErr, "id")
  assert.equal(mappedNotLinkedId.requiresReauth, false)
  assert.ok(mappedNotLinkedId.message.includes("Tidak ada akun Google"))

  const sectionSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/AccountSecuritySection.tsx"),
    "utf8"
  )

  // Confirmation modal opens before reauth/unlink
  assert.match(sectionSource, /setIsUnlinkConfirmOpen\(true\)/)
  assert.match(sectionSource, /handleConfirmUnlinkGoogle/)
  assert.match(sectionSource, /t\("security\.unlinkConfirmTitle"\)/)
  assert.match(sectionSource, /t\("security\.unlinkConfirmMessage"/)
  assert.match(sectionSource, /t\("security\.unlinkConfirmButton"\)/)

  // Graceful 404 google_not_linked syncs methods
  assert.match(sectionSource, /err\.code === "google_not_linked"/)

  // UI never marks google unlinked locally without refreshing from backend 200
  assert.doesNotMatch(sectionSource, /google:\s*null/)
})

test("Phase 6 — Initial Password Setup supports independent visibility toggles, resets on success, and handles 409/400", () => {
  const invalidPwErr = new ApiError(400, "invalid_new_password", "invalid password length")
  const mapped400En = mapAccountSecurityError(invalidPwErr, "en")
  assert.equal(mapped400En.requiresReauth, false)
  assert.ok(mapped400En.message.includes("8") && mapped400En.message.includes("128"))

  const mapped400Id = mapAccountSecurityError(invalidPwErr, "id")
  assert.equal(mapped400Id.requiresReauth, false)
  assert.ok(mapped400Id.message.includes("8") && mapped400Id.message.includes("128"))

  const alreadySetErr = new ApiError(409, "password_already_set", "Password already configured")
  const mapped409En = mapAccountSecurityError(alreadySetErr, "en")
  assert.equal(mapped409En.requiresReauth, false)
  assert.ok(mapped409En.message.includes("already configured"))

  const sectionSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/AccountSecuritySection.tsx"),
    "utf8"
  )

  // Independent visibility states defaulting to false
  assert.match(sectionSource, /const \[showNewPassword, setShowNewPassword\] = useState\(false\)/)
  assert.match(sectionSource, /const \[showConfirmPassword, setShowConfirmPassword\] = useState\(false\)/)

  // Input types switch independently
  assert.match(sectionSource, /type=\{showNewPassword \? "text" : "password"\}/)
  assert.match(sectionSource, /type=\{showConfirmPassword \? "text" : "password"\}/)

  // Toggle buttons use type="button", aria-pressed, and aria-label
  assert.match(sectionSource, /aria-pressed=\{showNewPassword\}/)
  assert.match(sectionSource, /aria-pressed=\{showConfirmPassword\}/)
  assert.match(sectionSource, /t\("security\.showPassword"\)/)
  assert.match(sectionSource, /t\("security\.hidePassword"\)/)

  // Resets visibility & clears passwords on success; refreshes methods on 409
  const setPwMatch = sectionSource.match(/const handleSetInitialPassword = async[\s\S]*?^\s{2}\}/m)
  assert.ok(setPwMatch, "handleSetInitialPassword should exist")
  assert.match(setPwMatch[0], /setNewPassword\(""\)/)
  assert.match(setPwMatch[0], /setConfirmPassword\(""\)/)
  assert.match(setPwMatch[0], /setShowNewPassword\(false\)/)
  assert.match(setPwMatch[0], /setShowConfirmPassword\(false\)/)
  assert.match(setPwMatch[0], /err\.code === "password_already_set"/)
  assert.match(setPwMatch[0], /loadMethods\(\{\s*force:\s*true,\s*silent:\s*true\s*\}\)/)
})

test("Phase 7 — authApi empty POSTs and mutations send credentials=include and JSON bodies via apiFetch", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; init: RequestInit }> = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return new Response(JSON.stringify({ success: true, authorize_url: "https://accounts.google.com/o/oauth2/auth" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    await authApi.onboardingCancel()
    await authApi.googleLinkStart()
    await authApi.googleUnlink()
    await authApi.resendVerification()
    await authApi.logout()
    await authApi.reauthenticate("secret-pw")
    await authApi.setPassword("Str0ngPass!")
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 7)

  // First 5 are empty POSTs that must send body: "{}" + Content-Type: application/json + credentials: "include"
  for (let i = 0; i < 5; i += 1) {
    const { init } = calls[i]
    const headers = init.headers as Record<string, string>
    assert.equal(init.method, "POST")
    assert.equal(init.credentials, "include")
    assert.equal(headers["Content-Type"], "application/json")
    assert.equal(init.body, "{}")
  }

  // Payload POSTs also send credentials: "include" and JSON Content-Type
  for (let i = 5; i < 7; i += 1) {
    const { init } = calls[i]
    const headers = init.headers as Record<string, string>
    assert.equal(init.method, "POST")
    assert.equal(init.credentials, "include")
    assert.equal(headers["Content-Type"], "application/json")
    assert.equal(typeof init.body, "string")
  }
})

test("Phase 7 — 401 unauthenticated triggers session refresh with loop guard while 401 invalid_credentials stays inline", () => {
  assert.equal(
    isUnauthenticatedSessionError(new ApiError(401, "unauthenticated", "Session expired")),
    true
  )
  assert.equal(
    isUnauthenticatedSessionError(new ApiError(401, "invalid_credentials", "Invalid password")),
    false
  )
  assert.equal(
    isUnauthenticatedSessionError(new ApiError(403, "reauth_required", "Reauth required")),
    false
  )
  assert.equal(
    isUnauthenticatedSessionError(new ApiError(409, "password_already_set", "Already set")),
    false
  )
  assert.equal(isUnauthenticatedSessionError(new TypeError("Failed to fetch")), false)

  const sectionSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/AccountSecuritySection.tsx"),
    "utf8"
  )
  const modalSource = fs.readFileSync(
    path.join(frontendRoot, "src/features/settings/ReauthModal.tsx"),
    "utf8"
  )

  // AccountSecuritySection guards against repeated refreshSession calls & stops background refreshes after 401
  assert.match(sectionSource, /isUnauthenticatedSessionError\(err\)/)
  assert.match(sectionSource, /if \(!sessionExpiredRef\.current\)/)
  assert.match(sectionSource, /if \(sessionExpiredRef\.current \|\| inFlightMethodsRef\.current\) return/)
  assert.match(sectionSource, /if \(sessionExpiredRef\.current\) return/)

  // ReauthModal only calls refreshSession on isUnauthenticatedSessionError (not invalid_credentials) and closes on expiry
  assert.match(modalSource, /isUnauthenticatedSessionError\(err\)/)
  assert.match(modalSource, /void refreshSession\(\)/)
  assert.match(modalSource, /onClose\(\)/)

  // Storage & console hygiene across all Phase 2-7 Google OIDC / security files
  const filesToAudit = [
    "src/features/auth/GoogleAuthButton.tsx",
    "src/features/auth/OnboardingPage.tsx",
    "src/features/settings/AccountSecuritySection.tsx",
    "src/features/settings/ReauthModal.tsx",
    "src/lib/onboarding.ts",
    "src/lib/accountSecurity.ts",
  ]
  for (const relPath of filesToAudit) {
    const content = fs.readFileSync(path.join(frontendRoot, relPath), "utf8")
    assert.doesNotMatch(content, /localStorage|sessionStorage/, `${relPath} must not use browser storage`)
    assert.doesNotMatch(
      content,
      /console\.(log|info|debug|warn|error)\(/,
      `${relPath} must not log to console`
    )
  }
})
