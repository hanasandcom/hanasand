import { Dispatch, RefObject, SetStateAction, useEffect, useRef, useState } from 'react'
import { handleEditorKeyDown } from './editorKeybindings'
import { EditorEmptyState } from './editorEmptyState'
import { useEditorLineNavigation } from './editorLineNavigation'

type EditorProps = {
    codeRef: RefObject<HTMLPreElement | null>
    editingContent: string
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    onCursorChange: (selectionStart: number, selectionEnd: number, content: string) => void
    onEditingChange: (editing: boolean) => void
    setClickedWord: (word: string) => void
    displayLineNumbers: boolean
    syntaxHighlighting: boolean
    setError: Dispatch<SetStateAction<string | boolean | null>>
    onInsertTemplate?: (value: string) => void
}

export default function Editor({
    codeRef,
    editingContent,
    handleChange,
    onCursorChange,
    onEditingChange,
    setClickedWord,
    displayLineNumbers,
    syntaxHighlighting,
    setError,
    onInsertTemplate,
}: EditorProps) {
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const lineNumberRef = useRef<HTMLElement | null>(null)
    const editingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [lineNumberWidth, setLineNumberWidth] = useState(0)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const lines = editingContent.split(/\r?\n/)
    useEditorLineNavigation({ editingContent, codeRef, inputRef, lineNumberRef })

    function handleWordClick(e: React.MouseEvent<HTMLTextAreaElement>) {
        const textarea = e.currentTarget
        const cursorPos = textarea.selectionStart
        setClickedWord(getTokenAtPosition(textarea.value, cursorPos))
    }

    function handleSelection(e: React.SyntheticEvent<HTMLTextAreaElement>) {
        const textarea = e.currentTarget
        const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim()
        onCursorChange(textarea.selectionStart, textarea.selectionEnd, textarea.value)
        if (selected) {
            setClickedWord(selected)
        }
    }

    function handleEditorChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        handleChange(e)
        onEditingChange(true)
        onCursorChange(e.currentTarget.selectionStart, e.currentTarget.selectionEnd, e.currentTarget.value)
        if (editingTimeoutRef.current) {
            clearTimeout(editingTimeoutRef.current)
        }
        editingTimeoutRef.current = setTimeout(() => onEditingChange(false), 1400)
    }

    function getTokenAtPosition(value: string, cursorPos: number) {
        const left = value.slice(0, cursorPos)
        const right = value.slice(cursorPos)
        const leftWord = left.match(/[A-Za-z_$][\w$-]*$/)?.[0] ?? ''
        const rightWord = right.match(/^[A-Za-z_$][\w$-]*/)?.[0] ?? ''
        return leftWord + rightWord
    }

    function handleScrollDiv(e: React.UIEvent<HTMLDivElement>) {
        if (codeRef.current) {
            const codePre = codeRef.current
            if (codePre) {
                codePre.scrollTop = e.currentTarget.scrollTop
                codePre.scrollLeft = e.currentTarget.scrollLeft
            }
            handleScroll(e)
        }
    }

    function handleScroll(e: React.UIEvent<HTMLDivElement | HTMLPreElement | HTMLTextAreaElement>) {
        const current = e.currentTarget

        document.querySelectorAll<HTMLElement>('.sync-scroll').forEach(el => {
            if (el !== current) {
                el.scrollTop = current.scrollTop
            }
        })
    }

    useEffect(() => {
        if (lineNumberRef.current) {
            setLineNumberWidth(lineNumberRef.current.offsetWidth)
        }
    }, [editingContent, syntaxHighlighting])

    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            e.preventDefault()
            setError('cmdw')
        }

        const hasUnsavedChanges = editingContent.trim().length > 0
        if (hasUnsavedChanges) {
            window.addEventListener('beforeunload', handleBeforeUnload)
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [editingContent])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        return () => {
            if (editingTimeoutRef.current) {
                clearTimeout(editingTimeoutRef.current)
            }
        }
    }, [])

    return (
        <main aria-label='Code editor' className='relative min-h-0 flex-1 w-full overflow-hidden rounded-lg border border-ui-border bg-ui-canvas'>
            {editingContent.trim().length <= 0 && (
                <EditorEmptyState
                    displayLineNumbers={displayLineNumbers}
                    onInsertTemplate={onInsertTemplate}
                />
            )}
            <div className={'hljs relative w-full h-full flex'}>
                {displayLineNumbers && (
                    <div
                        // @ts-expect-error Not fully compatible because ref is
                        // element specific, but its close enough (<div> vs <pre>)
                        ref={lineNumberRef}
                        className={`sync-scroll min-w-fit select-none overflow-auto pl-2 pr-3 pt-2 text-right font-mono text-sm leading-5 text-ui-muted noscroll ${lines.length > 100 ? 'pb-[100vh]' : ''}`}
                        onScroll={handleScrollDiv}
                    >
                        {lines.map((_, i) => (
                            <div key={i} className='h-5 leading-5'>
                                {i + 1}
                            </div>
                        ))}
                    </div>
                )}

                <pre className={`sync-scroll m-0 overflow-auto pt-2 font-mono text-sm leading-5 ${lines.length > 100 ? 'pb-[100vh]' : ''}`}>
                    <code ref={codeRef}>{editingContent}</code>
                </pre>
            </div>
            <textarea
                ref={inputRef}
                aria-label='Workspace editor'
                value={editingContent}
                onChange={handleEditorChange}
                onClick={handleWordClick}
                onSelect={handleSelection}
                onKeyUp={(e) => onCursorChange(e.currentTarget.selectionStart, e.currentTarget.selectionEnd, e.currentTarget.value)}
                onScroll={(e) => {
                    const lineNumbers = lineNumberRef.current
                    if (lineNumbers) {
                        lineNumbers.scrollTop = e.currentTarget.scrollTop
                        handleScroll(e)
                    }
                }}
                className={`sync-scroll absolute left-0 top-0 z-10 min-h-full min-w-full resize-none overflow-auto rounded-lg bg-transparent pt-2 font-mono text-sm leading-5 text-transparent caret-ui-primary outline-none ${lines.length > 100 ? 'pb-[100vh]' : ''}`}
                autoCapitalize='off'
                autoComplete='off'
                autoCorrect='off'
                spellCheck={false}
                style={{
                    paddingLeft: displayLineNumbers ? `${lineNumberWidth}px` : '0px',
                    whiteSpace: 'pre',
                    overflowWrap: 'normal',
                }}
                onKeyDown={(event) => handleEditorKeyDown({
                    event,
                    editingContent,
                    handleChange,
                    history,
                    historyIndex,
                    setHistory,
                    setHistoryIndex
                })}
            />
        </main>
    )
}
