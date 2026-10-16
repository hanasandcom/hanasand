import { RefObject, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

type EditorLineNavigationOptions = {
    editingContent: string
    codeRef: RefObject<HTMLPreElement | null>
    inputRef: RefObject<HTMLTextAreaElement | null>
    lineNumberRef: RefObject<HTMLElement | null>
}

export function useEditorLineNavigation({
    editingContent,
    codeRef,
    inputRef,
    lineNumberRef,
}: EditorLineNavigationOptions) {
    const searchParams = useSearchParams()

    useEffect(() => {
        const targetLine = Number(searchParams.get('line'))
        if (!targetLine || !inputRef.current) {
            return
        }

        const textarea = inputRef.current
        const scrollTop = Math.max(targetLine - 6, 0) * 20
        textarea.scrollTop = scrollTop
        if (codeRef.current) codeRef.current.scrollTop = scrollTop
        if (lineNumberRef.current) lineNumberRef.current.scrollTop = scrollTop

        const start = getLineOffset(editingContent, targetLine)
        textarea.setSelectionRange(start, start)
        textarea.focus()
    }, [codeRef, editingContent, inputRef, lineNumberRef, searchParams])
}

function getLineOffset(value: string, line: number) {
    if (line <= 1) return 0

    let offset = 0
    let currentLine = 1
    while (currentLine < line && offset < value.length) {
        const next = value.indexOf('\n', offset)
        if (next < 0) return value.length
        offset = next + 1
        currentLine += 1
    }

    return offset
}
