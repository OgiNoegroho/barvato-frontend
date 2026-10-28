import { useState } from "react"
import { Icon } from "../../components/ui/Icon"
import { SettingsContent } from "./SettingsContent"

const SETTINGS_SECTIONS = [
  "Shop profile",
  "Hours & availability",
  "Services & pricing",
  "Staff & permissions",
  "Payroll & Compensation",
  "Notifications",
  "Billing",
]

export function SettingsPage() {
  const [section, setSection] = useState(SETTINGS_SECTIONS[0])

  return (
    <div className="settings-layout">
      <aside>
        {SETTINGS_SECTIONS.map((x) => (
          <button
            onClick={() => setSection(x)}
            className={section === x ? "active" : ""}
            key={x}
          >
            {x}
            <Icon name="chevron" size={14} />
          </button>
        ))}
      </aside>
      <SettingsContent section={section} />
    </div>
  )
}
