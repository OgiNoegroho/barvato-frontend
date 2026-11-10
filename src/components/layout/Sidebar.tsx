import { useCallback, useEffect, useState } from "react"
import type { Page } from "../../types"
import { navItems } from "../../data/team"
import { Icon } from "../ui/Icon"
import { useAuth } from "../../features/auth/AuthContext"
import { useI18n, type TranslationKey } from "../../lib/i18n"
import { cn } from "../../lib/utils"

type NavItem = (typeof navItems)[number]

interface SidebarProps {
  currentPage: Page
  onSelectPage: (page: Page) => void
  /** Live counters per page, e.g. { Operations: 3 }. Replaces the old hardcoded "3". */
  badges?: Partial<Record<Page, number>>
  /** Mobile drawer state (below `md`). Control it from your top bar's menu button. */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const STORAGE_KEY = "barvato.sidebar.collapsed"

/* ---------- small inline icons (no dependency on Icon names) ---------- */

function ChevronIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform duration-200", flipped && "rotate-180")}
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

/* ---------- persisted collapse state ---------- */

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1"
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
    } catch {
      /* storage unavailable: state still works for this session */
    }
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed((c) => !c), [])
  return [collapsed, toggle] as const
}

/* ---------- shared focus + tooltip styles ---------- */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"

function Tooltip({ children }: { children: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-sm bg-ivory-light px-2 py-1 text-[11px] font-semibold text-charcoal opacity-0 shadow-subtle transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  )
}

/* ---------- nav button ---------- */

interface NavButtonProps {
  item: NavItem
  label: string
  active: boolean
  collapsed: boolean
  badge?: number
  onClick: () => void
}

function NavButton({ item, label, active, collapsed, badge, onClick }: NavButtonProps) {
  const hasBadge = typeof badge === "number" && badge > 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-sm py-2.5 text-left text-[13px] font-semibold transition-colors duration-150",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-charcoal-light text-ivory-light"
          : "text-stone-muted hover:bg-charcoal-light/60 hover:text-ivory-light",
        focusRing,
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-0 top-2 w-1 rounded-r bg-copper"
        />
      )}

      <span className="relative flex shrink-0 items-center justify-center">
        <Icon name={item.icon} size={18} />
        {collapsed && hasBadge && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-copper ring-2 ring-charcoal"
          />
        )}
      </span>

      {!collapsed && <span className="truncate">{label}</span>}

      {!collapsed && hasBadge && (
        <span
          className="ml-auto rounded-full bg-copper px-1.5 py-0.5 text-[10px] font-bold leading-none text-ivory-light"
          aria-label={`${badge} pending`}
        >
          {badge}
        </span>
      )}

      {collapsed && <Tooltip>{hasBadge ? `${label} (${badge})` : label}</Tooltip>}
    </button>
  )
}

/* ---------- sidebar body (used by desktop rail and mobile drawer) ---------- */

interface BodyProps {
  currentPage: Page
  badges: Partial<Record<Page, number>>
  collapsed: boolean
  onSelect: (page: Page) => void
  onClose?: () => void
}

function SidebarBody({ currentPage, badges, collapsed, onSelect, onClose }: BodyProps) {
  const { user, currentShop, logout } = useAuth()
  const { t } = useI18n()

  const initials = user?.name
    ? user.name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "B"

  const roleLabel = t(
    (currentShop?.role ? `roles.${currentShop.role}` : "roles.staff") as TranslationKey,
  )
  const shopName = currentShop?.name || "Shop"
  const userName = user?.name || t("roles.staff")

  return (
    <>
      {/* Brand */}
      <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between")}>
        <button
          type="button"
          onClick={() => onSelect("Overview")}
          aria-label="Barvato"
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-sm text-ivory-light transition-opacity hover:opacity-90",
            focusRing,
          )}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-copper font-serif text-xl font-bold shadow-subtle">
            B
          </span>
          {!collapsed && (
            <span className="font-serif text-2xl font-normal tracking-wide">BARVATO</span>
          )}
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close" as TranslationKey)}
            className={cn(
              "rounded-sm p-1.5 text-stone-muted transition-colors hover:text-ivory-light",
              focusRing,
            )}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const label = t(`nav.${item.label.toLowerCase()}` as TranslationKey)
          return (
            <NavButton
              key={item.label}
              item={item}
              label={label}
              active={currentPage === item.label}
              collapsed={collapsed}
              badge={badges[item.label as Page]}
              onClick={() => onSelect(item.label)}
            />
          )
        })}
      </nav>

      {/* Account */}
      <div className="mt-4 border-t border-charcoal-light/60 pt-4">
        <div className={cn("flex gap-1.5", collapsed ? "flex-col items-center" : "items-center")}>
          <button
            type="button"
            onClick={() => onSelect("Settings")}
            aria-label={collapsed ? `${shopName}, ${userName}, ${roleLabel}` : undefined}
            title={
              user ? `${t("common.signedInAs")} ${user.name} (${user.email || user.phone})` : undefined
            }
            className={cn(
              "group relative flex min-w-0 items-center gap-2.5 rounded-sm p-2 text-left transition-colors hover:bg-charcoal-light/60",
              collapsed ? "justify-center" : "flex-1",
              currentPage === "Settings" && "bg-charcoal-light/60",
              focusRing,
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-stone-muted/30 bg-charcoal-light text-[10px] font-bold text-ivory-light">
              {initials}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <strong className="block truncate text-xs font-bold text-ivory-light">
                  {shopName}
                </strong>
                <small className="block truncate text-[11px] text-stone-muted">
                  {userName} · {roleLabel}
                </small>
              </span>
            )}
            {collapsed && <Tooltip>{`${shopName} · ${roleLabel}`}</Tooltip>}
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-sm text-stone-muted transition-colors hover:bg-charcoal-light/60 hover:text-danger",
              focusRing,
            )}
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </>
  )
}

/* ---------- public component ---------- */

export function Sidebar({
  currentPage,
  onSelectPage,
  badges = {},
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, toggleCollapsed] = useCollapsed()
  const { t } = useI18n()

  // Mobile drawer: close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose?.()
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [mobileOpen, onMobileClose])

  const handleDesktopSelect = (page: Page) => onSelectPage(page)
  const handleMobileSelect = (page: Page) => {
    onSelectPage(page)
    onMobileClose?.()
  }

  return (
    <>
      {/* Desktop / tablet rail */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 select-none flex-col border-r border-charcoal-light/60 bg-charcoal p-3 text-ivory-light transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[248px] p-5",
        )}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("common.expandSidebar" as TranslationKey) : t("common.collapseSidebar" as TranslationKey)}
          aria-expanded={!collapsed}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 z-40 grid h-6 w-6 place-items-center rounded-full bg-charcoal text-stone-muted shadow-subtle transition-colors hover:text-ivory-light cursor-pointer",
            focusRing,
          )}
        >
          <ChevronIcon flipped={collapsed} />
        </button>

        <SidebarBody
          currentPage={currentPage}
          badges={badges}
          collapsed={collapsed}
          onSelect={handleDesktopSelect}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] select-none flex-col bg-charcoal p-5 text-ivory-light shadow-xl"
          >
            <SidebarBody
              currentPage={currentPage}
              badges={badges}
              collapsed={false}
              onSelect={handleMobileSelect}
              onClose={onMobileClose}
            />
          </aside>
        </div>
      )}
    </>
  )
}