import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildGoogleStartURL,
  isGoogleAuthClientEnabled,
} from "../../lib/googleAuth.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe("Phase 2 — Google Sign-In / Sign-Up UI", () => {
  it("builds backend OAuth initiation URLs for signin and signup intents", () => {
    assert.equal(buildGoogleStartURL("signin"), "/api/auth/google/start?intent=signin")
    assert.equal(buildGoogleStartURL("signup"), "/api/auth/google/start?intent=signup")
  })

  it("respects VITE_AUTH_GOOGLE_ENABLED configuration", () => {
    assert.equal(isGoogleAuthClientEnabled(undefined), true)
    assert.equal(isGoogleAuthClientEnabled("true"), true)
    assert.equal(isGoogleAuthClientEnabled("false"), false)
    assert.equal(isGoogleAuthClientEnabled(" FALSE "), false)
  })

  it("LoginPage renders only the signin Google button with duplicate-submit guard", () => {
    const loginSrc = fs.readFileSync(path.resolve(__dirname, "LoginPage.tsx"), "utf8")
    const btnSrc = fs.readFileSync(path.resolve(__dirname, "GoogleAuthButton.tsx"), "utf8")

    assert.match(loginSrc, /GoogleAuthButton/)
    assert.match(loginSrc, /intent="signin"/)
    assert.doesNotMatch(loginSrc, /intent="signup"/)
    assert.doesNotMatch(loginSrc, /auth\.googleSignUpButton/)
    assert.match(loginSrc, /redirectingIntent !== null/)
    assert.match(loginSrc, /window\.location\.assign\(buildGoogleStartURL\(intent\)\)/)
    assert.match(loginSrc, /needsShopSelection/)

    // Security invariants: no browser token storage or direct Google OAuth URL construction
    assert.doesNotMatch(loginSrc, /localStorage|sessionStorage|accounts\.google\.com|client_secret/i)
    assert.doesNotMatch(btnSrc, /localStorage|sessionStorage|accounts\.google\.com|client_secret/i)
    assert.match(btnSrc, /disabled=\{disabled \|\| isLoading\}/)
  })
})
