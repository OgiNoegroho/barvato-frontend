import type { Page } from "../../types"
import { Icon } from "../ui/Icon"
import { useAuth } from "../../features/auth/AuthContext"
import { useI18n } from "../../lib/i18n"

interface TopbarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export function Topbar({ currentPage, onNavigate }: TopbarProps) {
  const { user, logout } = useAuth()
  const { t } = useI18n()

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "B"

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <span className="brand-mark">B</span>
        <strong>BARVATO</strong>
      </div>
      <div className="search">
        <Icon name="search" size={17} />
        <input
          aria-label={t("common.search")}
          placeholder={t("shell.searchPlaceholder")}
        />
        <kbd>⌘ K</kbd>
      </div>
      <div className="top-actions">
        <button className="icon-button" aria-label={t("settings.sectionNotifications")}>
          <Icon name="bell" />
          <span className="signal" />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => onNavigate("Settings")}
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
          aria-current={currentPage === "Settings" ? "page" : undefined}
        >
          <Icon name="settings" />
        </button>
        <button
          className="icon-button"
          onClick={() => void logout()}
          title={`${t("common.signedInAs")} ${user?.name || t("roles.staff")} · ${t("common.signOut")}`}
          aria-label={t("common.signOut")}
        >
          <span style={{ fontSize: "11px", fontWeight: 700 }}>{initials}</span>
        </button>
      </div>
    </header>
  )
}
