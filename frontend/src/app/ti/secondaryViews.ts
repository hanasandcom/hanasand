export type SecondaryAnalysisView = 'profile' | 'artifacts' | 'sources' | 'watchlist' | 'actions'
export const secondaryAnalysisViews: { id: SecondaryAnalysisView; label: string; detail: string }[] = [
    { id: 'profile', label: 'Profile', detail: 'Actor timeline and dossier' },
    { id: 'artifacts', label: 'Artifacts', detail: 'IOCs and operations' },
    { id: 'sources', label: 'Sources', detail: 'Coverage and gaps' },
    { id: 'watchlist', label: 'Watchlist', detail: 'Customer term fit' },
    { id: 'actions', label: 'Actions', detail: 'Case and delivery staging' },
]
