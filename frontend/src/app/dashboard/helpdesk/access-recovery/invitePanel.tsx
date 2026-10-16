import { inputClass, textAreaClass, primaryButton, Message, auditHref } from './shared'
import { useAccessRecoveryContext } from './context'

export function InvitePanel() {
    const { submitInviteAction, inviteActionMessage, inviteActionResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <div>
                <h3 className='text-sm font-semibold text-ui-text'>Invite support</h3>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>Resend or revoke an organization invite with support session scope and audit replay.</p>
            </div>
            <form className='grid gap-2' onSubmit={submitInviteAction}>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <input className={inputClass} name='organizationId' placeholder='Organization ID' required />
                    <input className={inputClass} name='inviteId' placeholder='Invite ID' required />
                    <select className={inputClass} name='action' defaultValue='resend'>
                        <option value='resend'>Resend</option>
                        <option value='revoke'>Revoke</option>
                    </select>
                    <input className={inputClass} name='expiresAt' placeholder='Resend expiry ISO timestamp' />
                    <input className={inputClass} name='supportSessionId' placeholder='Support session ID' />
                    <input className={inputClass} name='idempotencyKey' placeholder='Idempotency key' />
                </div>
                <input className={inputClass} name='context' placeholder='Case context' />
                <textarea className={textAreaClass} name='reason' placeholder='Audit reason with requester and case' minLength={10} required />
                <button className={primaryButton} disabled={submitting === 'invite'} type='submit'>{submitting === 'invite' ? 'Applying...' : 'Apply invite action'}</button>
            </form>
            <Message value={inviteActionMessage} tone={inviteActionResult?.error ? 'error' : inviteActionMessage ? 'success' : 'neutral'} />
            {inviteActionResult?.inviteAction ? (
                <div className='grid gap-1 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                    <div className='font-semibold text-ui-text'>{inviteActionResult.inviteAction.action} · {inviteActionResult.inviteAction.outcome}</div>
                    <div>{inviteActionResult.inviteAction.invite?.email || 'invite'} · {inviteActionResult.inviteAction.invite?.status || 'status'}</div>
                    <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(inviteActionResult.inviteAction.requestId, inviteActionResult.inviteAction.audit?.actionType)}>Open invite audit</a>
                </div>
            ) : null}
        </section>
    )
}
