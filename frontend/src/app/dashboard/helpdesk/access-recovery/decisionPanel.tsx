import { inputClass, textAreaClass, secondaryButton, Message, CopyBlock, auditHref } from './shared'
import { useAccessRecoveryContext } from './context'

export function DecisionPanel() {
    const { submitDecision, decisionMessage, decisionResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <h3 className='text-sm font-semibold text-ui-text'>Recovery decision</h3>
            <form className='grid gap-2' onSubmit={submitDecision}>
                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]'>
                    <input className={inputClass} name='requestId' placeholder='Recovery request ID' required />
                    <select className={inputClass} name='action' defaultValue='approve'>
                        <option value='approve'>Approve</option>
                        <option value='deny'>Deny</option>
                    </select>
                </div>
                <input className={inputClass} name='context' placeholder='Review context' />
                <textarea className={textAreaClass} name='reason' placeholder='Approval or denial reason' minLength={10} required />
                <button className={secondaryButton} disabled={submitting === 'decision'} type='submit'>{submitting === 'decision' ? 'Recording...' : 'Record decision'}</button>
            </form>
            <Message value={decisionMessage} tone={decisionResult?.error ? 'error' : decisionMessage ? 'success' : 'neutral'} />
            {decisionResult?.decision ? (
                <div className='grid gap-2 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                    <div className='flex flex-wrap gap-2 font-medium text-ui-text'>
                        <span>{decisionResult.decision.status}</span>
                        <span>{decisionResult.decision.invite.email}</span>
                        <span>{decisionResult.decision.invite.status}</span>
                    </div>
                    <CopyBlock value={decisionResult.decision.copyText} />
                    <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(decisionResult.decision.requestId)}>Open decision audit</a>
                </div>
            ) : null}
        </section>
    )
}
