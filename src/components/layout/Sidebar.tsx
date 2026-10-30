import type { Page } from "../../types"
import { navItems } from "../../data/team"
import { Icon } from "../ui/Icon"
import { useAuth } from "../../features/auth/AuthContext"
import { useI18n, type TranslationKey } from "../../lib/i18n"
import { cn } from "../../lib/utils"

interface SidebarProps {
  currentPage: Page
  onSelectPage: (page: Page) => void
}

export function Sidebar({
  currentPage,
  onSelectPage,
}: SidebarProps) {
  const { user, currentShop, logout } = useAuth()
  const { t } = useI18n()

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "B"

  const roleLabel = currentShop?.role
    ? t(`roles.${currentShop.role}` as TranslationKey).toUpperCase()
    : t("roles.staff").toUpperCase()

  return (
    <aside
      className={cn(
        "rail",
        "w-[68px] xl:w-[220px] hidden md:flex flex-col justify-between p-3.5 xl:p-6 bg-charcoal text-ivory-light shrink-0 h-screen sticky top-0 border-r border-charcoal-light/60 z-30 transition-all select-none",
      )}
    >
      <button
        type="button"
        className={cn(
          "brand",
          "flex items-center gap-3 text-left w-full border-0 bg-transparent cursor-pointer p-0 mb-6 text-ivory-light hover:opacity-95 transition-opacity",
        )}
        aria-label="Barvato"
        onClick={() => onSelectPage("Overview")}
      >
        <span
          className={cn(
            "brand-mark",
            "w-9 h-9 rounded-full bg-copper text-ivory-light grid place-items-center font-serif text-xl font-bold shrink-0 shadow-subtle",
          )}
        >
          B
        </span>
        <span
          className={cn(
            "brand-word",
            "font-serif text-2xl tracking-wide font-normal text-ivory-light hidden xl:inline",
          )}
        >
          BARVATO
        </span>
      </button>

      <nav
        className={cn("nav-list", "flex flex-col gap-1 w-full my-auto")}
        aria-label="Primary navigation"
      >
        {navItems.map((item) => {
          const navKey = `nav.${item.label.toLowerCase()}` as TranslationKey
          const label = t(navKey)
          const isActive = currentPage === item.label

          return (
            <button
              key={item.label}
              type="button"
              className={cn(
                "nav-item",
                "flex items-center gap-3 w-full px-2.5 xl:px-3 py-2.5 rounded-sm text-xs font-semibold transition-colors duration-150 text-stone-muted hover:text-ivory-light hover:bg-charcoal-light/60 relative text-left cursor-pointer",
                isActive &&
                  "active bg-charcoal-light text-ivory-light before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-copper before:rounded-r",
              )}
              onClick={() => onSelectPage(item.label)}
              title={label}
            >
              <i className="nav-icon shrink-0 not-italic flex items-center justify-center pointer-events-none">
                <Icon name={item.icon} size={18} />
              </i>
              <span className="nav-label hidden xl:inline truncate pointer-events-none">
                {label}
              </span>
              {item.label === "Operations" && (
                <b className="hidden xl:inline ml-auto bg-copper text-ivory-light text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
                  3
                </b>
              )}
            </button>
          )
        })}
      </nav>

      <div
        className={cn(
          "rail-foot",
          "mt-auto pt-4 border-t border-charcoal-light/60",
        )}
      >
        <div
          className={cn(
            "shop-switch",
            "flex items-center justify-between gap-2 p-2 rounded-sm bg-charcoal-light/40 hover:bg-charcoal-light border border-stone-muted/15 transition-colors cursor-pointer text-left",
          )}
          title={
            user
              ? `${t("common.signedInAs")} ${user.name} (${user.email || user.phone})`
              : ""
          }
          onClick={() => onSelectPage("Settings")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelectPage("Settings")
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="avatar w-7 h-7 rounded-full bg-charcoal-light text-ivory-light text-[9px] font-bold grid place-items-center shrink-0 border border-stone-muted/30">
              {initials}
            </span>
            <div className="foot-label min-w-0 overflow-hidden hidden xl:block">
              <strong className="block text-xs font-bold text-ivory-light truncate">
                {currentShop?.name || "Shop"}
              </strong>
              <small className="block text-[10px] text-stone-muted truncate">
                {user?.name || t("roles.staff")} · {roleLabel}
              </small>
            </div>
          </div>

          <button
            type="button"
            className="logout-button hidden xl:inline-flex items-center justify-center p-1 rounded text-stone-muted hover:text-danger transition-colors bg-transparent border-0 shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              void logout()
            }}
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
          >
            <span className="text-[10px] font-bold tracking-wider">
              {t("common.exit")}
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}
