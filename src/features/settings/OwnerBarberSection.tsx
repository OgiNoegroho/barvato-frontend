import React, { useCallback, useEffect, useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Icon } from "../../components/ui/Icon"
import { Input } from "../../components/ui/Input"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "../../components/ui/Modal"
import { useToast } from "../../hooks/useToast"
import {
  shopApi,
  type OwnerBarberConfig,
  type StaffItem,
} from "../../lib/api"
import { useI18n } from "../../lib/i18n"
import {
  buildOwnerBarberUpdatePayload,
  createInitialOwnerBarberForm,
  formatCommissionPercent,
  getSyncedStaffIdUpdate,
  mapOwnerBarberError,
  reconcileOwnerBarberFormAfterRefresh,
  type OwnerBarberFormValues,
} from "../../lib/ownerBarber"
import { useAuth } from "../auth/AuthContext"

type ActionErrorSource =
  | { type: "api"; error: unknown }
  | { type: "validation"; targetEnabled: boolean }
  | null

export interface OwnerBarberSectionProps {
  staffList?: StaffItem[]
  onUpdated?: () => void
}

export function OwnerBarberSection({
  staffList = [],
  onUpdated,
}: OwnerBarberSectionProps) {
  const { user, refreshSession, updateCurrentShop } = useAuth()
  const { t, language } = useI18n()
  const toast = useToast()

  const [config, setConfig] = useState<OwnerBarberConfig | null>(null)
  const [form, setForm] = useState<OwnerBarberFormValues>(() =>
    createInitialOwnerBarberForm(null, user?.name ?? "", user?.phone ?? ""),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [rawLoadError, setRawLoadError] = useState<unknown | null>(null)
  const [actionErrorSource, setActionErrorSource] = useState<ActionErrorSource>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDisableConfirmOpen, setIsDisableConfirmOpen] = useState(false)

  const loadConfig = useCallback(
    async (options: { preserveDraft?: boolean } = {}) => {
      const preserveDraft = Boolean(options.preserveDraft)
      if (!preserveDraft) {
        setIsLoading(true)
        setRawLoadError(null)
      }
      try {
        const data = await shopApi.getOwnerBarber()
        setConfig(data)
        setForm((prev) =>
          reconcileOwnerBarberFormAfterRefresh(
            prev,
            data,
            preserveDraft,
            user?.name ?? "",
            user?.phone ?? "",
          ),
        )
      } catch (err: unknown) {
        const mapped = mapOwnerBarberError(err, "en")
        if (!preserveDraft) {
          setRawLoadError(err)
        }
        if (mapped.requiresRelogin) {
          await refreshSession()
        }
      } finally {
        if (!preserveDraft) {
          setIsLoading(false)
        }
      }
    },
    [refreshSession, user?.name, user?.phone],
  )

  useEffect(() => {
    void loadConfig({ preserveDraft: false })
  }, [loadConfig])

  const syncAfterUpdate = useCallback(
    (updated: OwnerBarberConfig) => {
      setConfig(updated)
      setForm(
        createInitialOwnerBarberForm(
          updated,
          user?.name ?? "",
          user?.phone ?? "",
        ),
      )
      updateCurrentShop(getSyncedStaffIdUpdate(updated))
      onUpdated?.()
    },
    [onUpdated, updateCurrentShop, user?.name, user?.phone],
  )

  const submitUpdate = async (targetEnabled: boolean) => {
    if (isSubmitting) return

    const built = buildOwnerBarberUpdatePayload(
      targetEnabled,
      form,
      Boolean(config?.linked),
      language,
    )
    if (built.error !== null) {
      setActionErrorSource({ type: "validation", targetEnabled })
      return
    }

    setIsSubmitting(true)
    setActionErrorSource(null)

    try {
      const wasEnabled = Boolean(config?.enabled)
      const updated = await shopApi.updateOwnerBarber(built.payload)
      syncAfterUpdate(updated)
      setIsDisableConfirmOpen(false)

      if (!targetEnabled) {
        toast.success(t("ownerBarber.disabledSuccessToast"))
      } else if (!wasEnabled) {
        toast.success(t("ownerBarber.enabledSuccessToast"))
      } else {
        toast.success(t("ownerBarber.updatedSuccessToast"))
      }
    } catch (err: unknown) {
      const mapped = mapOwnerBarberError(err, language)
      setActionErrorSource({ type: "api", error: err })
      setIsDisableConfirmOpen(false)
      if (mapped.requiresRelogin) {
        await refreshSession()
      } else if (mapped.shouldRefresh) {
        await loadConfig({ preserveDraft: true })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEnableOrSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitUpdate(true)
  }

  const handleLinkStaffChange = (selectedId: string) => {
    const matched = staffList.find((s) => String(s.id) === selectedId)
    if (matched) {
      setForm({
        linkStaffId: selectedId,
        name: matched.name,
        commissionPercent: formatCommissionPercent(matched.commission_bps),
        contact: matched.contact ?? "",
      })
    } else {
      setForm({
        linkStaffId: "",
        name: user?.name ?? "",
        commissionPercent: "0",
        contact: user?.phone ?? "",
      })
    }
    setActionErrorSource(null)
  }

  const loadError = rawLoadError
    ? mapOwnerBarberError(rawLoadError, language).message
    : null
  const actionError =
    actionErrorSource?.type === "api"
      ? mapOwnerBarberError(actionErrorSource.error, language).message
      : actionErrorSource?.type === "validation"
        ? buildOwnerBarberUpdatePayload(
            actionErrorSource.targetEnabled,
            form,
            Boolean(config?.linked),
            language,
          ).error
        : null

  const statusTone = config?.enabled
    ? "success"
    : config?.linked
      ? "warning"
      : "neutral"
  const statusLabel = config?.enabled
    ? t("ownerBarber.statusActive")
    : config?.linked
      ? t("ownerBarber.statusInactive")
      : t("ownerBarber.statusNotEnabled")

  return (
    <section
      aria-labelledby="owner-barber-heading"
      className="bg-ivory-light border border-stone rounded-lg p-5 sm:p-6 mb-6 shadow-subtle"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3
              id="owner-barber-heading"
              className="font-serif text-lg text-charcoal m-0"
            >
              {t("ownerBarber.title")}
            </h3>
            {!isLoading && config && (
              <Badge tone={statusTone}>{statusLabel}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-text m-0 leading-relaxed">
            {t("ownerBarber.subtitle")}
          </p>
        </div>
      </div>

      {loadError && (
        <div
          className="login-error-alert mb-4 flex items-center justify-between gap-3 p-3 border border-danger/30 bg-danger-soft text-danger text-xs rounded-sm"
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="bell" size={16} className="shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadConfig({ preserveDraft: false })}
            className="shrink-0"
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-muted-text text-xs">
          {t("ownerBarber.loading")}
        </div>
      ) : config ? (
        <form onSubmit={handleEnableOrSave} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-ivory border border-stone rounded-sm">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-semibold text-charcoal">
                {t("ownerBarber.toggleLabel")}
              </div>
              <p className="text-2xs text-muted-text m-0">
                {config.enabled
                  ? t("ownerBarber.toggleActiveDesc")
                  : t("ownerBarber.toggleInactiveDesc")}
              </p>
            </div>
            {config.enabled ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  setActionErrorSource(null)
                  setIsDisableConfirmOpen(true)
                }}
                className="shrink-0"
              >
                {t("ownerBarber.disableButton")}
              </Button>
            ) : null}
          </div>

          <div className="p-3 bg-ivory-warm/50 border border-stone rounded-sm text-2xs text-muted-text leading-relaxed">
            {t("ownerBarber.ownerAccessNote")}
          </div>

          {actionError && (
            <div
              className="login-error-alert flex items-center gap-2 p-3 border border-danger/30 bg-danger-soft text-danger text-xs rounded-sm"
              role="alert"
            >
              <Icon name="bell" size={16} className="shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {!config.linked && staffList.length > 0 && (
            <div>
              <label
                htmlFor="owner-barber-link-staff"
                className="block text-xs font-semibold text-charcoal mb-1.5"
              >
                {t("ownerBarber.linkStaffLabel")}
              </label>
              <select
                id="owner-barber-link-staff"
                value={form.linkStaffId}
                disabled={isSubmitting}
                onChange={(e) => handleLinkStaffChange(e.target.value)}
                className="w-full h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all disabled:opacity-60"
              >
                <option value="">{t("ownerBarber.linkModeNew")}</option>
                {staffList.map((st) => (
                  <option key={st.id} value={String(st.id)}>
                    {st.name}
                    {st.active ? "" : ` (${t("common.inactive")})`}
                  </option>
                ))}
              </select>
              <p className="text-2xs text-muted-text mt-1 mb-0">
                {t("ownerBarber.linkStaffHint")}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="owner-barber-name"
              label={t("ownerBarber.nameLabel")}
              type="text"
              value={form.name}
              disabled={isSubmitting}
              placeholder={t("ownerBarber.namePlaceholder")}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }))
                setActionErrorSource(null)
              }}
              required={!form.linkStaffId}
            />

            <div>
              <Input
                id="owner-barber-commission"
                label={t("ownerBarber.commissionLabel")}
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.commissionPercent}
                disabled={isSubmitting}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    commissionPercent: e.target.value,
                  }))
                  setActionErrorSource(null)
                }}
              />
              <p className="text-2xs text-muted-text mt-1 mb-0">
                {t("ownerBarber.commissionHint")}
              </p>
            </div>

            <div className="sm:col-span-2">
              <Input
                id="owner-barber-contact"
                label={t("ownerBarber.contactLabel")}
                type="text"
                value={form.contact}
                disabled={isSubmitting}
                placeholder={t("ownerBarber.contactPlaceholder")}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, contact: e.target.value }))
                  setActionErrorSource(null)
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              isLoading={isSubmitting}
            >
              {isSubmitting
                ? t("ownerBarber.saving")
                : config.enabled
                  ? t("ownerBarber.saveButton")
                  : t("ownerBarber.enableButton")}
            </Button>
          </div>
        </form>
      ) : null}

      <Modal
        isOpen={isDisableConfirmOpen}
        onClose={() => {
          if (!isSubmitting) setIsDisableConfirmOpen(false)
        }}
        size="sm"
      >
        <ModalHeader className="mb-3">
          <div>
            <h4 className="font-serif text-lg text-charcoal m-0">
              {t("ownerBarber.disableConfirmTitle")}
            </h4>
          </div>
        </ModalHeader>
        <ModalBody className="space-y-3 text-xs text-charcoal leading-relaxed">
          <p className="m-0">{t("ownerBarber.disableConfirmMessage")}</p>
          <div className="p-3 bg-ivory-warm/60 border border-stone rounded-sm text-charcoal font-medium">
            {t("ownerBarber.disableConfirmOwnerSafe")}
          </div>
        </ModalBody>
        <ModalFooter className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => setIsDisableConfirmOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            onClick={() => submitUpdate(false)}
          >
            {isSubmitting
              ? t("ownerBarber.saving")
              : t("ownerBarber.disableConfirmAction")}
          </Button>
        </ModalFooter>
      </Modal>
    </section>
  )
}
