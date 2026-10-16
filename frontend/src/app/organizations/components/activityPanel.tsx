import type { ActivityItem, ActivitySubject, RowMessage } from '../types/activity'
import type { OrganizationSummary } from '../types/organization'
import { activitySubjectTypeLabel, activitySourceLabel } from '../model/activityLabels'
import { SectionTitle, RowStatus, EmptyLine } from './shared'
import { organizationDisplayName } from '../model/organization'
import type { OrgBundle } from '../types/bundle'
import { activityRowsForSubject, organizationWorkspaceSelectionHref, activitySubjectFromItem } from '../model/activityNavigation'
import { selectedContextRows, selectedSubjectLabel } from '../model/activityContext'
import { ORG_ACTIVITY_PREVIEW_ROWS } from '../constants/activity'
import { selectedSubjectActions } from '../model/activityActions'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'
import { formatDate } from '../model/labels'
import { secondaryButtonClass } from '../constants/styles'
import { CheckCircle2, CircleAlert, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'

export function ActivityPanel({ organization, bundle, activity, selectedSubject, onSelectSubject }: { organization: OrganizationSummary, bundle: OrgBundle, activity: ActivityItem[], selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void }) {
    const [copyStatus, setCopyStatus] = useState<RowMessage | undefined>()
    const [showAll, setShowAll] = useState(false)
    const selectedRows = activityRowsForSubject(activity, selectedSubject)
    const contextRows = selectedContextRows(selectedSubject, organization, bundle)
    const sourceRows = selectedSubject.type === 'organization' ? activity : selectedRows
    const visibleRows = showAll ? sourceRows : sourceRows.slice(0, ORG_ACTIVITY_PREVIEW_ROWS)
    const totalRows = selectedSubject.type === 'organization' ? activity.length : selectedRows.length
    const hiddenRows = Math.max(0, totalRows - visibleRows.length)
    const sessionRows = selectedRows.filter(item => item.source === 'session').length
    const savedRows = totalRows - sessionRows
    const contextActions = selectedSubjectActions(selectedSubject, organization, bundle)
    const subjectTypeLabel = activitySubjectTypeLabel(selectedSubject.type)
    const copySelectedActivity = async () => {
        try {
            const heading = `${organizationDisplayName(organization)} · ${subjectTypeLabel}`
            const context = contextRows.map(row => `${row.label}: ${sanitizeOrganizationDisplayCopy(row.value) || 'redacted'}`)
            const rows = visibleRows.slice(0, 8).map(item => `${formatDate(item.at)} · ${activitySourceLabel(item)} · ${sanitizeOrganizationDisplayCopy(item.title) || 'Activity'} · ${sanitizeOrganizationDisplayCopy(item.detail) || 'redacted'}`)
            await navigator.clipboard.writeText([heading, ...context, ...rows].filter(Boolean).join('\n'))
            setCopyStatus({ ok: true, text: 'Activity copied.' })
        } catch {
            setCopyStatus({ ok: false, text: 'Copy failed.' })
        }
    }
    const copySelectedLink = async () => {
        try {
            await navigator.clipboard.writeText(organizationWorkspaceSelectionHref(organization.id, selectedSubject) || window.location.href)
            setCopyStatus({ ok: true, text: 'Link copied.' })
        } catch {
            setCopyStatus({ ok: false, text: 'Copy failed.' })
        }
    }
    return (
        <section id='audit' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <SectionTitle icon={<CheckCircle2 className='h-4 w-4' />} title='Activity' detail='Selected row, delivery, and team actions.' />
            <div className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(selectedSubjectLabel(selectedSubject, organization, bundle))}</p>
                        <p className='truncate text-xs text-ui-muted dark:text-ui-muted'>{subjectTypeLabel} · {totalRows} event{totalRows === 1 ? '' : 's'} · {savedRows} saved · {sessionRows} session</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        {contextActions.map(action => (
                            <a key={action.href} href={action.href} className={secondaryButtonClass} data-org-activity-context-action='true'>
                                <ExternalLink className='h-4 w-4' />
                                {action.label}
                            </a>
                        ))}
                        <button type='button' className={secondaryButtonClass} onClick={() => void copySelectedActivity()} data-org-activity-copy='true'>
                            <Copy className='h-4 w-4' />
                            Copy
                        </button>
                        <button type='button' className={secondaryButtonClass} onClick={() => void copySelectedLink()} data-org-activity-copy-link='true'>
                            <Copy className='h-4 w-4' />
                            Copy link
                        </button>
                        <button type='button' className={secondaryButtonClass} onClick={() => onSelectSubject({ type: 'organization', id: organization.id })}>
                            All
                        </button>
                    </div>
                </div>
                <dl className='grid gap-2 text-xs sm:grid-cols-2'>
                    {contextRows.map(row => (
                        <div key={row.label} className='min-w-0 rounded-md bg-ui-panel px-2 py-1.5 dark:bg-ui-panel'>
                            <dt className='truncate font-semibold text-ui-muted dark:text-ui-muted'>{row.label}</dt>
                            <dd className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(row.value) || row.value}</dd>
                        </div>
                    ))}
                </dl>
                <RowStatus message={copyStatus} />
            </div>
            <div className='mt-4 grid gap-2'>
                {activity.length === 0 && <EmptyLine text='Activity appears after team, watchlist, or destination actions.' />}
                {activity.length > 0 && selectedRows.length === 0 && selectedSubject.type !== 'organization' && <EmptyLine text='Select a row with recent team, watchlist, or delivery activity.' />}
                {visibleRows.map(item => {
                    const itemSubject = activitySubjectFromItem(item, organization.id)
                    const selected = itemSubject?.type === selectedSubject.type && itemSubject.id === selectedSubject.id
                    return (
                        <div
                            key={item.id}
                            role='button'
                            tabIndex={0}
                            aria-pressed={selected}
                            className={`rounded-lg border p-3 text-left transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-panel' : 'border-ui-border hover:bg-ui-raised dark:border-ui-border dark:hover:bg-ui-panel'}`}
                            onClick={() => itemSubject && onSelectSubject(itemSubject)}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    if (itemSubject) onSelectSubject(itemSubject)
                                }
                            }}
                            data-org-activity-row='true'
                        >
                            <div className='flex items-start gap-2'>
                                {item.ok ? <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' /> : <CircleAlert className='mt-0.5 h-4 w-4 shrink-0 text-ui-text' />}
                                <div className='min-w-0 flex-1'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <p className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(item.title) || item.title}</p>
                                        <span className='rounded-md bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>{activitySourceLabel(item)}</span>
                                        {item.subjectType && <span className='rounded-md bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>{item.subjectType}</span>}
                                    </div>
                                    <p className='mt-1 text-sm leading-5 text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(item.detail) || item.detail}</p>
                                    {item.metadata && item.metadata.length > 0 && (
                                        <div className='mt-2 grid gap-1 text-[11px] text-ui-muted dark:text-ui-muted'>
                                            {item.metadata.slice(0, 3).map(row => <span key={`${item.id}-${row.label}`} className='truncate'>{row.label}: {sanitizeOrganizationDisplayCopy(row.value) || row.value}</span>)}
                                        </div>
                                    )}
                                    <p className='mt-2 text-xs text-ui-muted dark:text-ui-muted'>{formatDate(item.at)}</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {totalRows > ORG_ACTIVITY_PREVIEW_ROWS && (
                    <button
                        type='button'
                        className='w-fit rounded-md bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted transition hover:text-ui-text dark:bg-ui-canvas dark:text-ui-muted dark:hover:text-ui-text'
                        onClick={() => setShowAll(current => !current)}
                    >
                        {showAll ? 'Show latest' : `${hiddenRows} more`}
                    </button>
                )}
            </div>
        </section>
    )
}
