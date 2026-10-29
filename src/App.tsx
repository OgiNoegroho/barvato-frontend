import { useState } from "react"
import type { Page } from "./types"
import { useToast } from "./hooks/useToast"
import { Icon } from "./components/ui/Icon"
import { Sidebar } from "./components/layout/Sidebar"
import { Topbar } from "./components/layout/Topbar"
import { MobileNav } from "./components/layout/MobileNav"
import { Toast } from "./components/layout/Toast"
import { BookingModal } from "./components/BookingModal"
import { OverviewPage } from "./features/overview/OverviewPage"
import { OperationsPage } from "./features/operations/OperationsPage"
import { AppointmentsPage } from "./features/appointments/AppointmentsPage"
import { TeamPage } from "./features/team/TeamPage"
import { MoneyPage } from "./features/money/MoneyPage"
import { SettingsPage } from "./features/settings/SettingsPage"
import { AuthProvider, useAuth } from "./features/auth/AuthContext"
import { LoginPage } from "./features/auth/LoginPage"
import { ChangePasswordModal } from "./features/auth/ChangePasswordModal"
import { I18nProvider, useI18n, type TranslationKey } from "./lib/i18n"

function AppShell() {
  const { user, currentShop, isLoading, isAuthenticated, initError, retrySession } = useAuth()
  const { t } = useI18n()
  const [page, setPage] = useState<Page>("Overview")
  const [modal, setModal] = useState<
    "appointment" | "walkin" | { kind: "appointment"; initialDate?: string } | null
  >(null)
  const { toast, notify } = useToast()

  if (isLoading) {
    return (
      <div className="session-status-screen">
        <div className="session-status-card">
          <span className="brand-mark large" style={{ margin: "0 auto 16px" }}>
            B
          </span>
          <h2>BARVATO</h2>
          <p>{t("auth.verifyingSession")}</p>
          <div className="loading-spinner large" />
        </div>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="session-status-screen">
        <div className="session-status-card">
          <span
            className="brand-mark large"
            style={{ margin: "0 auto 16px", background: "var(--danger)" }}
          >
            !
          </span>
          <h2>{t("auth.connectionInterrupted")}</h2>
          <p>{initError}</p>
          <button
            type="button"
            className="primary-button"
            onClick={retrySession}
            style={{ width: "100%" }}
          >
            {t("common.retryConnection")}
          </button>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (user?.must_change_password) {
    return <ChangePasswordModal />
  }

  const pageNavKey = `nav.${page.toLowerCase()}` as TranslationKey
  const translatedPageName = t(pageNavKey)

  const roleText = currentShop?.role
    ? t(`roles.${currentShop.role}` as TranslationKey).toUpperCase()
    : t("roles.staff").toUpperCase()

  const title =
    page === "Overview"
      ? t("shell.goodDay", { name: user?.name || "Elias" })
      : translatedPageName

  const subtitle =
    page === "Overview"
      ? `${currentShop?.name || "Shop"} · ${roleText}`
      : page === "Operations"
        ? t("shell.liveScheduleSubtitle")
        : t("shell.manageSubtitle", {
            page: translatedPageName.toLowerCase(),
            shop: currentShop?.name || "Shop",
          })

  return (
    <div className="app-shell">
      <Sidebar currentPage={page} onSelectPage={setPage} />

      <main>
        <Topbar currentPage={page} onOpenModal={setModal} />

        <section className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {currentShop?.name ? currentShop.name.toUpperCase() : "SHOP"} / {translatedPageName.toUpperCase()}
              </p>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {page === "Overview" && (
              <button
                className="text-button"
                onClick={() => setPage("Operations")}
              >
                {t("shell.openOperations")} <Icon name="arrow" size={16} />
              </button>
            )}
          </div>

          {page === "Overview" && (
            <OverviewPage
              onSchedule={() => setPage("Operations")}
              onQueue={() => setPage("Operations")}
              onNew={() => setModal("walkin")}
            />
          )}
          {page === "Operations" && (
            <OperationsPage
              onWalkin={() => setModal("walkin")}
              onAppointment={(initialDate) => setModal({ kind: "appointment", initialDate })}
              notify={notify}
            />
          )}
          {page === "Appointments" && <AppointmentsPage />}
          {page === "Team" && <TeamPage />}
          {page === "Money" && <MoneyPage />}
          {page === "Settings" && <SettingsPage />}
        </section>
      </main>

      <MobileNav currentPage={page} onSelectPage={setPage} />

      {modal && (
        <BookingModal
          kind={typeof modal === "string" ? modal : modal.kind}
          initialDate={typeof modal === "object" ? modal.initialDate : undefined}
          onClose={() => setModal(null)}
          onSuccess={(msg) => {
            setModal(null)
            notify(msg)
          }}
        />
      )}

      <Toast message={toast} />
    </div>
  )
}

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </I18nProvider>
  )
}

export default App
