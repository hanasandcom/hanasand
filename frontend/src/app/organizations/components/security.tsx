import type { OrganizationApiKey, OrganizationSettings, OrganizationSummary, OrganizationPrivacyState } from '../types/organization'
import type { RowMessage } from '../types/activity'
import { DisclosureSummary, RowStatus, Field, SelectField, InlineBusy, OrganizationMetadataBadge } from './shared'
import { formatDate, cleanString } from '../model/labels'
import { secondaryButtonClass, primaryButtonClass, inputClass } from '../constants/styles'
import { settingsValidationMessage, privacyText, privacyNumber } from '../model/forms'
import { slugifyOrganizationName } from '../model/organization'
import { webhookPolicies, alertPolicies, lifecycleStatuses } from '../constants/options'
import { useState, type ReactNode } from 'react'
import { Archive, Copy, KeyRound, Loader2, RefreshCw, Settings, ShieldCheck, Trash2 } from 'lucide-react'
import { useClipboardStatus } from './useClipboardStatus'

export function ActionAnchor({ href, icon, label, disabled, disabledReason }: { href: string, icon: ReactNode, label: string, disabled?: boolean, disabledReason?: string }) {
    const classes = disabled
        ? 'pointer-events-none inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'
        : 'inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-raised dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-raised'
    if (disabled) {
        return <span className={classes} aria-disabled='true' aria-label={disabledReason ? `${label}: ${disabledReason}` : label} title={disabledReason}>{icon}{label}</span>
    }
    return <a className={classes} href={href}>{icon}{label}</a>
}

export function EventApiKeyPanel({ apiKeys, secret, canManage, busy, rowMessage, onCreate, onRevoke, onClearSecret }: { apiKeys: OrganizationApiKey[], secret: string, canManage: boolean, busy: string, rowMessage?: RowMessage, onCreate: (name: string) => void, onRevoke: (apiKey: OrganizationApiKey) => void, onClearSecret: () => void }) {
    const activeKeys = apiKeys.filter(key => key.enabled !== false)
    const revokedKeys = apiKeys.filter(key => key.enabled === false)
    const [keyName, setKeyName] = useState('')
    const { status: copyStatus, copy } = useClipboardStatus()
    const creating = busy === 'create-event-api-key'
    const revoking = busy === 'revoke-event-api-key'
    const copySecret = () => copy(secret, 'Secret copied.', 'Copy failed. Select the secret and copy it manually.')
    return (
        <details id='event-api-key' open className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-event-api-key>
            <DisclosureSummary
                icon={<KeyRound className='h-4 w-4' />} title='Organization API keys'
                detail='Create separate keys for integrations. Every key belongs to this organization.'
                accessory={<OrganizationMetadataBadge className='shrink-0'>
                    {activeKeys.length ? `${activeKeys.length} active` : 'Setup required'}
                </OrganizationMetadataBadge>}
            />
            <div className='grid gap-3 border-t border-ui-border p-4 dark:border-ui-border'>
                <p className='text-sm text-ui-muted dark:text-ui-muted'>Each key has its own name, secret, and revoke action. Creating a key does not disable existing keys.</p>
                {activeKeys.map(apiKey => <div key={apiKey.id} className='flex flex-col gap-3 rounded-md border border-ui-border p-3 dark:border-ui-border sm:flex-row sm:items-center sm:justify-between' data-org-api-key-id={apiKey.id}>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{apiKey.name || 'Organization API key'}</p>
                        <p className='mt-1 truncate font-mono text-xs text-ui-muted dark:text-ui-muted'>{apiKey.keyPrefix || apiKey.key_prefix || 'prefix unavailable'}••••</p>
                        <p className='mt-1 text-xs text-ui-muted dark:text-ui-muted'>Expires {formatDate(apiKey.expiresAt || apiKey.expires_at) || 'according to organization policy'}</p>
                    </div>
                    <button type='button' className={secondaryButtonClass} disabled={!canManage || Boolean(busy)} onClick={() => onRevoke(apiKey)} title={!canManage ? 'Owner or admin required' : 'Revoke organization API key'}>
                        {revoking ? <Loader2 className='h-4 w-4 animate-spin' /> : <Trash2 className='h-4 w-4' />} Revoke key
                    </button>
                </div>)}
                {revokedKeys.length > 0 && <p className='text-xs text-ui-muted dark:text-ui-muted'>{revokedKeys.length} revoked {revokedKeys.length === 1 ? 'key' : 'keys'} retained in history.</p>}
                <div className='flex flex-col gap-3 rounded-md border border-dashed border-ui-border p-3 dark:border-ui-border sm:flex-row sm:items-end sm:justify-between'>
                    <label className='grid min-w-0 flex-1 gap-1.5'>
                        <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>New key name</span>
                        <input className='min-h-10 w-full rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none focus:border-ui-primary' required minLength={2} maxLength={80} value={keyName} onChange={event => setKeyName(event.target.value)} placeholder='e.g. Production integration' />
                    </label>
                    <button type='button' className={primaryButtonClass} disabled={!canManage || Boolean(busy) || keyName.trim().length < 2 || keyName.trim().length > 80} onClick={() => { onCreate(keyName.trim()); setKeyName('') }} title={!canManage ? 'Owner or admin required' : 'Create organization API key'}>
                        {creating ? <Loader2 className='h-4 w-4 animate-spin' /> : <KeyRound className='h-4 w-4' />} Create key
                    </button>
                </div>
                {secret && <div className='rounded-md border border-ui-primary/40 bg-ui-primary/5 p-3 dark:border-ui-primary/40 dark:bg-ui-primary/10' role='status'>
                    <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>Copy this secret now</p>
                    <p className='mt-1 text-xs text-ui-muted dark:text-ui-muted'>It is shown once and will not be recoverable after leaving this page.</p>
                    <code className='mt-2 block break-all rounded-md bg-ui-canvas p-2 text-xs text-ui-text dark:bg-ui-canvas dark:text-ui-text'>{secret}</code>
                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                        <button type='button' className={secondaryButtonClass} onClick={() => void copySecret()}><Copy className='h-4 w-4' /> Copy secret</button>
                        <button type='button' className={secondaryButtonClass} onClick={onClearSecret}>Hide secret</button>
                        <RowStatus message={copyStatus} />
                    </div>
                </div>}
            </div>
            <div className='border-t border-ui-border px-4 py-3 dark:border-ui-border'><RowStatus message={rowMessage} /></div>
        </details>
    )
}

