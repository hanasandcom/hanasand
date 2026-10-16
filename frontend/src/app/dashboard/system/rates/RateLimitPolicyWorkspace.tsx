'use client'

import { Plus } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { EmptyState, NumberField, RemoveButton, RouteChooser, SelectField } from './RateLimitFields'
import { scopeOrder } from './model'

export function RateLimitPolicyWorkspace({
    settings,
    routeOptions,
    validation,
    updateDefault,
    updateOverride,
    addOverride,
    removeOverride,
}: {
    settings: RateLimitSettings
    routeOptions: string[]
    validation: { valid: boolean, message: string }
    updateDefault: (scope: RateLimitScope, field: keyof RateLimitRule, value: number) => void
    updateOverride: (id: string, field: keyof RateLimitOverride, value: string | number | boolean) => void
    addOverride: () => void
    removeOverride: (id: string) => void
}) {
    return (
        <>
            <div className='grid gap-4 xl:grid-cols-3'>
                {scopeOrder.map((scope) => (
                    <DashboardPanel key={scope} className='p-4 sm:p-5'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <p className='text-[11px] uppercase tracking-[0.24em] text-ui-muted'>{scope}</p>
                                <h2 className='mt-1 text-base font-semibold text-ui-text'>Default limits</h2>
                            </div>
                            <div className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] text-ui-muted'>all routes</div>
                        </div>
                        <div className='mt-4 grid gap-3'>
                            <NumberField label='Window (ms)' value={settings.defaults[scope].windowMs} min={1000} onChange={(value) => updateDefault(scope, 'windowMs', value)} />
                            <NumberField label='Requests per window' value={settings.defaults[scope].maxRequests} min={1} onChange={(value) => updateDefault(scope, 'maxRequests', value)} />
                        </div>
                    </DashboardPanel>
                ))}
            </div>

            <DashboardPanel className='p-4 sm:p-5'>
                <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                    <div>
                        <p className='text-[11px] uppercase tracking-[0.24em] text-ui-muted'>Overrides</p>
                        <h2 className='mt-1 text-base font-semibold text-ui-text'>Route-specific limits</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Set different limits for individual routes without changing the defaults.</p>
                    </div>
                    <button type='button' onClick={addOverride} className='ui-button ui-button-ghost px-3 py-2 text-sm'><Plus className='h-4 w-4' />Add override</button>
                </div>
                <div className='mt-4 grid gap-3'>
                    {settings.overrides.length ? settings.overrides.map((override) => (
                        <div key={override.id} className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 lg:grid-cols-[auto_minmax(0,1fr)_10rem_10rem_8rem_auto] lg:items-end'>
                            <label className='inline-flex items-center gap-2 text-sm text-ui-muted'>
                                <input type='checkbox' checked={override.enabled} onChange={(event) => updateOverride(override.id, 'enabled', event.target.checked)} className='h-4 w-4 accent-ui-primary' />
                                Enabled
                            </label>
                            <RouteChooser
                                label='Route'
                                routeOptions={routeOptions}
                                value={`${override.method} ${override.route}`}
                                onChange={(value) => {
                                    const [method, ...routeParts] = value.split(' ')
                                    updateOverride(override.id, 'method', (method || 'GET').toUpperCase())
                                    updateOverride(override.id, 'route', routeParts.join(' ') || '/api/')
                                }}
                            />
                            <SelectField label='Scope' value={override.scope} options={scopeOrder} onChange={(value) => updateOverride(override.id, 'scope', value as RateLimitScope)} />
                            <NumberField label='Window (ms)' value={override.windowMs} min={1000} onChange={(value) => updateOverride(override.id, 'windowMs', value)} />
                            <NumberField label='Requests' value={override.maxRequests} min={1} onChange={(value) => updateOverride(override.id, 'maxRequests', value)} />
                            <RemoveButton onClick={() => removeOverride(override.id)} />
                        </div>
                    )) : <EmptyState message='No route-specific limits. The defaults apply to every route.' />}
                </div>
                {!validation.valid ? <div className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>{validation.message}</div> : null}
            </DashboardPanel>
        </>
    )
}
