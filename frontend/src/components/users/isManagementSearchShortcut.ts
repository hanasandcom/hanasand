export function isManagementSearchShortcut(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'key' | 'repeat' | 'altKey' | 'shiftKey'>) {
    return (event.metaKey || event.ctrlKey)
        && event.key.toLowerCase() === 'j'
        && !event.repeat
        && !event.altKey
        && !event.shiftKey
}
