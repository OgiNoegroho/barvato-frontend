import {
  ApiError,
  type OwnerBarberConfig,
  type UpdateOwnerBarberRequest,
} from "./api.ts"
import type { Language } from "./i18n/types.ts"

export interface OwnerBarberFormValues {
  name: string
  commissionPercent: string
  contact: string
  linkStaffId: string
}

export interface OwnerBarberErrorResult {
  message: string
  code: string
  requiresRelogin: boolean
  shouldRefresh: boolean
}

export function formatCommissionPercent(commissionBps: number | null | undefined): string {
  if (commissionBps == null || !Number.isFinite(commissionBps)) {
    return "0"
  }
  const pct = commissionBps / 100
  return Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(2)))
}

export function parseCommissionPercentToBps(
  input: string,
  language: Language,
): { bps: number; error: null } | { bps: null; error: string } {
  const isId = language === "id"
  const trimmed = input.trim()
  if (trimmed === "") {
    return { bps: 0, error: null }
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return {
      bps: null,
      error: isId
        ? "Persentase komisi harus antara 0% hingga 100%."
        : "Commission percentage must be between 0% and 100%.",
    }
  }
  const bps = Math.round(parsed * 100)
  return { bps, error: null }
}

export function createInitialOwnerBarberForm(
  config: OwnerBarberConfig | null,
  fallbackName = "",
  fallbackContact = "",
): OwnerBarberFormValues {
  if (config?.staff) {
    return {
      name: config.staff.name || fallbackName,
      commissionPercent: formatCommissionPercent(config.staff.commission_bps),
      contact: config.staff.contact ?? "",
      linkStaffId: "",
    }
  }
  return {
    name: fallbackName,
    commissionPercent: "0",
    contact: fallbackContact,
    linkStaffId: "",
  }
}

export function reconcileOwnerBarberFormAfterRefresh(
  currentForm: OwnerBarberFormValues,
  refreshedConfig: OwnerBarberConfig,
  preserveDraft: boolean,
  fallbackName = "",
  fallbackContact = "",
): OwnerBarberFormValues {
  if (preserveDraft) {
    return currentForm
  }
  return createInitialOwnerBarberForm(
    refreshedConfig,
    fallbackName,
    fallbackContact,
  )
}

export function buildOwnerBarberUpdatePayload(
  enabled: boolean,
  form: OwnerBarberFormValues,
  isLinked: boolean,
  language: Language,
): { payload: UpdateOwnerBarberRequest; error: null } | { payload: null; error: string } {
  const isId = language === "id"

  if (!enabled) {
    return {
      payload: { enabled: false },
      error: null,
    }
  }

  const parsedLinkId =
    !isLinked && form.linkStaffId.trim() !== "" ? Number(form.linkStaffId) : undefined

  if (parsedLinkId !== undefined && (!Number.isInteger(parsedLinkId) || parsedLinkId <= 0)) {
    return {
      payload: null,
      error: isId
        ? "Profil kapster yang dipilih tidak valid."
        : "Selected staff profile is invalid.",
    }
  }

  const trimmedName = form.name.trim()
  if (!parsedLinkId && !trimmedName) {
    return {
      payload: null,
      error: isId
        ? "Nama profil kapster wajib diisi."
        : "Barber display name is required.",
    }
  }

  const commissionResult = parseCommissionPercentToBps(form.commissionPercent, language)
  if (commissionResult.error !== null) {
    return {
      payload: null,
      error: commissionResult.error,
    }
  }

  const payload: UpdateOwnerBarberRequest = {
    enabled: true,
    commission_bps: commissionResult.bps,
  }

  if (parsedLinkId !== undefined) {
    payload.link_staff_id = parsedLinkId
  }
  if (trimmedName) {
    payload.name = trimmedName
  }

  const trimmedContact = form.contact.trim()
  if (trimmedContact !== "" || isLinked) {
    payload.contact = trimmedContact
  }

  return { payload, error: null }
}

