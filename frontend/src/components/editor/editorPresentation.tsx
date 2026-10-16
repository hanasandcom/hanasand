'use client'

import { ChangeEvent, RefObject } from 'react'
import { renderMarkdown } from './markdownRenderer'

type EditorWithoutLogicProps = {
    markdown: string
    handleMarkdownChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
    handleSave: () => void
    displayEditor: boolean
    hideSaveButton?: true
    handleDisplayEditor: () => void
    hideSave: boolean
    textareaRef: RefObject<HTMLTextAreaElement | null>
    edited: boolean
    className?: string
    placeholder?: string
    placeholderClassName?: string
}

type MarkdownProps = {
    displayEditor: boolean
    handleDisplayEditor: () => void
    markdown: string
    className?: string
}

export function EditorWithoutLogic({
    markdown,
    handleMarkdownChange,
    handleSave,
    displayEditor,
    handleDisplayEditor,
    hideSaveButton,
    hideSave,
    textareaRef,
    edited,
    className,
    placeholder,
    placeholderClassName
}: EditorWithoutLogicProps) {
    return (
        <div
            className={`${className}`}
            onClick={() => textareaRef?.current?.focus()}
        >
            <div>
                {displayEditor && <div className='mb-2 grid grid-cols-2 rounded-lg border border-ui-border bg-ui-panel p-2'>
                    <h1 className='text-lg font-semibold text-ui-text'>Markdown</h1>
                    <h1 className='pl-2 text-lg font-semibold text-ui-text'>Preview</h1>
                </div>}
                <div className={`markdown-editor space-x-2 h-full ${displayEditor && 'grid grid-cols-2'}`}>
                    {(displayEditor || !markdown.length) && <textarea
                        className={`z-10 h-full w-full resize-none overflow-hidden rounded-sm bg-transparent pr-2 text-foreground caret-ui-primary outline-hidden focus:outline-hidden ${placeholderClassName}`}
                        value={markdown}
                        onChange={handleMarkdownChange}
                        placeholder={placeholder || 'Write your markdown here...'}
                        ref={textareaRef}
                    />}
                    <Markdown
                        displayEditor={displayEditor}
                        handleDisplayEditor={handleDisplayEditor}
                        markdown={markdown}
                    />
                </div>
            </div>
            {edited && !hideSave && !hideSaveButton && <div className='mt-2'>
                <button
                    className='text-md h-[4vh] rounded-lg bg-ui-primary px-8 font-semibold text-ui-on-primary shadow-sm'
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>}
        </div>
    )
}

export function Markdown({
    displayEditor,
    handleDisplayEditor,
    markdown,
    className
}: MarkdownProps) {
    return (
        <div
            className={`markdown-preview ${displayEditor && 'border-l-2 border-ui-primary pl-2'} h-full break-words text-foreground ${className}`}
            onClick={handleDisplayEditor}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
    )
}
