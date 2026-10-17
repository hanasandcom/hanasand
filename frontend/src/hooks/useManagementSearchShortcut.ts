import { useEffect, useRef } from 'react'
import { isManagementSearchShortcut } from '@/utils/isManagementSearchShortcut'

export function useManagementSearchShortcut(onShortcut: () => void, canHandle: () => boolean = () => true) {
    const callback = useRef(onShortcut)
    const enabled = useRef(canHandle)
    callback.current = onShortcut
    enabled.current = canHandle

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => dispatchManagementSearchShortcut(event, () => callback.current(), () => enabled.current())
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])
}

export function dispatchManagementSearchShortcut(event: KeyboardEvent, onShortcut: () => void, canHandle: () => boolean = () => true) {
    if (!isManagementSearchShortcut(event) || !canHandle()) return false
    event.preventDefault()
    onShortcut()
    return true
}
