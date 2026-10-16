import { inputClass, textAreaClass, primaryButton, Message, auditHref } from './shared'
import { useAccessRecoveryContext } from './context'

export function MemberPanel() {
    const { submitMemberRoleRecovery, memberRoleMessage, memberRoleResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <div>
                <h3 className='text-sm font-semibold text-ui-text'>Member role recovery</h3>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>Change one active membership role when org administration is unavailable.</p>
            </div>
            <form className='grid gap-2' onSubmit={submitMemberRoleRecovery}>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <input className={inputClass} name='organizationId' placeholder='Organization ID' required />
                    <input className={inputClass} name='userId' placeholder='User ID' required />
                    <select className={inputClass} name='role' defaultValue='admin'>
                        <option value='admin'>Admin</option>
                        <option value='editor'>Editor</option>
                        <option value='reader'>Reader</option>
                    </select>
                    <input className={inputClass} name='supportSessionId' placeholder='Support session ID' />
                    <input className={inputClass} name='idempotencyKey' placeholder='Idempotency key' />
                </div>
                <input className={inputClass} name='context' placeholder='Case context' />
                <textarea className={textAreaClass} name='reason' placeholder='Audit reason with requester and case' minLength={10} required />
                <button className={primaryButton} disabled={submitting === 'member'} type='submit'>{submitting === 'member' ? 'Recovering...' : 'Recover member role'}</button>
            </form>
            <Message value={memberRoleMessage} tone={memberRoleResult?.error ? 'error' : memberRoleMessage ? 'success' : 'neutral'} />
            {memberRoleResult?.memberRoleRecovery ? (
                <div className='grid gap-1 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                    <div className='font-semibold text-ui-text'>{memberRoleResult.memberRoleRecovery.outcome} · {memberRoleResult.memberRoleRecovery.member?.name || 'member'}</div>
                    <div>role {memberRoleResult.memberRoleRecovery.member?.role || memberRoleResult.memberRoleRecovery.requestedRole || 'updated'}</div>
                    <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(memberRoleResult.memberRoleRecovery.requestId, memberRoleResult.memberRoleRecovery.audit?.actionType)}>Open role audit</a>
                </div>
            ) : null}
        </section>
    )
}
