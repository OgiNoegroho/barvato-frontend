import type { Page } from "../../types"
import { Icon } from "../ui/Icon"
import { useAuth } from "../../features/auth/AuthContext"

interface TopbarProps {
  currentPage: Page
  onOpenModal: (kind: "appointment" | "walkin") => void
}

export function Topbar({ currentPage, onOpenModal }: TopbarProps) {
  const isOperations = currentPage === "Operations"
  const { user, logout } = useAuth()

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
          aria-label="Search"
          placeholder="Search clients, appointments..."
        />
        <kbd>⌘ K</kbd>
      </div>
      <div className="top-actions">
        <button className="icon-button" aria-label="Notifications">
          <Icon name="bell" />
          <span className="signal" />
        </button>
        <button
          className="primary-button"
          onClick={() => onOpenModal(isOperations ? "walkin" : "appointment")}
        >
          <Icon name="plus" size={17} />
          {isOperations ? "Walk-in" : "New booking"}
        </button>
        <button
          className="icon-button"
          onClick={() => void logout()}
          title={`Signed in as ${user?.name || "Staff"} · Click to sign out`}
          aria-label="Sign out"
        >
          <span style={{ fontSize: "11px", fontWeight: 700 }}>{initials}</span>
        </button>
      </div>
    </header>
  )
}
