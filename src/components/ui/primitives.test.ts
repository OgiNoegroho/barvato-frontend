import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cn } from "../../lib/utils.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe("UI Primitives Migration to Tailwind", () => {
  it("Button.tsx defines standard variants, sizes, and states using Tailwind tokens", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "Button.tsx"), "utf8")

    // Variants
    assert.match(
      src,
      /export type ButtonVariant = "primary" \| "secondary" \| "outline" \| "ghost" \| "link" \| "danger"/,
    )
    assert.match(
      src,
      /bg-charcoal text-ivory-light border border-charcoal hover:bg-copper/,
    )
    assert.match(src, /bg-ivory-warm text-charcoal border border-stone/)
    assert.match(src, /bg-danger text-ivory-light border border-danger/)

    // Sizes
    assert.match(
      src,
      /export type ButtonSize = "sm" \| "md" \| "lg" \| "icon" \| "icon-sm"/,
    )
    assert.match(src, /h-\[38px\]/) // 38px standard height
    assert.match(src, /w-\[38px\] h-\[38px\]/) // 38px icon square
    assert.match(src, /w-\[31px\] h-\[31px\]/) // 31px mini icon square

    // States & accessibility
    assert.match(src, /isLoading/)
    assert.match(src, /aria-busy=\{isLoading\}/)
    assert.match(src, /animate-spin/)
    assert.match(src, /focus-visible:ring-copper/)
  })

  it("Input.tsx provides typed props, error and helper text, and accessible attributes", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "Input.tsx"), "utf8")

    assert.match(
      src,
      /export interface InputProps extends React\.InputHTMLAttributes<HTMLInputElement>/,
    )
    assert.match(src, /bg-ivory/)
    assert.match(src, /focus:border-copper/)
    assert.match(src, /border-danger/)
    assert.match(src, /aria-invalid=\{Boolean\(error\)\}/)
    assert.match(src, /aria-describedby/)
    assert.match(src, /leftIcon/)
    assert.match(src, /rightIcon/)
  })

  it("Select.tsx supports options array and children, native events, and accessible styles", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "Select.tsx"), "utf8")

    assert.match(src, /export interface SelectOption/)
    assert.match(
      src,
      /export interface SelectProps extends React\.SelectHTMLAttributes<HTMLSelectElement>/,
    )
    assert.match(src, /bg-ivory/)
    assert.match(src, /focus:border-copper/)
    assert.match(src, /border-danger/)
    assert.match(src, /aria-invalid=\{Boolean\(error\)\}/)
  })

  it("Badge.tsx supports both modern variant and legacy tone props for backwards compatibility", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "Badge.tsx"), "utf8")

    assert.match(
      src,
      /export type BadgeVariant = "neutral" \| "success" \| "warning" \| "danger" \| "copper"/,
    )
    assert.match(src, /tone\?: string/) // Legacy prop preserved
    assert.match(src, /bg-forest-soft/)
    assert.match(src, /bg-amber-soft/)
    assert.match(src, /bg-danger-soft/)
    assert.match(src, /bg-copper-soft/)
    assert.match(src, /className=\{cn\(/)
    assert.match(src, /"badge /) // Preserves .badge class for legacy selector compatibility
  })

  it("Card.tsx provides container and compound subcomponents with Barvato card tokens", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "Card.tsx"), "utf8")

    assert.match(src, /export const Card = forwardRef/)
    assert.match(src, /export const CardHeader = forwardRef/)
    assert.match(src, /export const CardTitle = forwardRef/)
    assert.match(src, /export const CardDescription = forwardRef/)
    assert.match(src, /export const CardContent = forwardRef/)
    assert.match(src, /export const CardFooter = forwardRef/)
    assert.match(src, /rounded-lg/)
    assert.match(src, /bg-ivory-light/)
    assert.match(src, /border-stone/)
    assert.match(src, /shadow-card/)
  })

  it("Modal.tsx provides backdrop, keyboard navigation, responsive sizes, and accessibility", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "Modal.tsx"), "utf8")

    assert.match(src, /export function Modal/)
    assert.match(src, /export const ModalHeader/)
    assert.match(src, /export const ModalTitle/)
    assert.match(src, /export const ModalDescription/)
    assert.match(src, /export const ModalBody/)
    assert.match(src, /export const ModalFooter/)
    assert.match(src, /z-modal/)
    assert.match(src, /bg-charcoal\/70/)
    assert.match(src, /max-w-\[560px\]/)
    assert.match(src, /role="dialog"/)
    assert.match(src, /aria-modal="true"/)
    assert.match(src, /e\.key === "Escape"/)
  })

  it("index.ts exports all shared primitives cleanly", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "index.ts"), "utf8")

    assert.match(src, /export \* from "\.\/Button"/)
    assert.match(src, /export \* from "\.\/Input"/)
    assert.match(src, /export \* from "\.\/Select"/)
    assert.match(src, /export \* from "\.\/Badge"/)
    assert.match(src, /export \* from "\.\/Card"/)
    assert.match(src, /export \* from "\.\/Modal"/)
    assert.match(src, /export \* from "\.\/Icon"/)
  })

  it("base.css no longer defines obsolete badge classes", () => {
    const cssPath = path.resolve(__dirname, "../../styles/base.css")
    const css = fs.readFileSync(cssPath, "utf8")

    // The legacy .badge definitions have been decommissioned from base.css
    assert.doesNotMatch(css, /^\.badge\s*\{/m)
    assert.doesNotMatch(css, /^\.badge-success\s*\{/m)
    assert.doesNotMatch(css, /^\.badge-warning\s*\{/m)
    assert.doesNotMatch(css, /^\.badge-neutral\s*\{/m)
  })
})
