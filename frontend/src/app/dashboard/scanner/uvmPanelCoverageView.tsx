import type { UvmAssetEngineCoverage, UvmDashboard } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'

export function UvmAssetEngineCoverageView({ data }: { data: UvmDashboard }) {
    const engines: UvmAssetEngineCoverage['engine'][] = ['nmap', 'tenable-vm', 'gvm', 'zap', 'testssl', 'nuclei']
    const rows = data.coverage || []
    const byAssetEngine = new Map(rows.map(row => [`${row.assetId}:${row.engine}`, row]))
    const cell = (assetId: string, engine: UvmAssetEngineCoverage['engine']) => {
        const coverage = byAssetEngine.get(`${assetId}:${engine}`)
        if (!coverage) return <span className='text-ui-muted'>Unknown</span>
        const label = coverage.state.replaceAll('_', ' ')
        if (engine === 'zap') return <div className='grid gap-1 text-xs'><span className='font-semibold capitalize'>{label}</span>
            <span className='text-ui-muted'>{coverage.freshness} · {coverage.webCoverage?.complete ? 'report complete' : 'web coverage unknown'}</span>
            <span className='text-ui-muted'>{coverage.webCoverage ? `${coverage.webCoverage.acceptedInstances} findings` : 'Findings unavailable'} · {coverage.webCoverage?.urlsDiscovered ?? 'URL count unavailable'} traditional · {coverage.webCoverage?.clientUrlsDiscovered ?? 'browser URL count unavailable'} browser routes</span>
            <span className='text-ui-muted'>{coverage.lastRunAt ? formatDate(coverage.lastRunAt) : coverage.freshness === 'never' ? 'No run yet' : 'Time unknown'}</span>
        </div>
        const count = coverage.coverageKnown && coverage.completedAddresses !== null
            ? `${coverage.completedAddresses}/${coverage.requestedAddresses.length} addresses`
            : 'coverage unknown'
        const lastComplete = coverage.lastCompleteRun
        const completeCount = lastComplete?.completedAddresses !== null && lastComplete?.completedAddresses !== undefined
            ? `${lastComplete.completedAddresses}/${lastComplete.requestedAddresses.length} addresses`
            : 'none recorded'
        return <div className='grid gap-1 text-xs' title={coverage.scopeMatchesAuthorizedSnapshot === false ? 'The last run used a different authorized address snapshot.' : undefined}>
            <span className='font-semibold capitalize'>{label}</span>
            <span className='text-ui-muted'>{coverage.freshness} · {count}</span>
            <span className='text-ui-muted'>{coverage.lastRunAt ? formatDate(coverage.lastRunAt) : coverage.freshness === 'never' ? 'No run yet' : 'Time unknown'}</span>
            {coverage.lastCompleteRun !== undefined && <span className='text-ui-muted' title={lastComplete?.scopeMatchesAuthorizedSnapshot === false ? 'This complete run used a different authorized address snapshot.' : undefined}>
                Last complete: {completeCount}{lastComplete?.at ? ` · ${formatDate(lastComplete.at)}` : ''}
            </span>}
        </div>
    }
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <h2 className='text-base font-semibold'>Coverage by asset</h2>
        {data.scannerError ? <p className='mt-3 text-sm text-ui-warning'>Coverage unavailable: {data.scannerError}</p>
            : !data.assets.length ? <p className='mt-3 text-sm text-ui-muted'>No assets registered.</p>
                : !data.coverage ? <p className='mt-3 text-sm text-ui-warning'>Coverage is unavailable from this Scanner API version.</p>
                    : <div className='mt-3 overflow-x-auto'><table className='w-full min-w-[900px] border-collapse text-left'>
                        <thead><tr className='border-b border-ui-border text-xs text-ui-muted'><th className='py-2 pr-3 font-medium'>Asset</th><th className='px-3 py-2 font-medium'>Nmap</th><th className='px-3 py-2 font-medium'>Tenable VM</th><th className='px-3 py-2 font-medium'>Greenbone</th><th className='px-3 py-2 font-medium'>ZAP</th><th className='px-3 py-2 font-medium'>testssl.sh</th><th className='px-3 py-2 font-medium'>Nuclei</th></tr></thead>
                        <tbody>{data.assets.map(asset => <tr key={asset.id} className='border-b border-ui-border last:border-0'><th scope='row' className='py-3 pr-3 text-sm font-medium'>{asset.hostname}</th>{engines.map(engine => <td key={engine} className='px-3 py-3 align-top'>{cell(asset.id, engine)}</td>)}</tr>)}</tbody>
                    </table></div>}
    </section>
}
