import React, { forwardRef, useId } from "react"
import { cn } from "../../lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      fullWidth = true,
      leftIcon,
      rightIcon,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id || (label ? generatedId : undefined)
    const errorId = error ? `${inputId}-error` : undefined
    const helperId = helperText ? `${inputId}-helper` : undefined

    return (
      <div
        className={cn(
          "flex flex-col gap-1.5",
          fullWidth ? "w-full" : "inline-flex",
        )}
      >
        {label && (
          <label
            htmlFor={inputId}
            className="text-2xs font-bold uppercase tracking-wider text-charcoal select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <span className="absolute left-3 text-muted-text pointer-events-none flex items-center justify-center">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              "h-10 w-full rounded-sm border bg-ivory px-3 text-sm text-charcoal placeholder:text-muted-text/70 font-sans transition-colors duration-150",
              "focus:outline-none focus:bg-ivory-light focus:border-copper focus:ring-1 focus:ring-copper",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-ivory-warm",
              error
                ? "border-danger focus:border-danger focus:ring-danger"
                : "border-stone",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              className,
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 text-muted-text flex items-center justify-center">
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            className="text-2xs font-semibold text-danger leading-tight"
          >
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-2xs text-muted-text leading-tight">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"
