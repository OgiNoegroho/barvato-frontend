import type { Page } from "../../types"
import { navItems } from "../../data/team"
import { Icon } from "../ui/Icon"
import { useI18n, type TranslationKey } from "../../lib/i18n"

interface MobileNavProps {
  currentPage: Page
  onSelectPage: (page: Page) => void
}

export function MobileNav({ currentPage, onSelectPage }: MobileNavProps) {
  const { t } = useI18n()

  return (
    <nav className="mobile-nav">
      {navItems.slice(0, 5).map((item) => {
        const navKey = `nav.${item.label.toLowerCase()}` as TranslationKey
        return (
          <button
            key={item.label}
            className={currentPage === item.label ? "active" : ""}
            onClick={() => onSelectPage(item.label)}
          >
            <Icon name={item.icon} />
            <span>{t(navKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
