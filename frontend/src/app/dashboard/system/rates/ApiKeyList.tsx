'use client'

import { ApiKeyCard, type ApiKeyCardProps } from './ApiKeyCard'
import { EmptyState } from './RateLimitFields'

type Props = { apiKeys: ApiKeySummary[] } & Omit<ApiKeyCardProps, 'apiKey'>

export function ApiKeyList({
    apiKeys,
    ...cardProps
}: Props) {
    return (
        <div className='mt-4 grid gap-4'>
            {apiKeys.length ? apiKeys.map((apiKey) => (
                <ApiKeyCard key={apiKey.id} apiKey={apiKey} {...cardProps} />
            )) : <EmptyState message='No access keys issued yet.' />}
        </div>
    )
}
