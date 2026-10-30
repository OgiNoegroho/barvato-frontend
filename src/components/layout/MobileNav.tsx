import type { Page } from "../../types"
import { navItems } from "../../data/team"
import { Icon } from "../ui/Icon"
import { useI18n, type TranslationKey } from "../../lib/i18n"
import { cn } from "../../lib/utils"

interface MobileNavProps {
  currentPage: Page
  onSelectPage: (page: Page) => void
}

export function MobileNav({ currentPage, onSelectPage }: MobileNavProps) {
  const { t } = useI18n()

  return (
    <nav
      className={cn(
        "mobile-nav",
        "md:hidden fixed bottom-0 left-0 right-0 z-sticky grid grid-cols-5 bg-charcoal border-t border-charcoal-light/80 pb-[env(safe-area-inset-bottom,0px)] shadow-modal select-none",
      )}
      aria-label="Mobile navigation"
    >
      {navItems.slice(0, 5).map((item) => {
        const navKey = `nav.${item.label.toLowerCase()}` as TranslationKey
        const isActive = currentPage === item.label

        return (
          <button
            key={item.label}
            type="button"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2.5 px-1 bg-transparent border-0 text-2xs font-medium transition-colors cursor-pointer",
              isActive
                ? "active text-copper font-bold"
                : "text-stone-muted hover:text-ivory-light",
            )}
            onClick={() => onSelectPage(item.label)}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon name={item.icon} size={18} />
            <span className="truncate max-w-full text-[10px]">{t(navKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
