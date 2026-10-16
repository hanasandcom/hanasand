'use client'

import type { AutomationPayload, JsonRule } from '@/utils/automations/client'
import { defaultJsonRule } from './automationDraft'
import AutomationField from './automationField'

export { defaultJsonRule } from './automationDraft'

export default function JsonRuleForm({ draft, onChange, inputClass, canManageSystem = false }: { canManageSystem?: boolean, draft: AutomationPayload, onChange: (draft: AutomationPayload) => void, inputClass: string }) {
    const rule = draft.jsonRule || defaultJsonRule
    const update = (change: Partial<JsonRule>) => onChange({ ...draft, jsonRule: { ...rule, ...change } })
    return <fieldset className='grid gap-3 rounded-lg border border-ui-border p-3'>
        <legend className='px-1 text-sm font-semibold text-ui-text'>JSON alert rule</legend>
        <AutomationField label='Source' labelClassName='text-xs text-ui-muted'><select className={inputClass} value={draft.targetUrl === 'system:metrics' ? 'host' : 'url'} onChange={event => onChange({ ...draft, targetUrl: event.target.value === 'host' ? 'system:metrics' : '' })}><option value='url'>URL above</option>{canManageSystem && <option value='host'>Host telemetry</option>}</select></AutomationField>
        <AutomationField label='JSON field' labelClassName='text-xs text-ui-muted'><input className={inputClass} value={rule.path} placeholder='host.storage.*.usedPercent' onChange={event => update({ path: event.target.value })} /></AutomationField>
        <div className='grid gap-3 sm:grid-cols-2'>
            <AutomationField label='Combine values' labelClassName='text-xs text-ui-muted'><select className={inputClass} value={rule.aggregate} onChange={event => update({ aggregate: event.target.value as JsonRule['aggregate'] })}><option value='max'>Maximum</option><option value='min'>Minimum</option><option value='avg'>Average</option><option value='first'>First value</option></select></AutomationField>
            <AutomationField label='Alert when' labelClassName='text-xs text-ui-muted'><select className={inputClass} value={rule.operator} onChange={event => update({ operator: event.target.value as JsonRule['operator'] })}><option value='gt'>Above</option><option value='gte'>At or above</option><option value='lt'>Below</option><option value='lte'>At or below</option><option value='eq'>Equal to</option><option value='ne'>Not equal to</option></select></AutomationField>
        </div>
        <AutomationField label='Comparison value' labelClassName='text-xs text-ui-muted'><input className={inputClass} value={String(rule.value)} onChange={event => { const raw = event.target.value; update({ value: raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw }) }} /></AutomationField>
        <p className='text-xs leading-5 text-ui-muted'>Use dots for nested fields and * for array items. Checks with the same source share one response per minute. Missing fields fail the check. Temperature and power use the lowest margin; below 0 means a device is above its alert limit.</p>
    </fieldset>
}
