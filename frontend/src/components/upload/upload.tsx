import ErrorNotice from '@/components/error/errorNotice'
import { GalleryHorizontalEnd, LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { createElement, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, Dispatch, SetStateAction } from 'react'
import config from '@/config'
import { usePublicMediaUpload } from './usePublicMediaUpload'

type UploadProps = {
    url: string
    setUrl: Dispatch<SetStateAction<string>>
    setFile: Dispatch<SetStateAction<File | null>>
    preview: string | null
    setPreview: Dispatch<SetStateAction<string | null>>
}

type UploadPickerElement = HTMLElement & {
    clear: () => void
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(src: string) {
    let load = scriptLoads.get(src)
    if (!load) {
        load = new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = src
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('The shared upload controls could not be loaded.'))
            document.head.append(script)
        })
        scriptLoads.set(src, load)
    }
    return load
}

export default function Upload({ url, setUrl, setFile, preview, setPreview }: UploadProps) {
    const pickerRef = useRef<UploadPickerElement | null>(null)
    const [pickerError, setPickerError] = useState<string | null>(null)
    const { isFetching, message, selectFile, handleFile, handlePasteOrChange } =
        usePublicMediaUpload({ setUrl, setFile, setPreview })

    useEffect(() => {
        const picker = pickerRef.current
        if (!picker) return
        let active = true
        const onFilesChange = (event: Event) => {
            const files = (event as CustomEvent<{ files: File[] }>).detail.files
            const file = files[0]
            if (!file) {
                setFile(null)
                setPreview(null)
            } else if (!selectFile(file)) {
                picker.clear()
            }
        }
        const onReview = (event: Event) => {
            const file = (event as CustomEvent<{ file: File }>).detail.file
            if (file) handleFile(file)
        }

        void (async () => {
            try {
                const origin = new URL(config.url.cdn).origin
                await loadScript(`${origin}/assets/exifreader.js`)
                await loadScript(`${origin}/assets/upload-picker.js`)
                if (!active) return
                picker.addEventListener('fileschange', onFilesChange)
                picker.addEventListener('review', onReview)
            } catch (error) {
                if (active) setPickerError(error instanceof Error ? error.message : 'The shared upload controls could not be loaded.')
            }
        })()

        return () => {
            active = false
            picker.removeEventListener('fileschange', onFilesChange)
            picker.removeEventListener('review', onReview)
        }
    }, [handleFile, selectFile, setFile, setPreview])

    if (preview) return <></>

    return (
        <div className='grid gap-3'>
            {createElement('hanasand-upload-picker', {
                ref: pickerRef,
                description: 'Choose a file or paste a URL.',
                camera: '',
                'review-button': '',
            },
            createElement('label', { slot: 'extras', className: 'grid gap-2' },
                createElement('span', { className: 'flex items-center gap-2 text-xs font-semibold uppercase text-ui-primary' },
                    createElement(LinkIcon, { className: 'h-3.5 w-3.5' }), 'URL'),
                createElement('input', {
                    placeholder: 'https://example.com/image.png',
                    value: url,
                    onChange: (event: ChangeEvent<HTMLInputElement>) => handlePasteOrChange(event.target.value),
                    onPaste: (event: ClipboardEvent<HTMLInputElement>) => handlePasteOrChange(event.clipboardData.getData('text')),
                    className: 'h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15',
                })),
            createElement(Link, {
                href: '/gallery',
                slot: 'actions',
                className: 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary',
            }, createElement(GalleryHorizontalEnd, { className: 'h-4 w-4' }), 'My uploads'))}
            {isFetching ? <ErrorNotice compact variant='info' message='Fetching media preview...' /> : null}
            {message ? <ErrorNotice compact variant='info' message={message} /> : null}
            {pickerError ? <ErrorNotice compact message={pickerError} /> : null}
        </div>
    )
}