export function SettingsPanel({ settingsDraft, setSettingsDraft, settingsDirty, canManage, busy, rowMessage, onSave, onReset }: { settingsDraft: OrganizationSettings, setSettingsDraft: (next: OrganizationSettings) => void, settingsDirty: boolean, canManage: boolean, busy: string, rowMessage?: RowMessage, onSave: () => void, onReset: () => void }) {
    const validationMessage = settingsValidationMessage(settingsDraft)
    const saving = busy === 'save-settings'
    return (
        <details id='settings' open className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-settings-disclosure>
            <DisclosureSummary
                icon={<Settings className='h-4 w-4' />}
                title='Settings'
                detail={canManage ? 'Name, lifecycle, webhook policy, event access.' : ''}
                accessory={<OrganizationMetadataBadge className='shrink-0'>
                    {settingsDirty ? 'Unsaved changes' : 'Settings'}
                </OrganizationMetadataBadge>}
            />
            <div className='grid gap-3 border-t border-ui-border p-4 dark:border-ui-border md:grid-cols-2'>
                <Field label='Name' value={settingsDraft.name || ''} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, name: value })} />
                <Field label='Slug' value={settingsDraft.slug || ''} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, slug: slugifyOrganizationName(value) })} />
                <SelectField label='Webhook policy' value={settingsDraft.defaultWebhookPolicy || 'active_destinations'} options={webhookPolicies} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, defaultWebhookPolicy: value })} />
                <SelectField label='Event visibility' value={settingsDraft.alertVisibilityPolicy || 'members'} options={alertPolicies} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, alertVisibilityPolicy: value })} />
                <SelectField label='Lifecycle' value={settingsDraft.lifecycleStatus || 'active'} options={lifecycleStatuses} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, lifecycleStatus: value })} />
                <Field label='Retention days' type='number' value={String(settingsDraft.retentionDays || 365)} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, retentionDays: Number(value) || 365 })} />
                {canManage && settingsDirty && validationMessage && <p className='rounded-md bg-ui-raised/10 px-3 py-2 text-xs font-semibold text-ui-text dark:bg-ui-raised/10 dark:text-ui-text md:col-span-2'>{validationMessage}</p>}
            </div>
            <div className='flex flex-wrap items-center justify-end gap-2 border-t border-ui-border px-4 py-3 dark:border-ui-border'>
                {saving && <InlineBusy label='Saving settings' marker='data-org-settings-busy' />}
                <RowStatus message={rowMessage} />
                {settingsDirty && <span className='mr-auto rounded-md bg-ui-warning/10 px-2 py-1 text-xs font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'>Unsaved changes</span>}
                <button type='button' className={secondaryButtonClass} disabled={!canManage || !settingsDirty || Boolean(busy)} onClick={onReset}>
                    Reset
                </button>
                <button type='button' className={primaryButtonClass} disabled={!canManage || !settingsDirty || Boolean(validationMessage) || Boolean(busy)} onClick={onSave}>
                    <Settings className='h-4 w-4' />
                    Save settings
                </button>
            </div>
            {!canManage && <p className='px-4 pb-3 text-center text-xs text-ui-muted'>Only admins can edit.</p>}
        </details>
    )
}

