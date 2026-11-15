import { ApiError } from "./api.ts"
import type { Language } from "./i18n/types"

export const ONBOARDING_TIMEZONES = [
  { value: "Asia/Jakarta", labelEn: "WIB (Asia/Jakarta)", labelId: "WIB (Asia/Jakarta)" },
  { value: "Asia/Makassar", labelEn: "WITA (Asia/Makassar)", labelId: "WITA (Asia/Makassar)" },
  { value: "Asia/Jayapura", labelEn: "WIT (Asia/Jayapura)", labelId: "WIT (Asia/Jayapura)" },
] as const

export const DEFAULT_LEGAL_VERSION = "2026-11-01"

export interface OnboardingFormInput {
  shopName: string
  ownerName: string
  phone: string
  timezone: string
  cutsHair: boolean
  commissionPercent: string
  termsAccepted: boolean
  privacyAccepted: boolean
}

export function commissionPercentToBps(rawPercent: string): number | null {
  const trimmed = rawPercent.trim()
  if (trimmed === "") return 0
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null
  }
  return Math.round(parsed * 100)
}

export function validateOnboardingInput(
  input: OnboardingFormInput,
  language: Language,
): string | null {
  const isId = language === "id"

  if (!input.shopName.trim()) {
    return isId ? "Nama barbershop wajib diisi." : "Barbershop name is required."
  }

  if (input.cutsHair) {
    const bps = commissionPercentToBps(input.commissionPercent)
    if (bps === null || bps < 0 || bps > 10000) {
      return isId
        ? "Komisi kapster harus antara 0% hingga 100%."
        : "Barber commission must be between 0% and 100%."
    }
  }

  if (!input.termsAccepted || !input.privacyAccepted) {
    return isId
      ? "Anda harus menyetujui Syarat & Ketentuan serta Kebijakan Privasi."
      : "You must accept both the Terms of Service and Privacy Policy."
  }

  return null
}

export function mapOnboardingApiError(
  err: unknown,
  language: Language,
): { message: string; expired: boolean } {
  const isId = language === "id"
  if (err instanceof ApiError) {
    if (err.isUnauthorized || err.code === "onboarding_session_required") {
      return {
        expired: true,
        message: isId
          ? "Sesi pendaftaran Google Anda telah kedaluwarsa atau tidak valid. Silakan mulai ulang."
          : "Your Google onboarding session has expired or is invalid. Please start again.",
      }
    }
    if (err.isConflict || err.code === "owner_conflict") {
      return {
        expired: false,
        message: isId
          ? "Akun dengan email atau nomor telepon ini sudah terdaftar."
          : "An account with this email or phone number already exists.",
      }
    }
    if (err.code === "consent_required") {
      return {
        expired: false,
        message: isId
          ? "Syarat & Ketentuan serta Kebijakan Privasi wajib disetujui."
          : "Terms of Service and Privacy Policy must be accepted.",
      }
    }
    return {
      expired: false,
      message:
        err.message ||
        (isId
          ? "Gagal menyelesaikan pendaftaran toko. Silakan periksa data Anda."
          : "Failed to complete shop onboarding. Please check your input."),
    }
  }

  return {
    expired: false,
    message: isId
      ? "Kesalahan jaringan: Gagal menghubungi server. Silakan coba lagi."
      : "Network error: Unable to reach the server. Please try again.",
  }
}
