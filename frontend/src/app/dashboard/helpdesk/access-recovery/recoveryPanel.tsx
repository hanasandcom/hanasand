import { inputClass, textAreaClass, primaryButton, Message, CopyBlock, auditHref } from './shared'
import { useAccessRecoveryContext } from './context'

export function RecoveryPanel() {
    const { submitRecovery, recoveryMessage, recoveryResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <div>
                <h3 className='text-sm font-semibold text-ui-text'>Access recovery</h3>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>Generate a controlled recovery invite, then review its audit trail.</p>
            </div>
            <form className='grid gap-2' onSubmit={submitRecovery}>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <input className={inputClass} name='organizationId' placeholder='Organization ID' required />
                    <input className={inputClass} name='email' placeholder='Recovery email' required type='email' />
                    <input className={inputClass} name='targetUserId' placeholder='Target user ID' />
                    <select className={inputClass} name='role' defaultValue='admin'>
                        <option value='admin'>Admin</option>
                        <option value='editor'>Editor</option>
                        <option value='reader'>Reader</option>
                    </select>
                </div>
                <input className={inputClass} name='caseId' placeholder='Support case ID' />
                <input className={inputClass} name='context' placeholder='Recovery context' />
                <textarea className={textAreaClass} name='reason' placeholder='Audit reason with support case or requester' minLength={10} required />
                <label className='flex items-center gap-2 text-sm text-ui-muted'>
                    <input className='h-4 w-4 accent-ui-primary' name='approvalRequired' type='checkbox' />
                    Require second review
                </label>
                <button className={primaryButton} disabled={submitting === 'recovery'} type='submit'>{submitting === 'recovery' ? 'Generating...' : 'Generate recovery invite'}</button>
            </form>
            <Message value={recoveryMessage} tone={recoveryResult?.error ? 'error' : recoveryMessage ? 'success' : 'neutral'} />
            {recoveryResult?.recovery ? (
                <div className='grid gap-2 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                    <div className='flex flex-wrap gap-2 font-medium text-ui-text'>
                        <span>Request {recoveryResult.recovery.requestId}</span>
                        <span>{recoveryResult.recovery.invite.email}</span>
                        <span>{recoveryResult.recovery.approvalStatus}</span>
                    </div>
                    <div>{recoveryResult.recovery.invite.role} until {recoveryResult.recovery.invite.expiresAt}</div>
                    <CopyBlock value={recoveryResult.recovery.copyText} />
                    <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(recoveryResult.recovery.requestId, recoveryResult.recovery.audit.actionType)}>Open audit trail</a>
                </div>
            ) : null}
        </section>
    )
}
