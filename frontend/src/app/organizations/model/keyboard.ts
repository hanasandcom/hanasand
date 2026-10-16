import type { KeyboardEvent } from 'react'

export function stopRowSelectionKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation()
    }
}
