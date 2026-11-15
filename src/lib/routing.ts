import type { Language } from "./i18n/types"

export type AppRouteKind =
  | "root"
  | "login"
  | "select-shop"
  | "dashboard"
  | "onboarding"
  | "settings"
  | "verify-email"

export interface OAuthSettingsNotice {
  kind: "success" | "error"
  code: string
}

export interface ParsedRoute {
  kind: AppRouteKind
  pathname: string
  loginError: string | null
  onboardingConflict: string | null
  settingsNotice: OAuthSettingsNotice | null
  hasTransientQueryParams: boolean
}

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim()
  if (!trimmed || trimmed === "/") return "/"
  return trimmed.replace(/\/+$/, "") || "/"
}

export function parseRoute(pathname: string, search = ""): ParsedRoute {
  const normPath = normalizePathname(pathname)
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)

  let kind: AppRouteKind = "root"
  switch (normPath) {
    case "/verify-email":
      kind = "verify-email"
      break
    case "/onboarding":
      kind = "onboarding"
      break
    case "/settings":
      kind = "settings"
      break
    case "/dashboard":
      kind = "dashboard"
      break
    case "/select-shop":
      kind = "select-shop"
      break
    case "/login":
      kind = "login"
      break
    default:
      kind = "root"
      break
  }

  const rawError = params.get("error")?.trim() || null
  const rawConflict = params.get("conflict")?.trim() || null
  const rawGoogle = params.get("google")?.trim() || null

  const loginError = kind === "login" || kind === "root" ? rawError : null
  const onboardingConflict = kind === "onboarding" ? rawConflict : null

  let settingsNotice: OAuthSettingsNotice | null = null
  if (kind === "settings") {
    if (rawGoogle === "linked") {
      settingsNotice = { kind: "success", code: "google_linked" }
    } else if (rawError) {
      settingsNotice = { kind: "error", code: rawError }
    }
  }

  return {
    kind,
    pathname: normPath,
    loginError,
    onboardingConflict,
    settingsNotice,
    hasTransientQueryParams: Boolean(loginError || onboardingConflict || settingsNotice),
  }
}

export interface RouteAuthState {
  isLoading: boolean
  isAuthenticated: boolean
  needsShopSelection: boolean
}

/**
 * Computes the canonical URL path for history.replaceState to prevent stale query params
 * or redirect loops. Returns null when no URL replacement is needed.
 */
export function resolveCanonicalPath(
  route: ParsedRoute,
  authState: RouteAuthState,
): string | null {
  if (authState.isLoading || route.kind === "verify-email") {
    return null
  }

  if (authState.isAuthenticated) {
    if (
      route.kind === "login" ||
      route.kind === "select-shop" ||
      route.kind === "dashboard" ||
      route.kind === "onboarding"
    ) {
      return "/"
    }
    if (route.kind === "settings" && route.hasTransientQueryParams) {
      return "/settings"
    }
    if (route.kind === "root" && route.hasTransientQueryParams) {
      return "/"
    }
    return null
  }

  if (authState.needsShopSelection) {
    if (route.kind !== "select-shop" || route.hasTransientQueryParams) {
      return "/select-shop"
    }
    return null
  }

  // Unauthenticated
  if (route.kind === "onboarding") {
    return route.hasTransientQueryParams ? "/onboarding" : null
  }
  if (route.kind === "settings" || route.kind === "dashboard" || route.kind === "select-shop") {
    return "/login"
  }
  if ((route.kind === "login" || route.kind === "root") && route.hasTransientQueryParams) {
    return route.kind === "login" ? "/login" : "/"
  }
  return null
}

export function mapOAuthErrorMessage(code: string, language: Language): string {
  const isId = language === "id"
  switch (code) {
    case "google_cancelled":
      return isId
        ? "Masuk dengan Google dibatalkan."
        : "Google sign-in was cancelled."
    case "oauth_invalid_state":
      return isId
        ? "Sesi autentikasi Google tidak valid atau telah kedaluwarsa. Silakan coba lagi."
        : "Google authentication state is invalid or expired. Please try again."
    case "google_verification_failed":
      return isId
        ? "Gagal memverifikasi akun Google Anda. Pastikan email Google terverifikasi."
        : "Failed to verify your Google account. Please ensure your Google email is verified."
    case "no_active_membership":
      return isId
        ? "Akun Google Anda tidak memiliki akses ke barbershop aktif."
        : "Your Google account does not have access to an active shop."
    case "account_exists_link_required":
      return isId
        ? "Email ini sudah terdaftar dengan kata sandi. Masuk dengan kata sandi terlebih dahulu, lalu hubungkan Google di Pengaturan."
        : "An account with this email already exists. Sign in with your password first, then link Google in Settings."
    case "link_session_invalid":
      return isId
        ? "Sesi atau verifikasi ulang untuk menautkan Google tidak valid atau kedaluwarsa. Silakan coba lagi."
        : "Your session or reauthentication expired while linking Google. Please try again."
    case "google_already_used":
      return isId
        ? "Akun Google ini sudah terhubung ke akun Barvato lain."
        : "This Google account is already linked to another Barvato account."
    case "google_link_failed":
      return isId
        ? "Gagal menautkan akun Google. Silakan coba lagi."
        : "Failed to link your Google account. Please try again."
    case "google_auth_failed":
    default:
      return isId
        ? "Autentikasi Google gagal. Silakan coba lagi."
        : "Google authentication failed. Please try again."
  }
}
