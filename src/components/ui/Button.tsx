import React, { forwardRef } from "react"
import { cn } from "../../lib/utils"

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "link" | "danger"
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  icon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      icon,
      type = "button",
      ...props
    },
    ref,
  ) => {
    // Base styles: consistent typography, alignment, focus ring, and disabled state
    const baseStyles =
      "inline-flex items-center justify-center font-sans font-semibold transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"

    // Variant styles using Barvato design tokens
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        "bg-charcoal text-ivory-light border border-charcoal hover:bg-copper hover:border-copper active:bg-copper-hover disabled:hover:bg-charcoal disabled:hover:border-charcoal shadow-subtle",
      secondary:
        "bg-ivory-warm text-charcoal border border-stone hover:bg-stone/40 hover:border-stone-muted active:bg-stone/60 disabled:hover:bg-ivory-warm shadow-subtle",
      outline:
        "bg-ivory-light text-charcoal border border-stone hover:border-copper/70 hover:bg-ivory active:bg-ivory-warm disabled:hover:bg-ivory-light disabled:hover:border-stone shadow-subtle",
      ghost:
        "bg-transparent text-charcoal border border-transparent hover:bg-ivory-warm/70 active:bg-ivory-warm disabled:hover:bg-transparent",
      link: "bg-transparent text-charcoal border-0 border-b border-charcoal rounded-none p-0 h-auto font-semibold hover:text-copper hover:border-copper disabled:hover:text-charcoal disabled:hover:border-charcoal",
      danger:
        "bg-danger text-ivory-light border border-danger hover:bg-danger/90 active:bg-danger/80 disabled:hover:bg-danger shadow-subtle",
    }

    // Size styles calibrated to Barvato's visual hierarchy
    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs gap-1.5 rounded-sm",
      md: "h-[38px] px-4 text-xs gap-2 rounded-sm", // Standard 38px height matching primary-button
      lg: "h-11 px-5 text-sm gap-2.5 rounded-sm",
      icon: "w-[38px] h-[38px] p-0 rounded-sm grid place-items-center", // Standard 38px square matching icon-button
      "icon-sm": "w-[31px] h-[31px] p-0 rounded-sm grid place-items-center", // Mini 31px square matching icon-button.mini
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
        ) : (
          icon && (
            <span className="shrink-0 flex items-center justify-center">
              {icon}
            </span>
          )
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = "Button"
