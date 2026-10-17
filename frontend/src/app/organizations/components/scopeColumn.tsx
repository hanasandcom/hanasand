import type { ReactNode } from 'react'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { workspaceShareUrl } from '@/utils/organizations/workspace'
import { iconButtonClass } from '../constants/styles'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'
import { EmptyLine, RowStatus } from './shared'
import { Copy, ExternalLink } from 'lucide-react'
import { useClipboardStatus } from './useClipboardStatus'
import { useExpandableRows } from './useExpandableRows'

export function ScopeColumn({ icon, title, route, rows, empty, rowPrefix }: { icon: ReactNode, title: string, route: string, rows: Array<{ id: string, primary: string, secondary: string, href?: string }>, empty: string, rowPrefix?: string }) {
    const { organizationId } = useWorkspace()
    const { status: copyStatus, copy } = useClipboardStatus()
    const showRecordActions = !route.startsWith('/api/')
    const { visibleRows, moreButton } = useExpandableRows(rows, 5)
    const copyRoute = () => copy(workspaceShareUrl(route, organizationId), 'Records link copied.')
    return (
        <div className='rounded-lg border border-ui-border p-3 dark:border-ui-border'>
            <div className='flex items-center justify-between gap-3'>
                <h3 className='flex items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>{icon}{title}</h3>
                {showRecordActions ? (
                    <div className='flex items-center gap-1'>
                        <button type='button' className={iconButtonClass} aria-label={`Copy ${title} records link`} onClick={() => void copyRoute()} data-org-scope-copy='true'>
                            <Copy className='h-4 w-4' />
                        </button>
                        <a href={route} className={iconButtonClass} aria-label={`Open ${title} records`}>
                            <ExternalLink className='h-4 w-4' />
                        </a>
                    </div>
                ) : null}
            </div>
            <div className='mt-3 grid gap-2'>
                {rows.length === 0 && <EmptyLine text={empty} />}
                {visibleRows.map(row => {
                    const content = (
                        <>
                            <p className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(row.primary) || row.primary}</p>
                            <p className='truncate text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(row.secondary) || row.secondary}</p>
                        </>
                    )
                    const className = 'scroll-mt-24 rounded-md bg-ui-raised p-2 transition hover:bg-ui-panel dark:bg-ui-canvas dark:hover:bg-ui-raised'
                    return row.href ? (
                        <a key={row.id} href={row.href} id={rowPrefix ? `${rowPrefix}-${encodeURIComponent(row.id)}` : undefined} className={className}>
                            {content}
                        </a>
                    ) : (
                        <div key={row.id} id={rowPrefix ? `${rowPrefix}-${encodeURIComponent(row.id)}` : undefined} className={className}>
                            {content}
                        </div>
                    )
                })}
                {moreButton}
            </div>
            <div className='mt-3'><RowStatus message={copyStatus} /></div>
        </div>
    )
}
