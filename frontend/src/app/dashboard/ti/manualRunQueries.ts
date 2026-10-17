type SourceWithDomains = { domains: string[] }

export function manualRunQueries(sources: readonly SourceWithDomains[]) {
    return [...new Set(
        sources.flatMap(source => source.domains).filter(domain => !domain.includes('only'))
    )]
}
