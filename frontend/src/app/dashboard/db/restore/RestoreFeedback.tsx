export function RestoreFeedback({ message, tone = 'error' }: { message: string, tone?: 'error' | 'success' }) {
    const feedback = tone === 'error'
        ? { role: 'alert' as const, className: 'border-ui-danger/30 bg-ui-raised/10 text-ui-text' }
        : { role: 'status' as const, className: 'border-ui-success/30 bg-ui-success/10 text-ui-success' }

    return <p role={feedback.role} className={`mt-4 rounded-lg border p-3 text-sm ${feedback.className}`}>{message}</p>
}
