'use client'

import { ApiKeyScopeEditor } from './ApiKeyScopeEditor'

export function ApiKeyScopeRows({
    scopes,
    routeOptions,
    onChange,
    onRemove,
}: {
    scopes: ApiKeyScopeRule[]
    routeOptions: string[]
    onChange: (scope: ApiKeyScopeRule) => void
    onRemove: (scopeId: string) => void
}) {
    return scopes.map((scope, index) => (
        <ApiKeyScopeEditor
            key={scope.id}
            scope={scope}
            routeOptions={routeOptions}
            title={`Route ${index + 1}`}
            onChange={onChange}
            onRemove={() => onRemove(scope.id)}
        />
    ))
}
