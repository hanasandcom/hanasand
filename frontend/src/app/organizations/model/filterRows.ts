export function filterRowsByQueryAndStatus<T>(
    rows: T[],
    statusFilter: string,
    query: string,
    getStatus: (row: T) => string,
    getSearchText: (row: T) => string,
) {
    return rows.filter(row => (statusFilter === 'all' || getStatus(row).toLowerCase() === statusFilter)
        && (!query || getSearchText(row).includes(query)))
}
