import type { Page } from "../../types"
import { navItems } from "../../data/team"
import { Icon } from "../ui/Icon"
import { useAuth } from "../../features/auth/AuthContext"

interface SidebarProps {
  currentPage: Page
  onSelectPage: (page: Page) => void
}

export function Sidebar({ currentPage, onSelectPage }: SidebarProps) {
  const { user, currentShop, logout } = useAuth()

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "B"

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
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`nav-item ${currentPage === item.label ? "active" : ""}`}
            onClick={() => onSelectPage(item.label)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.label === "Operations" && <b>3</b>}
          </button>
        ))}
      </nav>
      <div className="rail-foot">
        <div
          className="shop-switch"
          style={{ justifyContent: "space-between", cursor: "pointer" }}
          title={user ? `Signed in as ${user.name} (${user.email || user.phone}) · Click to view shop profile` : "Click to view shop profile"}
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
                {user?.name || "Staff"} · {currentShop?.role ? currentShop.role.toUpperCase() : "STAFF"}
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
            title="Sign out of your session"
            aria-label="Sign out"
          >
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em" }}>EXIT</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

