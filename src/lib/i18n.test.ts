import test from "node:test"
import assert from "node:assert/strict"
import { isValidLanguage, getStoredLanguage, translate } from "./i18n/core.ts"
import { idTranslations } from "./i18n/translations/id.ts"
import { enTranslations } from "./i18n/translations/en.ts"
import { formatRupiah, formatMinutesAgo, formatDateHeading, formatPeriodLabel } from "./format.ts"
import type { TranslationKey } from "./i18n/types.ts"

test("i18n infrastructure and translation validation", async (t) => {
  await t.test("language validity checks", () => {
    assert.equal(isValidLanguage("id"), true)
    assert.equal(isValidLanguage("en"), true)
    assert.equal(isValidLanguage("fr"), false)
    assert.equal(isValidLanguage(null), false)
    assert.equal(isValidLanguage(undefined), false)
    assert.equal(isValidLanguage(123), false)
  })

  await t.test("default language is 'id' when storage is empty or invalid", () => {
    assert.equal(getStoredLanguage(), "id")
  })

  await t.test("dictionaries are 100% symmetric with no missing keys", () => {
    const idKeys = Object.keys(idTranslations).sort() as TranslationKey[]
    const enKeys = Object.keys(enTranslations).sort() as TranslationKey[]

    assert.deepEqual(
      idKeys,
      enKeys,
      "Indonesian and English dictionaries must have the exact same set of translation keys"
    )

    for (const key of idKeys) {
      assert.ok(
        idTranslations[key] && idTranslations[key].trim().length > 0,
        `Indonesian translation for ${key} must not be empty`
      )
      assert.ok(
        enTranslations[key] && enTranslations[key].trim().length > 0,
        `English translation for ${key} must not be empty`
      )
    }
  })

  await t.test("translation interpolation works correctly", () => {
    const interpolatedId = translate("id", "shell.goodDay", { name: "Budi" })
    assert.equal(interpolatedId, "Selamat beraktivitas, Budi.")

    const interpolatedEn = translate("en", "shell.goodDay", { name: "Budi" })
    assert.equal(interpolatedEn, "Good day, Budi.")
  })

  await t.test("Rupiah currency formatting strictly remains in IDR", () => {
    const formatted = formatRupiah(75000)
    assert.ok(
      formatted.includes("Rp") || formatted.includes("IDR"),
      "formatRupiah must format currency as Indonesian Rupiah"
    )
    assert.ok(formatted.includes("75"), "formatRupiah must contain the amount digits")
  })

  await t.test("formatMinutesAgo supports both Indonesian and English", () => {
    const nowIso = new Date().toISOString()
    assert.equal(formatMinutesAgo(nowIso, "id"), "Baru tiba")
    assert.equal(formatMinutesAgo(nowIso, "en"), "Just arrived")

    const fiveMinAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    assert.equal(formatMinutesAgo(fiveMinAgoIso, "id"), "5 mnt lalu")
    assert.equal(formatMinutesAgo(fiveMinAgoIso, "en"), "5 mins ago")
  })

  await t.test("formatDateHeading and formatPeriodLabel accept locale parameter", () => {
    const fixedDate = new Date("2026-10-29T10:00:00Z")
    const idHeading = formatDateHeading(fixedDate, "Asia/Jakarta", "id-ID")
    const enHeading = formatDateHeading(fixedDate, "Asia/Jakarta", "en-US")

    assert.ok(idHeading.length > 0)
    assert.ok(enHeading.length > 0)

    const idPeriod = formatPeriodLabel(fixedDate, "Month", "Asia/Jakarta", "id-ID")
    const enPeriod = formatPeriodLabel(fixedDate, "Month", "Asia/Jakarta", "en-US")

    assert.ok(idPeriod.length > 0)
    assert.ok(enPeriod.length > 0)
    assert.ok(idPeriod.toLowerCase().includes("oktober"))
    assert.ok(enPeriod.toLowerCase().includes("october"))
  })
})
