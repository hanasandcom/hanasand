import type { UvmAssetEngineCoverage, UvmDashboard } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'

const engines: Array<{ id: UvmAssetEngineCoverage['engine'], label: string }> = [
    { id: 'nmap', label: 'Nmap' }, { id: 'naabu', label: 'Naabu' }, { id: 'tenable-vm', label: 'Tenable VM' },
    { id: 'gvm', label: 'Greenbone' }, { id: 'zap', label: 'ZAP' }, { id: 'testssl', label: 'testssl.sh' },
    { id: 'nuclei', label: 'Nuclei' }, { id: 'nikto', label: 'Nikto' }, { id: 'sslyze', label: 'SSLyze' },
    { id: 'wapiti', label: 'Wapiti' }, { id: 'whatweb', label: 'WhatWeb' }, { id: 'httpx', label: 'httpx' },
    { id: 'tlsx', label: 'tlsx' }, { id: 'katana', label: 'Katana' }, { id: 'wafw00f', label: 'WAFW00F' },
]

function isCurrent(coverage: UvmAssetEngineCoverage | undefined) {
    return coverage?.state === 'complete' && coverage.freshness === 'fresh' && coverage.scopeMatchesAuthorizedSnapshot !== false
}

function engineCoverage(coverage: UvmAssetEngineCoverage | undefined) {
    if (!coverage) return 'Unknown'
    if (coverage.engine === 'zap') return coverage.webCoverage?.complete
        ? `${coverage.webCoverage.acceptedInstances} findings · ${coverage.webCoverage.urlsDiscovered ?? 'URL count unavailable'} traditional URLs · ${coverage.webCoverage.clientUrlsDiscovered ?? 'browser URL count unavailable'} browser routes`
        : 'Findings unavailable · URL count unavailable · browser URL count unavailable'
    if (coverage.coverageKnown && coverage.completedAddresses !== null) {
        return `${coverage.completedAddresses}/${coverage.requestedAddresses.length} addresses`
    }
    return 'Address coverage unknown'
}

export function UvmAssetEngineCoverageView({ data }: { data: UvmDashboard }) {
    const rows = data.coverage || []
    const byAssetEngine = new Map(rows.map(row => [`${row.assetId}:${row.engine}`, row]))
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3'>
            <h2 className='text-base font-semibold'>Coverage by asset</h2>
            <span className='text-xs text-ui-muted'>{data.assets.length} assets</span>
        </div>
        {data.scannerError ? <p className='mt-3 text-sm text-ui-warning'>Coverage unavailable: {data.scannerError}</p>
            : !data.assets.length ? <p className='mt-3 text-sm text-ui-muted'>No assets registered.</p>
                : !data.coverage ? <p className='mt-3 text-sm text-ui-warning'>Coverage is unavailable from this Scanner API version.</p>
                    : <div className='mt-3 grid gap-2'>{data.assets.map(asset => {
                        const assetCoverage = engines.map(engine => ({ ...engine, coverage: byAssetEngine.get(`${asset.id}:${engine.id}`) }))
                        const currentCount = assetCoverage.filter(item => isCurrent(item.coverage)).length
                        const unknownCount = assetCoverage.filter(item => !item.coverage || item.coverage.state === 'never_scanned' || item.coverage.state === 'unknown').length
                        const reviewCount = engines.length - currentCount - unknownCount
                        return <details key={asset.id} className='rounded-md border border-ui-border bg-ui-raised'>
                            <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3 [&::-webkit-details-marker]:hidden'>
                                <strong className='text-sm'>{asset.hostname}</strong>
                                <span className='flex flex-wrap gap-2 text-xs text-ui-muted'>
                                    <span>{currentCount} current</span><span>{reviewCount} need review</span><span>{unknownCount} unknown</span>
                                </span>
                            </summary>
                            <div className='grid gap-2 border-t border-ui-border p-3 sm:grid-cols-2'>
                                {assetCoverage.map(({ id, label, coverage }) => <div key={id} className='rounded border border-ui-border bg-ui-panel p-2 text-xs' title={coverage?.freshnessReason || undefined}>
                                    <div className='flex flex-wrap items-center justify-between gap-1'>
                                        <strong>{label}</strong>
                                        <span className={isCurrent(coverage) ? 'text-ui-success' : 'text-ui-muted'}>{coverage ? coverage.state.replaceAll('_', ' ') : 'unknown'}</span>
                                    </div>
                                    <p className='mt-1 text-ui-muted'>{coverage ? `${coverage.freshness} · ${coverage.profile || 'profile unknown'} · ${engineCoverage(coverage)}` : 'No coverage record'}</p>
                                    <p className='mt-1 text-ui-muted'>{coverage?.lastRunAt ? `Last run ${formatDate(coverage.lastRunAt)}` : 'No run recorded'}</p>
                                    {coverage?.scopeMatchesAuthorizedSnapshot === false && <p className='mt-1 text-ui-warning'>Last run used a different authorized IP scope.</p>}
                                    {coverage?.missingAddresses?.length ? <p className='mt-1 break-all text-ui-warning'>Missing: {coverage.missingAddresses.join(', ')}</p> : null}
                                    {coverage?.lastCompleteRun && <p className='mt-1 text-ui-muted'>Last complete: {coverage.lastCompleteRun.completedAddresses ?? 'unknown'}/{coverage.lastCompleteRun.requestedAddresses.length} addresses{coverage.lastCompleteRun.at ? ` · ${formatDate(coverage.lastCompleteRun.at)}` : ''}</p>}
                                </div>)}
                            </div>
                        </details>
                    })}</div>}
    </section>
}
