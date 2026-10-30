import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "copper"
export type BadgeSize = "sm" | "md"

export interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  tone?: string // Legacy prop for backwards compatibility
  size?: BadgeSize
  className?: string
}

export function Badge({
  children,
  variant,
  tone = "neutral",
  size = "sm",
  className,
}: BadgeProps) {
  // Normalize tone vs variant
  const activeVariant: BadgeVariant = (variant ||
    tone ||
    "neutral") as BadgeVariant

  const variantStyles: Record<BadgeVariant, string> = {
    neutral: "bg-ivory border-stone text-muted-text",
    success: "bg-forest-soft border-[#c5d5c8] text-forest",
    warning: "bg-amber-soft border-[#dfcca9] text-amber-dark",
    danger: "bg-danger-soft border-danger-line text-danger",
    copper: "bg-copper-soft border-copper/30 text-copper",
  }

  const sizeStyles: Record<BadgeSize, string> = {
    sm: "px-2 py-0.5 text-2xs",
    md: "px-2.5 py-1 text-xs",
  }

  return (
    <span
      className={cn(
        "badge inline-flex items-center justify-center font-sans font-bold uppercase tracking-wider rounded-full border whitespace-nowrap",
        variantStyles[activeVariant] || variantStyles.neutral,
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
