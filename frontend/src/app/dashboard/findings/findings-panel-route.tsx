import DashboardDwmPage from './page'

type FindingsPanel = 'actors' | 'delivery' | 'watchlists'
type FindingsPanelProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export function createFindingsPanelPage(panel: FindingsPanel) {
    return function FindingsPanelPage({ searchParams }: FindingsPanelProps) {
        const panelSearchParams = Promise.resolve(searchParams).then(params => ({ ...params, panel }))
        return DashboardDwmPage({ searchParams: panelSearchParams })
    }
}
