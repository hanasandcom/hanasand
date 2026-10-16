import Link from 'next/link'
import { inputClass, textAreaClass, primaryButton, Message } from './shared'
import { useAccessRecoveryContext } from './context'

export function ApiUsagePanel() {
    const { submitApiUsageReset, apiUsageResetMessage, apiUsageResetResult, submitting } = useAccessRecoveryContext()
    return (
        <section className='grid gap-3'>
            <div>
                <h3 className='text-sm font-semibold text-ui-text'>API usage reset</h3>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>Resets live API-key rate-limit buckets and records a warning audit event; durable quota/billing adjustments still belong in Rate Limits.</p>
            </div>
            <form className='grid gap-2' onSubmit={submitApiUsageReset}>
                <input className={inputClass} name='apiKeyId' placeholder='API key ID' required />
                <textarea className={textAreaClass} name='reason' placeholder='Audit reason with customer approval and case' minLength={10} required />
                <button className={primaryButton} disabled={submitting === 'apiUsage'} type='submit'>{submitting === 'apiUsage' ? 'Resetting...' : 'Reset API usage buckets'}</button>
            </form>
            <Link className='text-sm font-semibold text-ui-primary hover:opacity-80' href='/system/rates'>Open API keys and limit policy</Link>
            <Message value={apiUsageResetMessage} tone={apiUsageResetResult?.error ? 'error' : apiUsageResetMessage ? 'success' : 'neutral'} />
            {apiUsageResetResult?.reset ? (
                <div className='rounded-md border border-ui-border bg-ui-canvas p-3 text-xs leading-5 text-ui-muted'>
                    <div className='font-semibold text-ui-text'>{apiUsageResetResult.reset.keyPrefix}</div>
                    <div>{apiUsageResetResult.reset.resetBucketCount} live buckets reset · audit {apiUsageResetResult.reset.auditAction}</div>
                </div>
            ) : null}
        </section>
    )
}
