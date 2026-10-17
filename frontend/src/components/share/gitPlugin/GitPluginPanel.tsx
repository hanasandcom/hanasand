import type { ReactNode } from 'react'

export function GitPluginPanel({ children }: { children: ReactNode }) {
    return <div className='rounded-lg border border-ui-border bg-ui-raised p-2.5'>{children}</div>
}
