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

function AppShell() {
  const { user, currentShop, isLoading, isAuthenticated, initError, retrySession } = useAuth()
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
          <p>Verifying active session with server...</p>
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
          <h2>Connection Interrupted</h2>
          <p>{initError}</p>
          <button
            type="button"
            className="primary-button"
            onClick={retrySession}
            style={{ width: "100%" }}
          >
            Retry Connection
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

  const title = page === "Overview" ? `Good day, ${user?.name || "Elias"}.` : page
  const subtitle =
    page === "Overview"
      ? `${currentShop?.name || "Shop"} · ${currentShop?.role ? currentShop.role.toUpperCase() : "STAFF"}`
      : page === "Operations"
        ? "Live schedule and walk-in flow · 9 appointments"
        : `Manage ${page.toLowerCase()} at ${currentShop?.name || "Shop"}`

  function handleSaveBooking() {
    const kind = modal
    setModal(null)
    notify(kind === "walkin" ? "Walk-in added to queue" : "Appointment booked")
  }

  return (
    <div className="app-shell">
      <Sidebar currentPage={page} onSelectPage={setPage} />

      <main>
        <Topbar currentPage={page} onOpenModal={setModal} />

        <section className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {currentShop?.name ? currentShop.name.toUpperCase() : "SHOP"} / {page.toUpperCase()}
              </p>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {page === "Overview" && (
              <button
                className="text-button"
                onClick={() => setPage("Operations")}
              >
                Open operations <Icon name="arrow" size={16} />
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
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
