import React, { forwardRef, useId } from "react"
import { cn } from "../../lib/utils"

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  options?: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      fullWidth = true,
      options,
      children,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const selectId = id || (label ? generatedId : undefined)
    const errorId = error ? `${selectId}-error` : undefined
    const helperId = helperText ? `${selectId}-helper` : undefined

    return (
      <div
        className={cn(
          "flex flex-col gap-1.5",
          fullWidth ? "w-full" : "inline-flex",
        )}
      >
        {label && (
          <label
            htmlFor={selectId}
            className="text-2xs font-bold uppercase tracking-wider text-charcoal select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              "h-10 w-full appearance-none rounded-sm border bg-ivory px-3 pr-8 text-sm text-charcoal font-sans transition-colors duration-150 cursor-pointer",
              "focus:outline-none focus:bg-ivory-light focus:border-copper focus:ring-1 focus:ring-copper",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-ivory-warm",
              error
                ? "border-danger focus:border-danger focus:ring-danger"
                : "border-stone",
              className,
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Clean minimal dropdown caret */}
          <span className="pointer-events-none absolute right-3 flex items-center text-muted-text">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
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

Select.displayName = "Select"
