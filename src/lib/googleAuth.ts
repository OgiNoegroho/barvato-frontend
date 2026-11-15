export type GoogleAuthIntent = "signin" | "signup"

export function buildGoogleStartURL(intent: GoogleAuthIntent): string {
  return `/api/auth/google/start?intent=${encodeURIComponent(intent)}`
}

export function isGoogleAuthClientEnabled(
  envValue: string | undefined = typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_AUTH_GOOGLE_ENABLED
    : undefined,
): boolean {
  if (typeof envValue === "string" && envValue.trim().toLowerCase() === "false") {
    return false
  }
  return true
}
