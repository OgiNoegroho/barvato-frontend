import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  mapOAuthErrorMessage,
  parseRoute,
  resolveCanonicalPath,
} from "./routing.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe("Phase 1 — Custom Routing & OAuth Redirect Foundation", () => {
  it("parses all required OAuth redirect paths and transient query parameters", () => {
    const dash = parseRoute("/dashboard", "")
    assert.equal(dash.kind, "dashboard")
    assert.equal(dash.hasTransientQueryParams, false)

    const selectShop = parseRoute("/select-shop/", "")
    assert.equal(selectShop.kind, "select-shop")
    assert.equal(selectShop.pathname, "/select-shop")

    const onb = parseRoute("/onboarding", "?conflict=active_session")
    assert.equal(onb.kind, "onboarding")
    assert.equal(onb.onboardingConflict, "active_session")
    assert.equal(onb.hasTransientQueryParams, true)

    const settingsSuccess = parseRoute("/settings", "?google=linked")
    assert.equal(settingsSuccess.kind, "settings")
    assert.deepEqual(settingsSuccess.settingsNotice, {
      kind: "success",
      code: "google_linked",
    })

    const settingsError = parseRoute("/settings", "?error=google_already_used")
    assert.equal(settingsError.kind, "settings")
    assert.deepEqual(settingsError.settingsNotice, {
      kind: "error",
      code: "google_already_used",
    })

    const loginErr = parseRoute("/login", "?error=account_exists_link_required")
    assert.equal(loginErr.kind, "login")
    assert.equal(loginErr.loginError, "account_exists_link_required")

    const verify = parseRoute("/verify-email", "?token=abc")
    assert.equal(verify.kind, "verify-email")
    assert.equal(verify.hasTransientQueryParams, false)
  })

  it("resolves canonical paths without redirect loops", () => {
    // Loading state never triggers redirects
    assert.equal(
      resolveCanonicalPath(parseRoute("/settings", "?google=linked"), {
        isLoading: true,
        isAuthenticated: false,
        needsShopSelection: false,
      }),
      null,
    )

    // Verify-email is always preserved
    assert.equal(
      resolveCanonicalPath(parseRoute("/verify-email", "?token=xyz"), {
        isLoading: false,
        isAuthenticated: true,
        needsShopSelection: false,
      }),
      null,
    )

    // Authenticated user on /dashboard, /login, /onboarding, /select-shop normalizes to /
    for (const p of ["/dashboard", "/login", "/onboarding", "/select-shop"]) {
      assert.equal(
        resolveCanonicalPath(parseRoute(p, ""), {
          isLoading: false,
          isAuthenticated: true,
          needsShopSelection: false,
        }),
        "/",
      )
    }
    // Root "/" is already canonical -> null (no loop)
    assert.equal(
      resolveCanonicalPath(parseRoute("/", ""), {
        isLoading: false,
        isAuthenticated: true,
        needsShopSelection: false,
      }),
      null,
    )

    // Authenticated user on /settings?google=linked normalizes once to /settings, then null
    assert.equal(
      resolveCanonicalPath(parseRoute("/settings", "?google=linked"), {
        isLoading: false,
        isAuthenticated: true,
        needsShopSelection: false,
      }),
      "/settings",
    )
    assert.equal(
      resolveCanonicalPath(parseRoute("/settings", ""), {
        isLoading: false,
        isAuthenticated: true,
        needsShopSelection: false,
      }),
      null,
    )

    // Multi-shop selection normalizes to /select-shop, then null
    assert.equal(
      resolveCanonicalPath(parseRoute("/dashboard", ""), {
        isLoading: false,
        isAuthenticated: false,
        needsShopSelection: true,
      }),
      "/select-shop",
    )
    assert.equal(
      resolveCanonicalPath(parseRoute("/select-shop", ""), {
        isLoading: false,
        isAuthenticated: false,
        needsShopSelection: true,
      }),
      null,
    )

    // Unauthenticated user on protected paths normalizes to /login, then null
    for (const p of ["/settings", "/dashboard", "/select-shop"]) {
      assert.equal(
        resolveCanonicalPath(parseRoute(p, ""), {
          isLoading: false,
          isAuthenticated: false,
          needsShopSelection: false,
        }),
        "/login",
      )
    }
    assert.equal(
      resolveCanonicalPath(parseRoute("/login", ""), {
        isLoading: false,
        isAuthenticated: false,
        needsShopSelection: false,
      }),
      null,
    )

    // Unauthenticated user on /onboarding stays on /onboarding
    assert.equal(
      resolveCanonicalPath(parseRoute("/onboarding", ""), {
        isLoading: false,
        isAuthenticated: false,
        needsShopSelection: false,
      }),
      null,
    )
  })

  it("maps OAuth callback error codes in both Indonesian and English", () => {
    const codes = [
      "google_cancelled",
      "oauth_invalid_state",
      "google_verification_failed",
      "no_active_membership",
      "account_exists_link_required",
      "link_session_invalid",
      "google_already_used",
      "google_link_failed",
      "google_auth_failed",
    ]
    for (const code of codes) {
      assert.ok(mapOAuthErrorMessage(code, "id").length > 0)
      assert.ok(mapOAuthErrorMessage(code, "en").length > 0)
    }
  })

  it("App.tsx wires popstate browser history and avoids React Router", () => {
    const appSrc = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8")
    assert.doesNotMatch(appSrc, /react-router/)
    assert.match(appSrc, /addEventListener\("popstate"/)
    assert.match(appSrc, /history\.replaceState/)
    assert.match(appSrc, /history\.pushState/)
    assert.match(appSrc, /resolveCanonicalPath/)
  })
})
