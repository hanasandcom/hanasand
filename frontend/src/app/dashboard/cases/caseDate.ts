export function date(value?: string, empty = '—') {
    return value ? new Date(value).toLocaleString() : empty
}