export function PrivacyLifecyclePanel({ organization, privacy, retentionDays, canManage, busy, rowMessage, onRun, onExport, onDelete }: { organization: OrganizationSummary, privacy: OrganizationPrivacyState | null, retentionDays: number, canManage: boolean, busy: string, rowMessage?: RowMessage, onRun: () => void, onExport: () => void, onDelete: (confirmation: string, currentPassword: string) => void }) {
    const [confirmation, setConfirmation] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const latestRun = privacy?.runs?.[0] || {}
    const latestRequest = privacy?.requests?.[0] || {}
    const runStatus = privacyText(latestRun, 'status') || 'No run yet'
    const runAt = privacyText(latestRun, 'completed_at', 'updated_at', 'created_at')
    const protectedCount = privacyNumber(latestRun, 'protected_count')
    const deletedCount = privacyNumber(latestRun, 'deleted_count')
    const redactedCount = privacyNumber(latestRun, 'redacted_count')
    const failedCount = privacyNumber(latestRun, 'failed_count')
    const retriedCount = privacyNumber(latestRun, 'retried_count')
    const requestStatus = privacyText(latestRequest, 'status')
    const explanation = cleanString(privacy?.protection?.explanation) || 'Legal holds and immutable audit, event, case, claim, and analyst evidence remain protected.'
    const deleting = busy === 'delete-organization-data'
    const running = busy === 'run-retention'
    const exporting = busy === 'export-privacy'
    const deletionConfirmed = confirmation === organization.name
    const serverCanManage = privacy?.permissions?.canRunRetention !== false
    const serverCanDelete = privacy?.permissions?.canRequestDeletion === true

    return (
        <details id='privacy' open className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-privacy-lifecycle>
            <DisclosureSummary
                icon={<ShieldCheck className='h-4 w-4' />} title='Retention & privacy'
                detail={`${retentionDays} day policy · bounded scheduled purge`}
                accessory={<span className='shrink-0 rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold capitalize text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>
                    {runStatus.replaceAll('_', ' ')}
                </span>}
            />
            <div className='grid gap-3 border-t border-ui-border p-4 dark:border-ui-border sm:grid-cols-2 lg:grid-cols-4'>
                <PrivacyMetric label='Deleted' value={deletedCount} />
                <PrivacyMetric label='Redacted' value={redactedCount} />
                <PrivacyMetric label='Protected' value={protectedCount} tone='protected' />
                <PrivacyMetric label='Failed' value={failedCount} tone={failedCount ? 'failed' : undefined} />
                <PrivacyMetric label='Retried' value={retriedCount} />
                <div className='rounded-md border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas sm:col-span-2 lg:col-span-4'>
                    <p className='text-xs font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>Protection contract</p>
                    <p className='mt-1 text-sm text-ui-text dark:text-ui-text'>{explanation}</p>
                    <p className='mt-2 text-xs text-ui-muted dark:text-ui-muted'>Last run: {runAt ? formatDate(runAt) : 'waiting for first scheduled or manual run'}{requestStatus ? ` · Latest privacy request: ${requestStatus.replaceAll('_', ' ')}` : ''}</p>
                </div>
                {(privacy?.runs?.length || 0) > 0 && <div className='overflow-x-auto rounded-md border border-ui-border dark:border-ui-border sm:col-span-2 lg:col-span-4' data-org-privacy-history>
                    <table className='w-full min-w-[38rem] text-left text-xs'>
                        <thead className='bg-ui-raised text-ui-muted dark:bg-ui-canvas dark:text-ui-muted'><tr><th className='px-3 py-2'>Run</th><th className='px-3 py-2'>Status</th><th className='px-3 py-2'>Deleted</th><th className='px-3 py-2'>Redacted</th><th className='px-3 py-2'>Protected</th><th className='px-3 py-2'>Failed</th><th className='px-3 py-2'>Retried</th></tr></thead>
                        <tbody>{privacy?.runs?.slice(0, 5).map(run => <tr key={privacyText(run, 'id')} className='border-t border-ui-border dark:border-ui-border'><td className='px-3 py-2'>{formatDate(privacyText(run, 'completed_at', 'updated_at', 'created_at'))}</td><td className='px-3 py-2 capitalize'>{(privacyText(run, 'status') || 'unknown').replaceAll('_', ' ')}</td><td className='px-3 py-2'>{privacyNumber(run, 'deleted_count')}</td><td className='px-3 py-2'>{privacyNumber(run, 'redacted_count')}</td><td className='px-3 py-2'>{privacyNumber(run, 'protected_count')}</td><td className='px-3 py-2'>{privacyNumber(run, 'failed_count')}</td><td className='px-3 py-2'>{privacyNumber(run, 'retried_count')}</td></tr>)}</tbody>
                    </table>
                </div>}
            </div>
            <div className='grid gap-3 border-t border-ui-border p-4 dark:border-ui-border lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
                <label className='grid gap-1 text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                    Type <span className='text-ui-text dark:text-ui-text'>{organization.name}</span> to enable privacy deletion
                    <input className={inputClass} value={confirmation} disabled={!canManage || Boolean(busy)} onChange={event => setConfirmation(event.target.value)} placeholder={organization.name} data-org-privacy-delete-confirmation />
                </label>
                <label className='grid gap-1 text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                    Re-enter your password to authorize deletion
                    <input className={inputClass} type='password' autoComplete='current-password' value={currentPassword} disabled={!serverCanDelete || Boolean(busy)} onChange={event => setCurrentPassword(event.target.value)} data-org-privacy-delete-password />
                </label>
                <div className='flex flex-wrap gap-2 lg:justify-end'>
                    <button type='button' className={secondaryButtonClass} disabled={!canManage || !serverCanManage || Boolean(busy)} onClick={onExport}>
                        {exporting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Archive className='h-4 w-4' />} Export data
                    </button>
                    <button type='button' className={secondaryButtonClass} disabled={!canManage || !serverCanManage || Boolean(busy)} onClick={onRun}>
                        {running ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />} Run purge now
                    </button>
                    <button type='button' className='inline-flex items-center justify-center gap-2 rounded-md border border-ui-danger/40 bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50' disabled={!canManage || !serverCanManage || !serverCanDelete || !deletionConfirmed || !currentPassword || Boolean(busy)} onClick={() => { onDelete(confirmation, currentPassword); setCurrentPassword('') }}>
                        {deleting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Trash2 className='h-4 w-4' />} Request deletion
                    </button>
                </div>
                <div className='lg:col-span-2'><RowStatus message={rowMessage} /></div>
            </div>
        </details>
    )
}

export function PrivacyMetric({ label, value, tone }: { label: string, value: number, tone?: 'protected' | 'failed' }) {
    const valueClass = tone === 'failed' ? 'text-ui-text' : tone === 'protected' ? 'text-ui-warning' : 'text-ui-text'
    return <div className='rounded-md border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas'><p className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>{label}</p><p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p></div>
}
