import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { cn } from "./utils.ts"

describe("cn utility helper", () => {
  it("combines class strings cleanly", () => {
    assert.equal(cn("btn", "btn-primary"), "btn btn-primary")
  })

  it("handles conditional class values", () => {
    const isPrimary = true
    const isSmall = false
    assert.equal(
      cn("btn", isPrimary && "btn-primary", isSmall && "btn-sm"),
      "btn btn-primary",
    )
  })

  it("resolves conflicting Tailwind utility classes using tailwind-merge", () => {
    // p-4 should override p-2
    assert.equal(cn("p-2", "p-4"), "p-4")
    // text-copper should override text-charcoal
    assert.equal(cn("text-charcoal", "text-copper"), "text-copper")
  })

  it("handles arrays and nested conditionals", () => {
    assert.equal(
      cn(["base", false, "extra"], { active: true, disabled: false }),
      "base extra active",
    )
  })

  it("safely handles Barvato design token classes and stacking utilities", () => {
    const classes = cn(
      "bg-charcoal",
      "text-ivory-light",
      "border-stone",
      "font-serif",
      "rounded-lg",
      "shadow-modal",
      "z-toast",
    )
    assert.equal(
      classes,
      "bg-charcoal text-ivory-light border-stone font-serif rounded-lg shadow-modal z-toast",
    )
  })
})
