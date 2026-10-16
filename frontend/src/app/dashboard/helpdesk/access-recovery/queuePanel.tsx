import { inputClass, secondaryButton, Message, auditHref } from './shared'
import { useAccessRecoveryContext } from './context'

export function QueuePanel() {
    const { submitSearch, searchMessage, searchResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <h3 className='text-sm font-semibold text-ui-text'>Recovery queue</h3>
            <form className='grid gap-2' onSubmit={submitSearch}>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <input className={inputClass} name='request' placeholder='Recovery request ID' />
                    <input className={inputClass} name='org' placeholder='Organization ID' />
                    <select className={inputClass} name='status' defaultValue=''>
                        <option value=''>Status</option>
                        <option value='pending_approval'>Pending</option>
                        <option value='approved'>Approved</option>
                        <option value='denied'>Denied</option>
                        <option value='not_required'>Not required</option>
                    </select>
                    <select className={inputClass} name='outcome' defaultValue=''>
                        <option value=''>Outcome</option>
                        <option value='success'>Success</option>
                        <option value='denied'>Denied</option>
                        <option value='failed'>Failed</option>
                    </select>
                    <input className={inputClass} name='requester' placeholder='Requester' />
                    <input className={inputClass} name='approver' placeholder='Approver or denier' />
                </div>
                <button className={secondaryButton} disabled={submitting === 'search'} type='submit'>{submitting === 'search' ? 'Searching...' : 'Search queue'}</button>
            </form>
            <Message value={searchMessage} />
            {searchResult?.approvals?.length ? (
                <div className='grid gap-2'>
                    {searchResult.approvals.map(approval => (
                        <div className='grid gap-2 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted' key={approval.requestId}>
                            <div className='flex flex-wrap gap-2 font-medium text-ui-text'>
                                <span>{approval.status}</span>
                                <span>{approval.outcome}</span>
                                <span>{approval.invite.email}</span>
                            </div>
                            <div className='text-xs'>request {approval.requestId} · audit {approval.auditEventIds?.join(', ') || 'pending'}</div>
                            <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(approval.requestId)}>Open request audit</a>
                        </div>
                    ))}
                </div>
            ) : searchResult ? (
                <p className='rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>Recovery request filters are clear.</p>
            ) : null}
        </section>
    )
}
