import { ApiError } from "./api.ts"
import type { Language } from "./i18n/types.ts"

export const REAUTH_WINDOW_SECONDS = 600
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const AUTH_SECURITY_CHANNEL = "barvato-account-security"
export const MIN_BACKGROUND_REFRESH_MS = 2000

export interface AuthSecuritySyncMessage {
  type: "auth-methods-updated"
}

export function shouldFetchMethodsInBackground(
  inFlight: boolean,
  lastFetchAtMs: number,
  nowMs = Date.now(),
  minIntervalMs = MIN_BACKGROUND_REFRESH_MS,
): boolean {
  if (inFlight) return false
  if (lastFetchAtMs > 0 && nowMs - lastFetchAtMs < minIntervalMs) {
    return false
  }
  return true
}

export function shouldRefreshOnOAuthNotice(
  notice: { kind: string; code: string } | null,
  lastHandledKey: string | null,
): string | null {
  if (!notice) return null
  const nextKey = `${notice.kind}:${notice.code}`
  return nextKey === lastHandledKey ? null : nextKey
}

export function isUnauthenticatedSessionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401 && err.code === "unauthenticated"
}

export function validateInitialPassword(
  newPassword: string,
  confirmPassword: string,
  language: Language,
): string | null {
  const isId = language === "id"
  if (!newPassword) {
    return isId ? "Kata sandi baru wajib diisi." : "New password is required."
  }
  if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
    return isId
      ? `Kata sandi harus terdiri dari ${PASSWORD_MIN_LENGTH} hingga ${PASSWORD_MAX_LENGTH} karakter.`
      : `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`
  }
  if (newPassword !== confirmPassword) {
    return isId
      ? "Konfirmasi kata sandi tidak cocok."
      : "Password confirmation does not match."
  }
  return null
}

export function computeReauthExpiryMs(
  expiresInSeconds = REAUTH_WINDOW_SECONDS,
  nowMs = Date.now(),
): number {
  const safeSeconds = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds
    : REAUTH_WINDOW_SECONDS
  return nowMs + safeSeconds * 1000
}

export function isReauthWindowActive(
  expiresAtMs: number | null,
  serverReauthenticated: boolean,
  nowMs = Date.now(),
): boolean {
  if (!serverReauthenticated) return false
  if (expiresAtMs !== null) {
    return expiresAtMs > nowMs
  }
  return true
}

export function formatReauthRemaining(
  expiresAtMs: number | null,
  nowMs = Date.now(),
): string | null {
  if (expiresAtMs === null) return null
  const remainingSec = Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
  if (remainingSec <= 0) return null
  const mins = Math.floor(remainingSec / 60)
  const secs = remainingSec % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

export function mapAccountSecurityError(
  err: unknown,
  language: Language,
): { message: string; requiresReauth: boolean } {
  const isId = language === "id"
  if (err instanceof ApiError) {
    switch (err.code) {
      case "reauth_required":
        return {
          requiresReauth: true,
          message: isId
            ? "Verifikasi ulang kata sandi diperlukan (berlaku 10 menit)."
            : "Password reauthentication is required (valid for 10 minutes).",
        }
      case "invalid_credentials":
        return {
          requiresReauth: false,
          message: isId ? "Kata sandi yang dimasukkan salah." : "Invalid password.",
        }
      case "password_not_set":
        return {
          requiresReauth: false,
          message: isId
            ? "Akun ini belum memiliki kata sandi. Silakan buat kata sandi terlebih dahulu."
            : "This account does not have a password configured yet.",
        }
      case "cannot_unlink_last_auth_method":
        return {
          requiresReauth: false,
          message: isId
            ? "Buat kata sandi terlebih dahulu sebelum memutuskan tautan akun Google agar Anda tidak terkunci."
            : "Set a password before unlinking your Google account to prevent account lockout.",
        }
      case "password_already_set":
        return {
          requiresReauth: false,
          message: isId
            ? "Kata sandi sudah dikonfigurasi untuk akun ini."
            : "A password is already configured for this account.",
        }
      case "invalid_new_password":
        return {
          requiresReauth: false,
          message: isId
            ? `Kata sandi harus terdiri dari ${PASSWORD_MIN_LENGTH} hingga ${PASSWORD_MAX_LENGTH} karakter.`
            : `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
        }
      case "google_already_linked":
        return {
          requiresReauth: false,
          message: isId
            ? "Akun Google sudah tertaut ke akun Barvato Anda."
            : "A Google account is already linked to your Barvato account.",
        }
      case "google_auth_disabled":
        return {
          requiresReauth: false,
          message: isId
            ? "Autentikasi Google saat ini tidak diaktifkan."
            : "Google authentication is currently disabled.",
        }
      case "google_not_linked":
        return {
          requiresReauth: false,
          message: isId
            ? "Tidak ada akun Google yang tertaut pada akun ini."
            : "No Google account is linked to this account.",
        }
      case "unauthenticated":
        return {
          requiresReauth: false,
          message: isId
            ? "Sesi Anda tidak valid atau telah berakhir. Silakan masuk kembali."
            : "Your session is invalid or has expired. Please sign in again.",
        }
      default:
        return {
          requiresReauth: false,
          message:
            err.message ||
            (isId
              ? "Terjadi kesalahan saat memproses permintaan keamanan akun."
              : "Failed to process account security request."),
        }
    }
  }

  return {
    requiresReauth: false,
    message: isId
      ? "Kesalahan jaringan: Gagal menghubungi server. Silakan coba lagi."
      : "Network error: Unable to reach the server. Please try again.",
  }
}
