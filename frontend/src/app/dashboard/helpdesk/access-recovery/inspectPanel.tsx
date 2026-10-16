import { inspectionMemberId, inspectionMemberName, inputClass, textAreaClass, primaryButton, Message } from './shared'
import { useAccessRecoveryContext } from './context'

export function InspectionPanel() {
    const { submitInspection, inspectionMessage, inspectionResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <div>
                <h3 className='text-sm font-semibold text-ui-text'>Support inspection</h3>
            </div>
            <form className='grid gap-2' onSubmit={submitInspection}>
                <div className='grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]'>
                    <select className={inputClass} name='targetType' defaultValue='organization'>
                        <option value='organization'>Org</option>
                        <option value='user'>User</option>
                    </select>
                    <input className={inputClass} name='targetId' placeholder='Organization or user ID' required />
                </div>
                <input className={inputClass} name='context' placeholder='Support case or customer context' />
                <textarea className={textAreaClass} name='reason' placeholder='Audit reason with support case or requester' minLength={10} required />
                <button className={primaryButton} disabled={submitting === 'inspect'} type='submit'>{submitting === 'inspect' ? 'Inspecting...' : 'Inspect access'}</button>
            </form>
            <Message value={inspectionMessage} tone={inspectionResult?.error ? 'error' : inspectionMessage ? 'success' : 'neutral'} />
            {inspectionResult && !inspectionResult.error ? (
                <div className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className='font-semibold text-ui-text'>{inspectionResult.organization?.name || inspectionResult.user?.name || inspectionResult.organization?.id || inspectionResult.user?.id || 'Inspection'}</span>
                        {inspectionResult.accessStatus?.overall ? <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-xs text-ui-primary'>{inspectionResult.accessStatus.overall}</span> : null}
                    </div>
                    <div className='grid grid-cols-2 gap-2 text-xs sm:grid-cols-4'>
                        <span className='rounded-md bg-ui-panel px-2 py-1'>members {(inspectionResult.members || inspectionResult.memberships || []).length}</span>
                        <span className='rounded-md bg-ui-panel px-2 py-1'>invites {(inspectionResult.invites || inspectionResult.pendingInvites || []).length}</span>
                        <span className='rounded-md bg-ui-panel px-2 py-1'>watchlists {(inspectionResult.watchlistItems || []).length}</span>
                        <span className='rounded-md bg-ui-panel px-2 py-1'>webhooks {(inspectionResult.webhookDestinations || []).length}</span>
                    </div>
                    {(inspectionResult.members || inspectionResult.memberships || []).length ? (
                        <div className='grid gap-1'>
                            <div className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-muted'>Roles</div>
                            {(inspectionResult.members || inspectionResult.memberships || []).slice(0, 6).map((member, index) => (
                                <div className='grid gap-1 rounded-md bg-ui-panel px-2 py-1 text-xs sm:grid-cols-[minmax(0,1fr)_5rem_5rem]' key={inspectionMemberId(member, index)}>
                                    <span className='truncate'>{inspectionMemberName(member)}</span>
                                    <span>{member.role || 'role'}</span>
                                    <span>{member.status || 'status'}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {(inspectionResult.invites || inspectionResult.pendingInvites || []).length ? (
                        <div className='grid gap-1'>
                            <div className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-muted'>Invites</div>
                            {(inspectionResult.invites || inspectionResult.pendingInvites || []).slice(0, 6).map((invite, index) => (
                                <div className='grid gap-1 rounded-md bg-ui-panel px-2 py-1 text-xs sm:grid-cols-[minmax(0,1fr)_5rem_6rem]' key={`${invite.id || invite.email || index}`}>
                                    <span className='truncate'>{invite.email || invite.id}</span>
                                    <span>{invite.role || 'role'}</span>
                                    <span>{invite.status || 'status'}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {(inspectionResult.recentAuditEvents || []).length ? (
                        <div className='grid gap-1'>
                            <div className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-muted'>Recent audit</div>
                            {(inspectionResult.recentAuditEvents || []).slice(0, 4).map((event, index) => (
                                <a className='grid gap-1 rounded-md bg-ui-panel px-2 py-1 text-xs text-ui-text hover:bg-ui-raised' href={event.id ? `/helpdesk?entity=${encodeURIComponent(String(event.id))}` : '/helpdesk'} key={`${event.id || index}`}>
                                    <span>{event.actionType || event.action_type || 'audit event'} · {event.outcome || 'outcome'}</span>
                                    {event.reason ? <span className='truncate text-ui-muted'>{event.reason}</span> : null}
                                </a>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    )
}
