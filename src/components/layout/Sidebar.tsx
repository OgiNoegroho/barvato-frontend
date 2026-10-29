import type { Page } from "../../types"
import { navItems } from "../../data/team"
import { Icon } from "../ui/Icon"
import { useAuth } from "../../features/auth/AuthContext"
import { useI18n, type TranslationKey } from "../../lib/i18n"

interface SidebarProps {
  currentPage: Page
  onSelectPage: (page: Page) => void
}

export function Sidebar({ currentPage, onSelectPage }: SidebarProps) {
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
    <aside className="rail">
      <button
        className="brand"
        aria-label="Barvato"
        onClick={() => onSelectPage("Overview")}
      >
        <span className="brand-mark">B</span>
        <span className="brand-word">BARVATO</span>
      </button>
      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map((item) => {
          const navKey = `nav.${item.label.toLowerCase()}` as TranslationKey
          const label = t(navKey)
          return (
            <button
              key={item.label}
              className={`nav-item ${currentPage === item.label ? "active" : ""}`}
              onClick={() => onSelectPage(item.label)}
            >
              <Icon name={item.icon} />
              <span>{label}</span>
              {item.label === "Operations" && <b>3</b>}
            </button>
          )
        })}
      </nav>
      <div className="rail-foot">
        <div
          className="shop-switch"
          style={{ justifyContent: "space-between", cursor: "pointer" }}
          title={user ? `${t("common.signedInAs")} ${user.name} (${user.email || user.phone})` : ""}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
            <span className="avatar small">{initials}</span>
            <span style={{ minWidth: 0, overflow: "hidden" }}>
              <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {currentShop?.name || "Shop"}
              </strong>
              <small style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {user?.name || t("roles.staff")} · {roleLabel}
              </small>
            </span>
          </div>
          <button
            type="button"
            className="logout-button"
            onClick={(e) => {
              e.stopPropagation()
              void logout()
            }}
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em" }}>{t("common.exit")}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

