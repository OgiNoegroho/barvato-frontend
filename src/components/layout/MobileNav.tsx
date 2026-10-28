import type { Page } from "../../types"
import { navItems } from "../../data/team"
import { Icon } from "../ui/Icon"

interface MobileNavProps {
  currentPage: Page
  onSelectPage: (page: Page) => void
}

export function MobileNav({ currentPage, onSelectPage }: MobileNavProps) {
  return (
    <nav className="mobile-nav">
      {navItems.slice(0, 5).map((item) => (
        <button
          key={item.label}
          className={currentPage === item.label ? "active" : ""}
          onClick={() => onSelectPage(item.label)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
