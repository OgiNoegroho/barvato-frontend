import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import {
  authApi,
  ApiError,
  type AuthUser,
  type CurrentShop,
  type ShopMembership,
  type LoginRequest,
  type LoginResponse,
} from "../../lib/api"

interface AuthContextValue {
  user: AuthUser | null
  currentShop: CurrentShop | null
  memberships: ShopMembership[]
  isLoading: boolean
  isAuthenticated: boolean
  needsShopSelection: boolean
  initError: string | null
  login: (credentials: LoginRequest) => Promise<LoginResponse>
  selectShop: (shopId: number) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
  retrySession: () => void
  updateCurrentShop: (updates: Partial<CurrentShop>) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [currentShop, setCurrentShop] = useState<CurrentShop | null>(null)
  const [memberships, setMemberships] = useState<ShopMembership[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [initError, setInitError] = useState<string | null>(null)

  const checkSession = useCallback(async () => {
    setIsLoading(true)
    setInitError(null)

    try {
      const data = await authApi.me()
      setUser(data.user)
      setCurrentShop(data.current_shop)
      setMemberships(data.memberships || [])
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized) {
          // Expected when no active session cookie exists: clear user state cleanly
          setUser(null)
          setCurrentShop(null)
          setMemberships([])
        } else {
          // Server error (5xx, etc.)
          setInitError(err.message || "Server error while verifying session")
        }
      } else {
        // Network connection error
        setInitError("Unable to connect to the authentication server. Please check your network connection.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    const res = await authApi.login(credentials)
    setUser(res.user)

    if (res.requires_shop_selection && res.shops) {
      setMemberships(res.shops)
      setCurrentShop(null)
    } else if (res.shop) {
      setCurrentShop(res.shop)
      setMemberships([
        {
          shop_id: res.shop.id,
          shop_name: res.shop.name,
          role: res.shop.role,
          staff_id: res.shop.staff_id,
          status: res.shop.status,
          active: true,
        },
      ])
    }

    return res
  }

  const selectShop = async (shopId: number): Promise<void> => {
    const res = await authApi.selectShop(shopId)
    setCurrentShop(res.shop)
  }

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    await authApi.changePassword(currentPassword, newPassword)
    if (user) {
      setUser({ ...user, must_change_password: false })
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setCurrentShop(null)
      setMemberships([])
    }
  }

  const updateCurrentShop = useCallback((updates: Partial<CurrentShop>) => {
    setCurrentShop((prev) => {
      if (!prev) return prev
      return { ...prev, ...updates }
    })
    setMemberships((prev) =>
      prev.map((m) =>
        (updates.id && m.shop_id === updates.id) || (currentShop && m.shop_id === currentShop.id)
          ? { ...m, ...(updates.name ? { shop_name: updates.name } : {}) }
          : m
      )
    )
  }, [currentShop])

  const isAuthenticated = user !== null && currentShop !== null
  const needsShopSelection = user !== null && currentShop === null && memberships.length > 0

  return (
    <AuthContext.Provider
      value={{
        user,
        currentShop,
        memberships,
        isLoading,
        isAuthenticated,
        needsShopSelection,
        initError,
        login,
        selectShop,
        changePassword,
        logout,
        retrySession: checkSession,
        updateCurrentShop,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
