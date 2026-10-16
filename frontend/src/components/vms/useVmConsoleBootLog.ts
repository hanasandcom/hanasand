import { useCallback, useEffect, useRef, useState } from 'react'

export function useVmConsoleBootLog() {
    const panel = useRef<HTMLPreElement>(null)
    const follow = useRef(true)
    const [output, setOutput] = useState('')
    const [error, setError] = useState('')
    const [expanded, setExpanded] = useState(false)
    const reset = useCallback(() => {
        setOutput('')
        setError('')
        setExpanded(false)
    }, [])

    useEffect(() => {
        if (follow.current && panel.current) panel.current.scrollTop = panel.current.scrollHeight
    }, [output, expanded])

    return { panel, follow, output, setOutput, error, setError, expanded, setExpanded, reset }
}
