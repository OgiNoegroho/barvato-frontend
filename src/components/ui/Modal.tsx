import React, { useEffect, forwardRef } from "react"
import { cn } from "../../lib/utils"

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full"

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean
  onClose: () => void
  size?: ModalSize
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  children: React.ReactNode
}

export function Modal({
  isOpen,
  onClose,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
  className,
  ...props
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, closeOnEscape, onClose])

  if (!isOpen) return null

  const sizeStyles: Record<ModalSize, string> = {
    sm: "max-w-md",
    md: "max-w-[560px]", // Exact match for Barvato's legacy .modal max-width
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw] h-[90vh]",
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-modal bg-charcoal/70 backdrop-blur-[1px] grid place-items-center p-4 sm:p-6 overflow-y-auto"
      onMouseDown={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        className={cn(
          "modal w-full bg-ivory border border-stone shadow-modal p-6 rounded-lg text-charcoal",
          sizeStyles[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export const ModalHeader =
  forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn(
          "modal-head flex items-start justify-between gap-4 mb-6",
          className,
        )}
        {...props}
      />
    ),
  )
ModalHeader.displayName = "ModalHeader"

export const ModalTitle =
  forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
      <h2
        ref={ref}
        className={cn(
          "font-serif text-2xl sm:text-3xl font-normal text-charcoal mt-1",
          className,
        )}
        {...props}
      />
    ),
  )
ModalTitle.displayName = "ModalTitle"

export const ModalDescription =
  forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
      <p
        ref={ref}
        className={cn(
          "text-xs text-muted-text mt-1 leading-relaxed",
          className,
        )}
        {...props}
      />
    ),
  )
ModalDescription.displayName = "ModalDescription"

export const ModalBody =
  forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div ref={ref} className={cn("space-y-4", className)} {...props} />
    ),
  )
ModalBody.displayName = "ModalBody"

export const ModalFooter =
  forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn(
          "modal-actions border-t border-stone pt-4 mt-6 flex justify-end gap-2",
          className,
        )}
        {...props}
      />
    ),
  )
ModalFooter.displayName = "ModalFooter"
