import { useState, useCallback } from "react"
import type { Page } from "./types"
import { ToastProvider, useToast } from "./hooks/useToast"
import { Icon } from "./components/ui/Icon"
import { Button } from "./components/ui/Button"
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
  const {
    user,
    currentShop,
    isLoading,
    isAuthenticated,
    initError,
    retrySession,
  } = useAuth()
  const { t } = useI18n()
  const [page, setPage] = useState<Page>("Overview")
  const [navTarget, setNavTarget] = useState<{
    entityType: string
    entityId: number
    targetDate?: string
  } | null>(null)
  const handleClearNavTarget = useCallback(() => setNavTarget(null), [])
  const [modal, setModal] = useState<"appointment" | "walkin" | {
    kind: "appointment"
    initialDate?: string
  } | null>(null)
  const { notify } = useToast()

  if (isLoading) {
    return (
      <div className="session-status-screen min-h-screen grid place-items-center bg-ivory p-6">
        <div className="session-status-card w-full max-w-[400px] text-center bg-ivory-light border border-stone rounded-sm p-8 sm:p-10 shadow-card">
          <span className="brand-mark large w-12 h-12 rounded-full bg-copper text-white grid place-items-center font-serif text-2xl font-bold mx-auto mb-4">
            B
          </span>
          <h2 className="font-serif text-2xl text-charcoal m-0 mb-2">BARVATO</h2>
          <p className="text-xs text-muted-text m-0 mb-6">{t("auth.verifyingSession")}</p>
          <div className="loading-spinner large w-9 h-9 border-[3px] border-copper/20 border-t-copper rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="session-status-screen min-h-screen grid place-items-center bg-ivory p-6">
        <div className="session-status-card w-full max-w-[400px] text-center bg-ivory-light border border-stone rounded-sm p-8 sm:p-10 shadow-card">
          <span className="brand-mark large w-12 h-12 rounded-full bg-danger text-white grid place-items-center font-serif text-2xl font-bold mx-auto mb-4">
            !
          </span>
          <h2 className="font-serif text-2xl text-charcoal m-0 mb-2">{t("auth.connectionInterrupted")}</h2>
          <p className="text-xs text-muted-text m-0 mb-6">{initError}</p>
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={retrySession}
          >
            {t("common.retryConnection")}
          </Button>
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
    <div className="app-shell min-h-screen flex bg-ivory text-charcoal font-sans">
      <Sidebar currentPage={page} onSelectPage={setPage} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          currentPage={page}
          onNavigate={setPage}
          onNavigateEntity={(entityType, entityId, data) => {
            if (entityType && entityId) {
              const targetDate =
                typeof data?.start_date === "string"
                  ? data.start_date
                  : typeof data?.starts_at === "string"
                    ? data.starts_at
                    : undefined
              setNavTarget({ entityType, entityId, targetDate })
            }
            if (
              entityType === "payment" ||
              entityType === "payout" ||
              entityType === "daily_close"
            ) {
              setPage("Money")
            } else if (
              entityType === "staff" ||
              entityType === "staff_exception"
            ) {
              setPage("Team")
            } else {
              setPage("Operations")
            }
          }}
        />

        <section className="content flex-1 w-full max-w-[1540px] mx-auto p-4 sm:p-6 lg:p-8 xl:px-9 pb-24 md:pb-12">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {currentShop?.name ? currentShop.name.toUpperCase() : "SHOP"} /{" "}
                {translatedPageName.toUpperCase()}
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
              onAppointment={(initialDate) =>
                setModal({ kind: "appointment", initialDate })
              }
              notify={notify}
              targetAppointmentId={
                navTarget?.entityType === "appointment"
                  ? navTarget.entityId
                  : null
              }
              targetQueueId={
                navTarget?.entityType === "queue_entry"
                  ? navTarget.entityId
                  : null
              }
              targetDate={navTarget?.targetDate || null}
              onClearTarget={handleClearNavTarget}
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
          initialDate={
            typeof modal === "object" ? modal.initialDate : undefined
          }
          timezone={currentShop?.timezone || "Asia/Jakarta"}
          onClose={() => setModal(null)}
          onSuccess={(msg) => {
            setModal(null)
            notify(msg, "success")
          }}
        />
      )}
    </div>
  )
}

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
          <Toast />
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  )
}

export default App
