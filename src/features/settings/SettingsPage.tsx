import { useState } from "react"
import { Icon } from "../../components/ui/Icon"
import { SettingsContent } from "./SettingsContent"
import { useI18n, type TranslationKey } from "../../lib/i18n"

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
    <div className="settings-layout">
      <aside>
        {SETTINGS_SECTIONS.map((x) => (
          <button
            onClick={() => setSection(x.id)}
            className={section === x.id ? "active" : ""}
            key={x.id}
          >
            {t(x.key as TranslationKey)}
            <Icon name="chevron" size={14} />
          </button>
        ))}
      </aside>
      <SettingsContent section={section} />
    </div>
  )
}
