import config from '@/config'
import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import getFetchableUrl from './getFetchAbleUrl'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

type PublicMediaUploadOptions = {
    setUrl: Dispatch<SetStateAction<string>>
    setFile: Dispatch<SetStateAction<File | null>>
    setPreview: Dispatch<SetStateAction<string | null>>
}

export function usePublicMediaUpload({ setUrl, setFile, setPreview }: PublicMediaUploadOptions) {
    const [isFetching, setIsFetching] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const selectFile = useCallback((file: File) => {
        setMessage(null)
        const validationError = validateUploadFile(file)
        if (validationError) {
            setFile(null)
            setPreview(null)
            setMessage(validationError)
            return false
        }

        setFile(file)
        setPreview(null)
        return true
    }, [setFile, setPreview])

    const handleFile = useCallback((file: File) => {
        if (selectFile(file)) setPreview(URL.createObjectURL(file))
    }, [selectFile, setPreview])

    function handlePasteOrChange(value: string) {
        setUrl(value)
        setMessage(null)

        if (!value.trim()) return
        void fetchRemoteMedia(value)
    }

    async function fetchRemoteMedia(value: string) {
        try {
            const urlObject = new URL(value)
            const fileName = urlObject.pathname.split('/').pop() || 'image.png'
            setIsFetching(true)
            handleFile(await fetchImageAsFile(value, fileName))
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Paste a direct image or video URL, or choose a file.')
        } finally {
            setIsFetching(false)
        }
    }

    return {
        isFetching,
        message,
        selectFile,
        handleFile,
        handlePasteOrChange,
    }
}

async function fetchImageAsFile(url: string, fileName: string) {
    const fetchableUrl = getFetchableUrl(url)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    let response: Response
    try {
        response = await fetch(`/api/image?url=${encodeURIComponent(fetchableUrl)}`, {
            signal: controller.signal,
        })
    } finally {
        clearTimeout(timeout)
    }

    if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error || 'Remote media could not be fetched.')
    }

    const blob = await response.blob()
    const type = blob.type
    const file = new File([blob], fileName, { type })
    const validationError = validateRemoteMediaFile(file)
    if (validationError) throw new Error(validationError)
    return file
}

function validateUploadFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
        return 'Files must be 20 MB or smaller.'
    }

    return null
}

function validateRemoteMediaFile(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        return 'Paste a direct image or video URL, or choose a file.'
    }
    return validateUploadFile(file)
}
