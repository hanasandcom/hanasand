'use client'

import { ChangeEvent, Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import '@styles/github.css'
import './editor.css'
import { postArticle } from '@/utils/articles/postArticle'
import { EditorWithoutLogic } from './editorPresentation'
export { EditorWithoutLogic, Markdown } from './editorPresentation'

type EditorProps = {
    id: string
    content: string[]
    customSaveLogic?: true
    hideSaveButton?: true
    save?: () => void
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
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const markdown = customSaveLogic
        ? initialMarkdown
        : (displayEditor || draftMarkdown !== initialMarkdown ? draftMarkdown : initialMarkdown)
    const edited = initialMarkdown !== markdown

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
        autoResize(event.target)
    }

    function handleSave() {
        if (customSaveLogic && save) {
            save()
        } else {
            postArticle(id, markdown)
        }

        setDisplayEditor(false)
        setHideSave(true)
    }

    function autoResize(textarea: HTMLTextAreaElement) {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
    }

    function handleDisplayEditor(next?: boolean | ((prev: boolean) => boolean)) {
        setDisplayEditor((prev) => {
            if (typeof next === 'function') {
                return next(prev)
            }

            return next ?? !prev
        })
        setHideSave(false)
        if (textareaRef.current) {
            autoResize(textareaRef.current)
        }
    }

    useEffect(() => {
        if (textareaRef.current) {
            autoResize(textareaRef.current)
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
