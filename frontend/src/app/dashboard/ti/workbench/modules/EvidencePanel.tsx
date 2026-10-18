import type { ReactNode } from 'react'

export function EvidencePanel({ children }: { children: ReactNode }) {
    return <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>{children}</div>
}
