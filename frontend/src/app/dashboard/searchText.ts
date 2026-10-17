export function matchesSearchQuery(value: string | null | undefined, query: string): boolean {
    return value?.toLowerCase().includes(query.toLowerCase()) ?? false
}
