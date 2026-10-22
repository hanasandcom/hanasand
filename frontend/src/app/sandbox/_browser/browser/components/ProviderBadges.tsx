import Image from 'next/image'
import type { ProviderRunResult } from '../types/history'

export function ProviderBadges({ results }: { results?: Record<string, ProviderRunResult> }) {
    return (
        <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
            <ProviderBadge provider='virustotal' result={results?.virustotal} />
            <ProviderBadge provider='urlquery' result={results?.urlquery} />
        </span>
    )
}

export function ProviderBadge({ provider, result }: {
    provider: 'virustotal' | 'urlquery'
    result?: ProviderRunResult
}) {
    const name = provider === 'virustotal' ? 'VirusTotal' : 'urlquery'
    const rawText = (result?.label || '').replace(/\b(?:virustotal|VT|urlquery)\b:?/gi, '').replace(/\s*alerts?$/i, '').trim()
    const text = !rawText || rawText === '—' ? '0' : rawText
    const clean = !result || result.status === 'clean' || text === '0'
    const description = `${name}: ${text}${provider === 'urlquery' && /^\d+$/.test(text) ? ' alerts' : ''}`

    return (
        <span role='img' title={description} aria-label={description} className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold ${clean ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning'}`}>
            <Image src={`/logos/${provider}.${provider === 'virustotal' ? 'svg' : 'png'}`} alt='' width={16} height={16} unoptimized className='h-4 w-4 shrink-0 object-contain' />
            <span aria-hidden='true'>{text}</span>
        </span>
    )
}
