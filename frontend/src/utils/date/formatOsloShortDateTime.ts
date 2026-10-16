const osloDateTimeFormatter = new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo',
})

export function formatOsloShortDateTime(value: string) {
    return osloDateTimeFormatter.format(new Date(value))
}
