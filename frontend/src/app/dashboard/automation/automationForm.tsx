import { AlertTriangle, Check, Plus } from 'lucide-react'
import type { AgentAutomation, AutomationPayload } from '@/utils/automations/client'
import { automationInputClass as inputClass, hasUrlScheme, validateAutomationDraft } from './automationDraft'
import JsonRuleForm from './jsonRuleForm'
import AutomationField from './automationField'

type Props = {
    canManageSystem: boolean
    draft: AutomationPayload
    selected: AgentAutomation | null
    busy: string
    message: string
    onChange: (draft: AutomationPayload) => void
    onSave: () => void
    onCancel: () => void
}

export function AutomationForm({ canManageSystem, draft, selected, busy, message, onChange, onSave, onCancel }: Props) {
    const validation = validateAutomationDraft(draft)
    return <div className='grid gap-4'>
        <div>
            <h2 className='text-xl font-semibold text-ui-text'>{selected?.name || 'Create an automation'}</h2>
            <p className='mt-1 text-sm text-ui-muted'>Define a monitoring job and where to send its alerts.</p>
        </div>
        <AutomationField label='Name' error={fieldError(validation, 'name')}>
            <input className={inputClass} required value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} placeholder='Website health' />
        </AutomationField>
        <AutomationField label='Automation type'>
            <select className={inputClass} disabled={selected?.monitoringType === 'push'} value={draft.actionType} onChange={event => onChange({ ...draft, actionType: event.target.value as AutomationPayload['actionType'], ...(event.target.value !== 'agent_prompt' && draft.monitoringType === 'push' ? { monitoringType: 'fetch' } : {}) })}>
                <option value='agent_prompt'>Monitoring</option>
                {canManageSystem && <option value='mail_health_check'>Mail health</option>}
                <option value='system_alert'>Scheduled message</option>
                <option value='echo'>Record a reminder in job history</option>
            </select>
        </AutomationField>
        {draft.actionType === 'agent_prompt' && <MonitoringFields canManageSystem={canManageSystem} draft={draft} selected={selected} onChange={onChange} validation={validation} />}
        <AutomationField label='Description' error={fieldError(validation, 'prompt')}>
            <textarea className='min-h-28 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm leading-6 text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' required value={draft.prompt} onChange={event => onChange({ ...draft, prompt: event.target.value })} placeholder='Monitor the service for availability and response errors.' />
        </AutomationField>
        <NotificationDestinations draft={draft} canManageSystem={canManageSystem} onChange={onChange} />
        <ScheduleFields draft={draft} onChange={onChange} validation={validation} />
        {draft.actionType === 'agent_prompt' && draft.monitoringType !== 'push' && <BooleanOption label='Notify me about warnings' description='Warn when a successful check takes 1 second or longer.' checked={Boolean(draft.notifyWarnings)} onChange={value => onChange({ ...draft, notifyWarnings: value })} />}
        {draft.actionType === 'agent_prompt' && <TimeoutFields draft={draft} onChange={onChange} />}
        <BooleanOption label='Automation active' description='Start checking as soon as it is saved.' checked={draft.status === 'active'} onChange={active => onChange({ ...draft, status: active ? 'active' : 'paused' })} />
        <div className='grid gap-3 border-t border-ui-border pt-4'>
            <p className='min-h-5 wrap-break-word text-sm text-ui-text'>{message}</p>
            <div className='flex items-center justify-between gap-3'>
                <button type='button' onClick={onCancel} className='h-10 rounded-lg border border-ui-border px-4 text-sm font-semibold text-ui-muted hover:text-ui-text'>Cancel</button>
                <button type='button' onClick={onSave} disabled={busy === 'save' || Boolean(validation)} className='inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary hover:opacity-90 disabled:opacity-50'>
                    {selected ? <Check className='h-4 w-4' /> : <Plus className='h-4 w-4' />}{selected ? 'Save changes' : 'Create automation'}
                </button>
            </div>
        </div>
    </div>
}

