const accountDateTimeFormat = { dateStyle: 'medium', timeStyle: 'short' } as const

export function formatAccountDateTime(value: string) {
    return new Intl.DateTimeFormat('en', accountDateTimeFormat).format(new Date(value))
}
