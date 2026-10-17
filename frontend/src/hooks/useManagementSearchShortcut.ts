import { useEffect, useRef } from 'react'
import { isManagementSearchShortcut } from '@/utils/isManagementSearchShortcut'

export function useManagementSearchShortcut(onShortcut: () => void) {
    const callback = useRef(onShortcut)
    callback.current = onShortcut

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => dispatchManagementSearchShortcut(event, () => callback.current())
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])
}

export function dispatchManagementSearchShortcut(event: KeyboardEvent, onShortcut: () => void) {
    if (!isManagementSearchShortcut(event)) return false
    event.preventDefault()
    onShortcut()
    return true
}
