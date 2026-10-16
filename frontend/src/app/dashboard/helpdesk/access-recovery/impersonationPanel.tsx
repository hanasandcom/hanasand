import { inputClass, textAreaClass, primaryButton, secondaryButton, Message } from './shared'
import { useAccessRecoveryContext } from './context'

export function ImpersonationPanel() {
    const { submitImpersonation, stopImpersonation, impersonationMessage, impersonationResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <div>
                <h3 className='text-sm font-semibold text-ui-text'>Scoped impersonation</h3>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>Start or end a support session with a reason, target, duration, scope, and audit trail.</p>
            </div>
            <form className='grid gap-2' onSubmit={submitImpersonation}>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <input className={inputClass} name='targetId' placeholder='Target user ID' required />
                    <input className={inputClass} name='organizationId' placeholder='Organization ID' />
                    <input className={inputClass} name='supportSessionId' placeholder='Support session ID' />
                    <select className={inputClass} name='durationMinutes' defaultValue='30' required>
                        <option value='15'>15 minutes</option>
                        <option value='30'>30 minutes</option>
                        <option value='60'>60 minutes</option>
                        <option value='120'>120 minutes</option>
                        <option value='240'>240 minutes</option>
                    </select>
                </div>
                <div className='flex flex-wrap gap-2 rounded-md border border-ui-border bg-ui-canvas p-2 text-xs text-ui-muted'>
                    {[
                        ['read_profile', 'Profile'],
                        ['read_org', 'Organization'],
                        ['support_debug', 'Debug'],
                    ].map(([value, label]) => (
                        <label className='inline-flex items-center gap-2 rounded-md bg-ui-panel px-2 py-1' key={value}>
                            <input className='accent-ui-primary' defaultChecked={value !== 'support_debug'} name='scope' type='checkbox' value={value} />
                            {label}
                        </label>
                    ))}
                </div>
                <textarea className={textAreaClass} name='reason' placeholder='Audit reason with support case or requester' minLength={10} required />
                <button className={primaryButton} disabled={submitting === 'impersonation'} type='submit'>{submitting === 'impersonation' ? 'Starting...' : 'Start scoped session'}</button>
            </form>
            <details className='rounded-md border border-ui-border bg-ui-canvas'>
                <summary className='cursor-pointer list-none px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/20'>End current session</summary>
                <form className='grid gap-2 border-t border-ui-border p-3' onSubmit={stopImpersonation}>
                    <input className={inputClass} name='context' placeholder='Session close context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Stop reason with support case or requester' minLength={10} required />
                    <button className={secondaryButton} disabled={submitting === 'stop'} type='submit'>{submitting === 'stop' ? 'Ending...' : 'End current session'}</button>
                </form>
            </details>
            <Message value={impersonationMessage} tone={impersonationMessage.includes('failed') || impersonationResult?.error ? 'error' : 'success'} />
            {impersonationResult?.session ? (
                <div className='rounded-md border border-ui-border bg-ui-canvas p-3 text-xs leading-5 text-ui-muted'>
                    <div className='font-semibold text-ui-text'>{impersonationResult.session.target?.name || impersonationResult.session.target?.id}</div>
                    <div>expires {impersonationResult.session.expires_at || 'active session'} · scope {(impersonationResult.session.scope || []).join(', ') || 'default'}</div>
                </div>
            ) : null}
        </section>
    )
}
