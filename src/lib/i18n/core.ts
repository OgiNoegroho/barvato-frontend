import type { Language, TranslationKey } from "./types"
import { idTranslations } from "./translations/id.ts"
import { enTranslations } from "./translations/en.ts"

export const STORAGE_KEY = "barvato_language"
export const DEFAULT_LANGUAGE: Language = "id"

export const TRANSLATION_MAP: Record<Language, Record<TranslationKey, string>> = {
  id: idTranslations,
  en: enTranslations,
}

export function isValidLanguage(val: unknown): val is Language {
  return val === "id" || val === "en"
}

export function getStoredLanguage(): Language {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (isValidLanguage(stored)) {
        return stored
      }
    }
  } catch {
    // localStorage might be inaccessible (e.g. private browsing or Node.js)
  }
  return DEFAULT_LANGUAGE
}

export function setStoredLanguage(lang: Language): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang)
    }
  } catch {
    // Ignore storage write errors
  }
}

export function translate(
  lang: Language,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const dict = TRANSLATION_MAP[lang] || TRANSLATION_MAP[DEFAULT_LANGUAGE]
  let text = dict[key] || TRANSLATION_MAP[DEFAULT_LANGUAGE][key] || key

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    })
  }

  return text
}

