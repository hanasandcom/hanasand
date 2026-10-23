'use client'

import { ChangeEvent, Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import '@styles/github.css'
import './editor.css'
import { postArticle } from '@/utils/articles/postArticle'
import { EditorWithoutLogic } from './editorPresentation'
import { resizeTextareaToContent } from './resizeTextareaToContent'
export { EditorWithoutLogic, Markdown } from './editorPresentation'

type EditorProps = {
    id: string
    content: string[]
    customSaveLogic?: true
    hideSaveButton?: true
    save?: () => void | Promise<unknown>
    onChange?: (value: string) => void
    className?: string
    placeholder?: string
    placeholderClassName?: string
    editing: boolean
    setEditing?: Dispatch<SetStateAction<boolean>>
}

export default function Editor({
    id,
    content,
    customSaveLogic,
    hideSaveButton,
    save,
    onChange,
    className,
    placeholder,
    placeholderClassName,
    editing,
    setEditing
}: EditorProps) {
    const initialMarkdown = useMemo(() => content.join('\n'), [content])
    const [draftMarkdown, setDraftMarkdown] = useState(initialMarkdown)
    const [displayEditor, setDisplayEditor] = useState(false)
    const [hideSave, setHideSave] = useState(false)
    const editBaseline = useRef(initialMarkdown)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const markdown = customSaveLogic
        ? initialMarkdown
        : (displayEditor || draftMarkdown !== initialMarkdown ? draftMarkdown : initialMarkdown)
    const edited = customSaveLogic
        ? editBaseline.current !== initialMarkdown
        : initialMarkdown !== markdown

    function handleMarkdownChange(event: ChangeEvent<HTMLTextAreaElement>) {
        if (customSaveLogic && onChange) {
            if (!displayEditor) {
                setDisplayEditor(true)
            }

            onChange(event.target.value)
        } else {
            setDraftMarkdown(event.target.value)
        }

        setDisplayEditor(true)
        resizeTextareaToContent(event.target)
    }

    async function handleSave() {
        if (customSaveLogic && save) {
            try {
                await save()
            } catch {
                return
            }
        } else {
            postArticle(id, markdown)
        }

        setDisplayEditor(false)
        setHideSave(true)
    }

    function handleDisplayEditor(next?: boolean | ((prev: boolean) => boolean)) {
        setDisplayEditor((prev) => {
            const shouldDisplay = typeof next === 'function' ? next(prev) : next ?? !prev
            if (!prev && shouldDisplay) editBaseline.current = initialMarkdown

            return shouldDisplay
        })
        setHideSave(false)
        if (textareaRef.current) {
            resizeTextareaToContent(textareaRef.current)
        }
    }

    useEffect(() => {
        if (textareaRef.current) {
            resizeTextareaToContent(textareaRef.current)
        }
    }, [markdown, displayEditor])

    useEffect(() => {
        if (typeof setEditing !== 'undefined') {
            setEditing(displayEditor)
        }
    }, [displayEditor, setEditing])

    return <EditorWithoutLogic
        className={className}
        placeholder={placeholder}
        markdown={markdown}
        handleMarkdownChange={handleMarkdownChange}
        handleSave={handleSave}
        displayEditor={editing ? displayEditor : false}
        handleDisplayEditor={() => handleDisplayEditor((prev) => !prev)}
        hideSaveButton={hideSaveButton}
        hideSave={hideSave}
        textareaRef={textareaRef}
        edited={edited}
        placeholderClassName={placeholderClassName}
    />
}
