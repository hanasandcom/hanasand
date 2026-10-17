type Props = {
    label: string
    value: string
    detail?: string
    mono?: boolean
    layout: 'summary' | 'metadata'
    className?: string
}

export default function DatabaseEvidence({ label, value, detail, mono = false, layout, className = '' }: Props) {
    const summary = layout === 'summary'
    return (
        <div className={className || undefined}>
            <dt className='text-xs font-semibold uppercase text-ui-muted'>{label}</dt>
            <dd className={`mt-1 ${summary ? 'wrap-break-word font-medium' : 'break-all'} text-ui-text ${mono ? 'font-mono text-xs' : ''}`}>
                {value}
            </dd>
            {detail && <dd className={`mt-1 ${summary ? 'wrap-break-word' : 'break-all'} text-xs text-ui-muted`}>{detail}</dd>}
        </div>
    )
}
