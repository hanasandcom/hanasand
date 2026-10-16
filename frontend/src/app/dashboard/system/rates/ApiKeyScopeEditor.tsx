'use client'

import { periodFields } from './model'
import { NumberField, RemoveButton, RouteChooser } from './RateLimitFields'

export function ApiKeyScopeEditor({
    scope,
    routeOptions,
    title,
    onChange,
    onRemove,
}: {
    scope: ApiKeyScopeRule
    routeOptions: string[]
    title: string
    onChange: (scope: ApiKeyScopeRule) => void
    onRemove: () => void
}) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='mb-3 flex items-center justify-between gap-3'>
                <p className='text-sm font-medium text-ui-text'>{title}</p>
                <RemoveButton onClick={onRemove} />
            </div>
            <div className='grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_repeat(4,minmax(0,1fr))] lg:items-end'>
                <label className='inline-flex items-center gap-2 text-sm text-ui-muted'>
                    <input type='checkbox' checked={scope.enabled} onChange={(event) => onChange({ ...scope, enabled: event.target.checked })} className='h-4 w-4 accent-ui-primary' />
                    Enabled
                </label>
                <RouteChooser
                    label='Route'
                    routeOptions={routeOptions}
                    value={`${scope.method} ${scope.route}`}
                    onChange={(value) => {
                        const [method, ...routeParts] = value.split(' ')
                        onChange({ ...scope, method: (method || 'GET').toUpperCase(), route: routeParts.join(' ') || '/api/' })
                    }}
                />
                {periodFields.map((period) => (
                    <NumberField
                        key={period.key}
                        label={period.label}
                        value={scope.limits[period.key] || 0}
                        min={0}
                        onChange={(value) => onChange({
                            ...scope,
                            limits: { ...scope.limits, [period.key]: value > 0 ? value : null },
                        })}
                    />
                ))}
            </div>
        </div>
    )
}
