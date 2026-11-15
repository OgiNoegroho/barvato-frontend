import { Button } from "../../components/ui/Button"
import { cn } from "../../lib/utils"
import {
  buildGoogleStartURL,
  isGoogleAuthClientEnabled,
  type GoogleAuthIntent,
} from "../../lib/googleAuth"

export { buildGoogleStartURL, isGoogleAuthClientEnabled, type GoogleAuthIntent }

export interface GoogleAuthButtonProps {
  intent: GoogleAuthIntent
  label: string
  loadingLabel: string
  isLoading: boolean
  disabled?: boolean
  variant?: "secondary" | "outline"
  onInitiate: (intent: GoogleAuthIntent) => void
  className?: string
}

export function GoogleAuthButton({
  intent,
  label,
  loadingLabel,
  isLoading,
  disabled = false,
  variant = "outline",
  onInitiate,
  className,
}: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      disabled={disabled || isLoading}
      isLoading={isLoading}
      onClick={() => onInitiate(intent)}
      data-google-intent={intent}
      className={cn(
        "w-full h-[42px] text-xs font-medium tracking-wide bg-ivory border-stone text-charcoal hover:bg-ivory-warm",
        className,
      )}
    >
      {!isLoading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3.01h3.88c2.27-2.09 3.54-5.17 3.54-8.83z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.01c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1C3.25 21.32 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29v-3.1H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.68 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75z"
          />
        </svg>
      )}
      <span>{isLoading ? loadingLabel : label}</span>
    </Button>
  )
}
