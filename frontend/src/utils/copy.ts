import { Dispatch, SetStateAction } from 'react'
import { copyTextToClipboard } from './copyTextToClipboard'

type CopyProps = {
    text: string
    setDidCopy: Dispatch<SetStateAction<boolean | string | null>>
    type?: 'link' | 'alias'
}

export default function copy({ type, text, setDidCopy }: CopyProps) {
    const errorState = `error${type ? `-${type}` : ''}`
    void copyTextToClipboard(text)
        .then(copied => setDidCopy(copied ? type || true : errorState))
        .catch(error => {
            console.log(error)
            setDidCopy(errorState)
        })
}
