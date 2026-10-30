import { useState } from "react"
import { Icon } from "../../components/ui/Icon"
import { SettingsContent } from "./SettingsContent"
import { useI18n, type TranslationKey } from "../../lib/i18n"
import { cn } from "../../lib/utils"

const SETTINGS_SECTIONS = [
  { id: "Shop profile", key: "settings.sectionProfile" },
  { id: "Hours & availability", key: "settings.sectionHours" },
  { id: "Services & pricing", key: "settings.sectionServices" },
  { id: "Staff & permissions", key: "settings.sectionStaff" },
  { id: "Payroll & Compensation", key: "settings.sectionPayroll" },
  { id: "Notifications", key: "settings.sectionNotifications" },
  { id: "Billing", key: "settings.sectionBilling" },
]

export function SettingsPage() {
  const [section, setSection] = useState(SETTINGS_SECTIONS[0].id)
  const { t } = useI18n()

  return (
    <div className="settings-layout grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4.5 items-start">
      <aside className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible border-t border-charcoal bg-ivory-light md:bg-transparent rounded-sm md:rounded-none">
        {SETTINGS_SECTIONS.map((x) => {
          const isActive = section === x.id
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setSection(x.id)}
              className={cn(
                "flex items-center justify-between border-0 border-b border-stone px-3.5 py-3 md:py-3.5 text-left text-xs transition-colors cursor-pointer whitespace-nowrap md:whitespace-normal",
                isActive
                  ? "active text-charcoal font-bold bg-ivory-warm/60 md:bg-transparent border-b-copper md:border-b-stone"
                  : "text-muted-text hover:text-charcoal hover:bg-ivory-warm/30 bg-transparent"
              )}
            >
              <span>{t(x.key as TranslationKey)}</span>
              <Icon name="chevron" size={14} className="hidden md:block shrink-0 opacity-60" />
            </button>
          )
        })}
      </aside>
      <SettingsContent section={section} />
    </div>
  )
}
