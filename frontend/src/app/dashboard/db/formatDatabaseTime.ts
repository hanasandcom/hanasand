export function formatDatabaseTime(value: string) {
    return new Date(value).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) + ' UTC'
}