export function mapOwnerBarberError(
  err: unknown,
  language: Language,
): OwnerBarberErrorResult {
  const isId = language === "id"

  if (err instanceof ApiError) {
    if (err.code === "network_error" || err.status === 0) {
      return {
        code: "network_error",
        requiresRelogin: false,
        shouldRefresh: false,
        message: isId
          ? "Gagal terhubung ke server. Periksa koneksi internet Anda lalu coba lagi."
          : "Network error while contacting the server. Please check your connection and try again.",
      }
    }

    if (err.status === 401 || err.code === "unauthenticated") {
      return {
        code: err.code || "unauthenticated",
        requiresRelogin: true,
        shouldRefresh: false,
        message: isId
          ? "Sesi Anda telah berakhir. Silakan masuk kembali."
          : "Your session has expired. Please sign in again.",
      }
    }

    if (err.code === "shop_suspended") {
      return {
        code: "shop_suspended",
        requiresRelogin: false,
        shouldRefresh: true,
        message: isId
          ? "Toko sedang ditangguhkan sehingga pengaturan kapster pemilik tidak dapat diubah."
          : "This shop is currently suspended. Owner-as-barber settings cannot be modified.",
      }
    }

    if (err.status === 403 || err.code === "forbidden") {
      return {
        code: err.code || "forbidden",
        requiresRelogin: false,
        shouldRefresh: false,
        message: isId
          ? "Hanya pemilik toko yang memiliki izin untuk mengelola pengaturan kapster pemilik."
          : "Only the shop owner has permission to manage Owner-as-Barber settings.",
      }
    }

    if (err.status === 404 || err.code === "staff_not_found") {
      return {
        code: "staff_not_found",
        requiresRelogin: false,
        shouldRefresh: true,
        message: isId
          ? "Profil kapster yang dipilih tidak ditemukan di toko ini."
          : "The selected staff profile could not be found in this shop.",
      }
    }

    if (err.code === "staff_already_linked") {
      return {
        code: "staff_already_linked",
        requiresRelogin: false,
        shouldRefresh: true,
        message: isId
          ? "Profil kapster tersebut sudah terhubung dengan akun anggota lain."
          : "That staff profile is already linked to another member account.",
      }
    }

    if (err.code === "scheduling_busy") {
      return {
        code: "scheduling_busy",
        requiresRelogin: false,
        shouldRefresh: true,
        message: isId
          ? "Tidak dapat menonaktifkan sekarang karena masih ada janji temu atau antrean berjalan yang ditugaskan ke profil kapster Anda. Selesaikan atau pindahkan terlebih dahulu."
          : "Cannot disable while you still have active appointments or in-progress walk-ins assigned. Complete or reassign them first.",
      }
    }

    if (err.status === 400 || err.code === "invalid_request") {
      return {
        code: err.code || "invalid_request",
        requiresRelogin: false,
        shouldRefresh: false,
        message:
          err.message ||
          (isId
            ? "Data yang dimasukkan tidak valid. Periksa kembali kolom formulir."
            : "The submitted data is invalid. Please check the form fields."),
      }
    }

    return {
      code: err.code || "api_error",
      requiresRelogin: false,
      shouldRefresh: false,
      message:
        err.message ||
        (isId
          ? "Terjadi kesalahan saat menyimpan pengaturan kapster pemilik."
          : "Failed to save Owner-as-Barber settings."),
    }
  }

  return {
    code: "network_error",
    requiresRelogin: false,
    shouldRefresh: false,
    message: isId
      ? "Gagal terhubung ke server. Periksa koneksi internet Anda lalu coba lagi."
      : "Network error while contacting the server. Please check your connection and try again.",
  }
}

export function getSyncedStaffIdUpdate(config: OwnerBarberConfig): {
  staff_id?: number
} {
  return {
    staff_id: config.staff_id ?? undefined,
  }
}
