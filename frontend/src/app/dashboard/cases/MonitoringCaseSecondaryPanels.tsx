import { CaseEvents } from './case-events'
import type { MonitoringCase, CaseTab } from './monitoringCaseTypes'
import { date, NotificationText, notificationText } from './monitoringCaseText'

export function MonitoringCaseSecondaryPanels({ item, tab, busy, loadingEvents, save, moreEvents }: {
    item: MonitoringCase
    tab: CaseTab
    busy: boolean
    loadingEvents: boolean
    save: (change: Record<string, unknown>) => void
    moreEvents: () => void
}) {
    return <>
        <div id='case-panel-settings' role='tabpanel' aria-labelledby='case-tab-settings' hidden={tab !== 'settings'}>
            <section aria-labelledby='case-notification-settings' className='grid gap-4 p-5 sm:p-6'>
                <h2 id='case-notification-settings' className='text-lg font-semibold'>Notification settings ({item.notifications.filter(notification => notification.deliveredAt).length})</h2>
                <label className='flex items-center gap-3 text-sm'><input type='checkbox' className='h-4 w-4' checked={item.notificationsEnabled} disabled={busy || item.canManage === false} onChange={event => save({ notificationsEnabled: event.target.checked })} />Enable notifications for this case</label>
                <h3 className='text-sm font-medium'>Delivery history</h3>
                {item.notifications.length ? item.notifications.map((notification, index) => <article className='grid gap-2 rounded-lg bg-ui-canvas p-3 text-sm' key={notification.messageId || index}>
                    <p>{notification.deliveredAt ? `Delivered ${date(notification.deliveredAt)}` : 'Delivery pending'}</p>
                    {notification.error && <p className='text-ui-text'>{notification.error}</p>}
                    {notification.message ? <div className='grid gap-3 [overflow-wrap:anywhere]'>
                        {notification.message.content && <NotificationText text={notification.message.content} />}
                        {notification.message.embeds?.map((embed, embedIndex) => <div key={embedIndex} className='grid gap-2 border-l-2 border-ui-border pl-3'>
                            {embed.title && <p className='font-semibold'>{notificationText(embed.title)}</p>}
                            {embed.description && <NotificationText text={embed.description} />}
                            {embed.fields?.length ? <dl className='grid gap-2 sm:grid-cols-2'>{embed.fields.map((field, fieldIndex) => <div key={fieldIndex}>
                                <dt className='text-ui-muted'>{field.name}</dt>
                                <dd><NotificationText text={field.value} /></dd>
                            </div>)}</dl> : null}
                        </div>)}
                    </div> : notification.deliveredAt && <p className='text-ui-muted'>Original message content is unavailable.</p>}
                    {notification.messageId && <p className='wrap-break-word text-xs text-ui-muted'>Message ID: {notification.messageId}</p>}
                </article>) : <p className='text-sm text-ui-muted'>No notifications sent.</p>}
            </section>
        </div>
        <div id='case-panel-history' role='tabpanel' aria-labelledby='case-tab-history' hidden={tab !== 'history'}>
            <details className='border-b border-ui-border'>
                <summary id='case-history' className='cursor-pointer px-5 py-4 text-lg font-semibold sm:px-6'>Case history</summary>
                <div className='px-5 pb-5 sm:px-6 sm:pb-6'>
                    <div className='overflow-x-auto rounded-lg border border-ui-border' role='region' aria-label='History timeline' tabIndex={0}>
                        <table aria-labelledby='case-history' className='w-full min-w-[720px] text-left text-sm'>
                            <thead className='border-b border-ui-border bg-ui-canvas text-ui-muted'><tr>
                                {['Time', 'Event', 'Actor', 'Details'].map(label => <th key={label} scope='col' className='px-4 py-3 font-medium'>{label}</th>)}
                            </tr></thead>
                            <tbody className='divide-y divide-ui-border'>{item.history?.map(event => <tr key={event.id} className='align-top'>
                                <td className='whitespace-nowrap px-4 py-3 tabular-nums'><time dateTime={event.at}>{date(event.at)}</time></td>
                                <td className='whitespace-nowrap px-4 py-3 font-medium capitalize'>{event.action.replaceAll('_', ' ')}</td>
                                <td className='min-w-40 px-4 py-3 [overflow-wrap:anywhere]'>{event.actor}</td>
                                <td className='w-full min-w-64 space-y-1 px-4 py-3 [overflow-wrap:anywhere]'>
                                    {event.fromStatus !== event.toStatus && <p>{event.fromStatus?.replaceAll('_', ' ')} → {event.toStatus?.replaceAll('_', ' ')}</p>}
                                    {event.fromSeverity !== event.toSeverity && <p>Severity: {event.fromSeverity} → {event.toSeverity}</p>}
                                    {event.action === 'notifications_changed' && <p>Notifications {event.notificationsEnabled ? 'enabled' : 'disabled'}</p>}
                                    {event.note && <p className='whitespace-pre-wrap'>{event.note}</p>}
                                </td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                </div>
            </details>
        </div>
        <div id='case-panel-events' role='tabpanel' aria-labelledby='case-tab-events' hidden={tab !== 'events'}>
            <CaseEvents events={item.events || []} total={item.eventTotal || 0} occurrences={item.occurrences} loading={loadingEvents} onMore={moreEvents} />
        </div>
    </>
}
