import React, { useState } from "react"
import { useAuth } from "./AuthContext"
import { ApiError } from "../../lib/api"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { useI18n } from "../../lib/i18n"
import { cn } from "../../lib/utils"

export function LoginPage() {
  const { login, selectShop, needsShopSelection, memberships } = useAuth()
  const { t, language, setLanguage } = useI18n()

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectingShopId, setSelectingShopId] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier || !password) {
      setErrorMessage(
        language === "id"
          ? "Harap masukkan identitas (email atau nomor telepon) dan kata sandi."
          : "Please enter both identifier (email or phone) and password."
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await login({ identifier: trimmedIdentifier, password })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimited) {
          setErrorMessage(
            language === "id"
              ? "Terlalu banyak percobaan gagal. Silakan tunggu 1 menit sebelum mencoba lagi."
              : "Too many failed attempts. Please wait a minute before trying again."
          )
        } else if (err.isUnauthorized) {
          setErrorMessage(
            language === "id"
              ? "Identitas atau kata sandi tidak valid. Periksa kembali data login Anda."
              : "Invalid identifier or password. Please verify your credentials."
          )
        } else if (err.isForbidden) {
          setErrorMessage(
            language === "id"
              ? "Akun Anda tidak memiliki akses ke barbershop aktif."
              : "Your account does not have access to an active shop."
          )
        } else {
          setErrorMessage(
            err.message ||
              (language === "id"
                ? "Autentikasi gagal. Silakan coba lagi."
                : "Authentication failed. Please try again.")
          )
        }
      } else {
        setErrorMessage(
          language === "id"
            ? "Kesalahan jaringan: Gagal menghubungi server. Periksa koneksi internet Anda."
            : "Network error: Unable to reach the server. Please check your connection."
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelectShop = async (shopId: number) => {
    if (selectingShopId !== null) return
    setSelectingShopId(shopId)
    setErrorMessage(null)

    try {
      await selectShop(shopId)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(
          err.message ||
            (language === "id" ? "Gagal memilih barbershop." : "Failed to select shop.")
        )
      } else {
        setErrorMessage(
          language === "id"
            ? "Kesalahan jaringan: Gagal memilih barbershop."
            : "Network error: Failed to select shop."
        )
      }
    } finally {
      setSelectingShopId(null)
    }
  }

  return (
    <div className="login-container min-h-screen grid place-items-center bg-ivory p-4 sm:p-6">
      <div className="login-card w-full max-w-[440px] bg-ivory-light border border-stone shadow-modal rounded-sm p-6 sm:p-8">
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setLanguage("id")}
              className={cn(
                "bg-transparent border-0 cursor-pointer p-0 text-xs transition-colors",
                language === "id" ? "font-bold text-charcoal underline" : "text-muted-text hover:text-charcoal"
              )}
            >
              Bahasa Indonesia
            </button>
            <span className="text-muted-text/50">|</span>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={cn(
                "bg-transparent border-0 cursor-pointer p-0 text-xs transition-colors",
                language === "en" ? "font-bold text-charcoal underline" : "text-muted-text hover:text-charcoal"
              )}
            >
              English
            </button>
          </div>
        </div>

        <div className="login-brand flex items-center gap-4 pb-5 mb-6 border-b border-stone">
          <span className="brand-mark large w-12 h-12 rounded-full bg-copper text-white grid place-items-center font-serif text-2xl font-bold shrink-0">
            B
          </span>
          <div className="brand-text">
            <h1 className="brand-title font-serif text-[22px] leading-tight text-charcoal m-0 tracking-wide">
              BARVATO
            </h1>
            <p className="brand-subtitle text-[9px] tracking-widest text-muted-text font-bold mt-0.5 m-0">
              {t("nav.brandSubtitle").toUpperCase()}
            </p>
          </div>
        </div>

        {needsShopSelection ? (
          <div className="shop-selection-view">
            <div className="login-header mb-5">
              <h2 className="font-serif text-2xl text-charcoal m-0 mb-1.5">
                {language === "id" ? "Pilih Lokasi Barbershop" : "Select Shop Location"}
              </h2>
              <p className="text-xs text-muted-text leading-relaxed m-0">
                {language === "id"
                  ? "Akun Anda terhubung dengan beberapa lokasi barbershop. Pilih barbershop untuk dikelola."
                  : "Your account is associated with multiple barbershop locations. Choose a shop to manage."}
              </p>
            </div>

            {errorMessage && (
              <div className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-4 leading-normal" role="alert">
                <Icon name="bell" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="shop-list flex flex-col gap-2.5 mb-4">
              {memberships.map((m) => (
                <button
                  key={m.shop_id}
                  type="button"
                  className="shop-card-button w-full p-3.5 sm:px-4 bg-ivory border border-stone rounded-sm flex justify-between items-center cursor-pointer text-left transition-all hover:not-disabled:border-copper hover:not-disabled:bg-ivory-warm hover:not-disabled:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait"
                  disabled={selectingShopId !== null}
                  onClick={() => handleSelectShop(m.shop_id)}
                >
                  <div className="shop-info flex flex-col">
                    <strong className="text-sm font-semibold text-charcoal">{m.shop_name}</strong>
                    <span className="shop-role text-[9px] font-bold tracking-wider text-copper uppercase mt-0.5">{m.role}</span>
                  </div>
                  <span className="action-arrow text-base text-muted-text font-medium">
                    {selectingShopId === m.shop_id
                      ? language === "id"
                        ? "Memasuki..."
                        : "Entering..."
                      : "→"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-header mb-5">
              <h2 className="font-serif text-2xl text-charcoal m-0 mb-1.5">{t("auth.loginTitle")}</h2>
              <p className="text-xs text-muted-text leading-relaxed m-0">{t("auth.loginSubtitle")}</p>
            </div>

            {errorMessage && (
              <div className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-4 leading-normal" role="alert">
                <Icon name="bell" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-4 mb-5">
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                label={t("auth.identityLabel")}
                placeholder={t("auth.identityPlaceholder")}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />

              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                label={t("auth.passwordLabel")}
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="login-button w-full h-[42px] mt-2 text-xs tracking-wider"
            >
              {isSubmitting ? t("auth.signingIn") : t("auth.signInButton")}
            </Button>
          </form>
        )}

        <div className="login-foot mt-6 pt-4 border-t border-stone text-center">
          <small className="text-[9px] text-muted-text leading-normal block">
            {language === "id"
              ? "Dilindungi oleh isolasi multi-tenant tingkat enterprise dan token sesi aman."
              : "Protected by enterprise multi-tenant isolation and session tokens."}
          </small>
        </div>
      </div>
    </div>
  )
}