function MonitoringFields({ canManageSystem, draft, selected, onChange, validation }: { canManageSystem: boolean, draft: AutomationPayload, selected: AgentAutomation | null, onChange: Props['onChange'], validation: ReturnType<typeof validateAutomationDraft> }) {
    const isUrl = draft.monitoringType === 'fetch' || draft.monitoringType === 'post'
    return <>
        <div className='grid gap-3 sm:grid-cols-2'>
            <AutomationField label='Type'>
                <select className={inputClass} disabled={selected?.monitoringType === 'push'} value={draft.monitoringType || 'fetch'} onChange={event => onChange({ ...draft, monitoringType: event.target.value as AutomationPayload['monitoringType'], ...(event.target.value === 'push' ? { targetUrl: '', timeoutSeconds: 180, retryCount: 0, intervalMinutes: 1, scheduleKind: 'interval', expectedDown: false, upsideDown: false } : { timeoutSeconds: 5 }) })}>
                    <option value='fetch'>Fetch</option><option value='post'>Post</option><option value='tcp'>TCP</option><option value='ssh'>SSH</option><option value='json'>JSON</option><option value='push' disabled={Boolean(selected)}>External events</option>
                </select>
            </AutomationField>
            <AutomationField label={targetLabel(draft)} error={fieldError(validation, 'url')}>
                <span className='relative block'>
                    {isUrl && <span className={`pointer-events-none absolute inset-y-0 left-3 flex items-center text-ui-muted ${hasUrlScheme(draft.targetUrl || '') ? 'hidden' : ''}`} aria-hidden='true'>https://</span>}
                    <input className={`${inputClass} ${isUrl && !hasUrlScheme(draft.targetUrl || '') ? 'pl-14' : ''}`} readOnly={selected?.monitoringType === 'push'} required type='text' value={draft.targetUrl || ''} onChange={event => onChange({ ...draft, targetUrl: event.target.value })} placeholder={targetPlaceholder(draft)} />
                </span>
            </AutomationField>
        </div>
        {draft.monitoringType === 'json' && <JsonRuleForm canManageSystem={canManageSystem} draft={draft} onChange={onChange} inputClass={inputClass} />}
        {draft.monitoringType !== 'push' && <RequestOptions draft={draft} onChange={onChange} />}
    </>
}

function targetLabel(draft: AutomationPayload) {
    return draft.monitoringType === 'push' ? 'Source ID' : draft.monitoringType === 'ssh' ? 'SSH host' : draft.monitoringType === 'tcp' ? 'TCP host' : 'URL to check'
}
function targetPlaceholder(draft: AutomationPayload) {
    return draft.monitoringType === 'push' ? 'home-1/basement/moisture' : draft.monitoringType === 'ssh' || draft.monitoringType === 'tcp' ? 'git.hanasand.com:22' : 'example.com/health'
}

function RequestOptions({ draft, onChange }: { draft: AutomationPayload, onChange: Props['onChange'] }) {
    return <>
        <div className='grid gap-3 sm:grid-cols-2'>
            <AutomationField label='User agent'>
                <input className={inputClass} value={draft.userAgent || ''} onChange={event => onChange({ ...draft, userAgent: event.target.value })} placeholder='Default browser-like agent' />
            </AutomationField>
            <AutomationField label='Redirects'>
                <select className={inputClass} value={draft.followRedirects === false ? 'no' : 'yes'} onChange={event => onChange({ ...draft, followRedirects: event.target.value === 'yes' })}>
                    <option value='yes'>Follow redirects</option><option value='no'>Do not follow redirects</option>
                </select>
            </AutomationField>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
            <BooleanOption label='Expected down' description='Down is maintenance; up is a failure.' checked={Boolean(draft.expectedDown)} onChange={value => onChange({ ...draft, expectedDown: value })} />
            <BooleanOption label='Upside down' description='Invert the expected result.' checked={Boolean(draft.upsideDown)} onChange={value => onChange({ ...draft, upsideDown: value })} />
        </div>
    </>
}

function BooleanOption({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: (checked: boolean) => void }) {
    return <label className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2.5'>
        <span><span className='block text-sm font-semibold text-ui-text'>{label}</span><span className='text-xs text-ui-muted'>{description}</span></span>
        <input type='checkbox' checked={checked} onChange={event => onChange(event.target.checked)} className='h-4 w-4 accent-(--ui-primary)' />
    </label>
}

function NotificationDestinations({ draft, canManageSystem, onChange }: { draft: AutomationPayload, canManageSystem: boolean, onChange: Props['onChange'] }) {
    const destinations = draft.notificationDestinations || (draft.modelName ? [draft.modelName] : [])
    return <>
        <AutomationField label='Notification destinations'>
            <textarea className='min-h-20 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm leading-6 text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' value={destinations.join('\n')} onChange={event => {
                const next = event.target.value.split('\n').map(item => item.trim()).filter(Boolean)
                onChange({ ...draft, notificationDestinations: next, modelName: next[0] || null })
            }} placeholder={canManageSystem ? 'One destination per line' : 'One Discord webhook URL per line'} />
        </AutomationField>
        {!draft.modelName?.trim() && draft.notifyOn !== 'never' && <span className='-mt-2 inline-flex w-fit text-ui-warning' title='No delivery destination configured' aria-label='No delivery destination configured'><AlertTriangle className='h-5 w-5' /></span>}
    </>
}

function ScheduleFields({ draft, onChange, validation }: { draft: AutomationPayload, onChange: Props['onChange'], validation: ReturnType<typeof validateAutomationDraft> }) {
    return <>
        <AutomationField label='Schedule'>
            <select className={inputClass} disabled={draft.monitoringType === 'push'} value={draft.scheduleKind} onChange={event => onChange({ ...draft, scheduleKind: event.target.value as AutomationPayload['scheduleKind'] })}>
                <option value='interval'>Repeating</option><option value='once'>Once</option>
            </select>
        </AutomationField>
        {fieldError(validation, 'schedule') && <p className='text-sm text-ui-text'>{fieldError(validation, 'schedule')}</p>}
        {draft.scheduleKind === 'once' && <AutomationField label='Run at'>
            <input type='datetime-local' required className={inputClass} value={localDateTimeValue(draft.runAt)} onChange={event => onChange({ ...draft, runAt: event.target.value ? new Date(event.target.value).toISOString() : '' })} />
        </AutomationField>}
        <div className='grid gap-3 sm:grid-cols-2'>
            <AutomationField label='Run every' className={draft.scheduleKind === 'once' ? 'hidden' : ''}>
                <div className='flex items-center gap-2'><input className={inputClass} type='number' disabled={draft.monitoringType === 'push'} min={1} value={draft.intervalMinutes || ''} onChange={event => onChange({ ...draft, intervalMinutes: Number(event.target.value) || null })} /><span className='text-sm text-ui-muted'>{draft.intervalMinutes === 1 ? 'minute' : 'minutes'}</span></div>
            </AutomationField>
            <AutomationField label='Notify me'>
                <select className={inputClass} value={draft.notifyOn || 'failure'} onChange={event => onChange({ ...draft, notifyOn: event.target.value as AutomationPayload['notifyOn'] })}>
                    <option value='failure'>When something fails</option><option value='always'>After every check</option><option value='never'>Never</option>
                </select>
            </AutomationField>
        </div>
    </>
}

function localDateTimeValue(value?: string | null) {
    if (!value) return ''
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function TimeoutFields({ draft, onChange }: { draft: AutomationPayload, onChange: Props['onChange'] }) {
    return <div className='grid gap-3 sm:grid-cols-2'>
        <AutomationField label={draft.monitoringType === 'push' ? 'Mark offline after' : 'Response timeout'}>
            <div className='flex items-center gap-2'><input className={inputClass} type='number' min={1} max={draft.monitoringType === 'push' ? 86400 : 120} value={draft.timeoutSeconds || ''} onChange={event => onChange({ ...draft, timeoutSeconds: Number(event.target.value) || null })} /><span className='text-sm text-ui-muted'>seconds</span></div>
        </AutomationField>
        {draft.monitoringType !== 'push' && <AutomationField label='Retries before failure'>
            <div className='flex items-center gap-2'><input className={inputClass} type='number' min={0} max={5} value={draft.retryCount ?? ''} onChange={event => onChange({ ...draft, retryCount: Number(event.target.value) || 0 })} /><span className='text-sm text-ui-muted'>retries</span></div>
        </AutomationField>}
    </div>
}

function fieldError(validation: ReturnType<typeof validateAutomationDraft>, field: string) {
    return validation?.field === field ? validation.message : undefined
}
