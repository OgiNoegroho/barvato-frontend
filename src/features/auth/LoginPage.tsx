import React, { useState } from "react"
import { useAuth } from "./AuthContext"
import { ApiError } from "../../lib/api"
import { Icon } from "../../components/ui/Icon"
import { useI18n } from "../../lib/i18n"

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
    <div className="login-container">
      <div className="login-card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <div style={{ display: "flex", gap: "6px", fontSize: "11px" }}>
            <button
              type="button"
              onClick={() => setLanguage("id")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: language === "id" ? 700 : 400,
                color: language === "id" ? "var(--ink)" : "var(--muted)",
                textDecoration: language === "id" ? "underline" : "none",
              }}
            >
              Bahasa Indonesia
            </button>
            <span style={{ color: "var(--muted)" }}>|</span>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: language === "en" ? 700 : 400,
                color: language === "en" ? "var(--ink)" : "var(--muted)",
                textDecoration: language === "en" ? "underline" : "none",
              }}
            >
              English
            </button>
          </div>
        </div>

        <div className="login-brand">
          <span className="brand-mark large">B</span>
          <div className="brand-text">
            <h1 className="brand-title">BARVATO</h1>
            <p className="brand-subtitle">{t("nav.brandSubtitle").toUpperCase()}</p>
          </div>
        </div>

        {needsShopSelection ? (
          <div className="shop-selection-view">
            <div className="login-header">
              <h2>{language === "id" ? "Pilih Lokasi Barbershop" : "Select Shop Location"}</h2>
              <p>
                {language === "id"
                  ? "Akun Anda terhubung dengan beberapa lokasi barbershop. Pilih barbershop untuk dikelola."
                  : "Your account is associated with multiple barbershop locations. Choose a shop to manage."}
              </p>
            </div>

            {errorMessage && (
              <div className="login-error-alert" role="alert">
                <Icon name="bell" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="shop-list">
              {memberships.map((m) => (
                <button
                  key={m.shop_id}
                  type="button"
                  className="shop-card-button"
                  disabled={selectingShopId !== null}
                  onClick={() => handleSelectShop(m.shop_id)}
                >
                  <div className="shop-info">
                    <strong>{m.shop_name}</strong>
                    <span className="shop-role">{m.role.toUpperCase()}</span>
                  </div>
                  <span className="action-arrow">
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
            <div className="login-header">
              <h2>{t("auth.loginTitle")}</h2>
              <p>{t("auth.loginSubtitle")}</p>
            </div>

            {errorMessage && (
              <div className="login-error-alert" role="alert">
                <Icon name="bell" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="identifier">
                {t("auth.identityLabel")}
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  disabled={isSubmitting}
                  placeholder={t("auth.identityPlaceholder")}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="password">
                {t("auth.passwordLabel")}
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              className="primary-button login-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner" />
                  <span>{t("auth.signingIn")}</span>
                </>
              ) : (
                <span>{t("auth.signInButton")}</span>
              )}
            </button>
          </form>
        )}

        <div className="login-foot">
          <small>
            {language === "id"
              ? "Dilindungi oleh isolasi multi-tenant tingkat enterprise dan token sesi aman."
              : "Protected by enterprise multi-tenant isolation and session tokens."}
          </small>
        </div>
      </div>
    </div>
  )
}
