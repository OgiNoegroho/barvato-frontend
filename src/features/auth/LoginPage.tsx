import React, { useState } from "react"
import { useAuth } from "./AuthContext"
import { ApiError } from "../../lib/api"
import { Icon } from "../../components/ui/Icon"

export function LoginPage() {
  const { login, selectShop, needsShopSelection, memberships } = useAuth()

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
      setErrorMessage("Please enter both identifier (email or phone) and password.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await login({ identifier: trimmedIdentifier, password })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimited) {
          setErrorMessage("Too many failed attempts. Please wait a minute before trying again.")
        } else if (err.isUnauthorized) {
          setErrorMessage("Invalid identifier or password. Please verify your credentials.")
        } else if (err.isForbidden) {
          setErrorMessage("Your account does not have access to an active shop.")
        } else {
          setErrorMessage(err.message || "Authentication failed. Please try again.")
        }
      } else {
        setErrorMessage("Network error: Unable to reach the server. Please check your connection.")
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
        setErrorMessage(err.message || "Failed to select shop.")
      } else {
        setErrorMessage("Network error: Failed to select shop.")
      }
    } finally {
      setSelectingShopId(null)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark large">B</span>
          <div className="brand-text">
            <h1 className="brand-title">BARVATO</h1>
            <p className="brand-subtitle">BARBERSHOP MANAGEMENT PLATFORM</p>
          </div>
        </div>

        {needsShopSelection ? (
          <div className="shop-selection-view">
            <div className="login-header">
              <h2>Select Shop Location</h2>
              <p>Your account is associated with multiple barbershop locations. Choose a shop to manage.</p>
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
                    {selectingShopId === m.shop_id ? "Entering..." : "→"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-header">
              <h2>Sign In</h2>
              <p>Enter your email or mobile number and password to access your dashboard.</p>
            </div>

            {errorMessage && (
              <div className="login-error-alert" role="alert">
                <Icon name="bell" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="identifier">
                Email or Mobile Number
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  disabled={isSubmitting}
                  placeholder="e.g. owner@example.com or +628123456789"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder="Enter your password"
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
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </button>
          </form>
        )}

        <div className="login-foot">
          <small>Protected by enterprise multi-tenant isolation and session tokens.</small>
        </div>
      </div>
    </div>
  )
}
