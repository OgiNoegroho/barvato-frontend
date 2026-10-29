import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import type { Language, TranslationKey, I18nContextValue } from "./types"
import {
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  setStoredLanguage,
  isValidLanguage,
  translate,
} from "./core"

export {
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  setStoredLanguage,
  isValidLanguage,
  translate,
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage())

  const setLanguage = useCallback((newLang: Language) => {
    if (!isValidLanguage(newLang)) return
    setLanguageState(newLang)
    setStoredLanguage(newLang)
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLang === "id" ? "id" : "en"
    }
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language === "id" ? "id" : "en"
    }
  }, [language])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      return translate(language, key, params)
    },
    [language]
  )

  const locale = language === "id" ? "id-ID" : "en-US"

  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
      const d = typeof date === "string" ? new Date(date) : date
      if (isNaN(d.getTime())) return ""
      return new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Jakarta",
        ...options,
      }).format(d)
    },
    [locale]
  )

  const formatTime = useCallback(
    (date: Date | string): string => {
      const d = typeof date === "string" ? new Date(date) : date
      if (isNaN(d.getTime())) return ""
      return d.toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      })
    },
    [locale]
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      formatDate,
      formatTime,
    }),
    [language, setLanguage, t, formatDate, formatTime]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}

export type { Language, TranslationKey, I18nContextValue }
