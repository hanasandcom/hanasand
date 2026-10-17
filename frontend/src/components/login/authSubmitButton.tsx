import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

type Props = {
    busy: boolean
    disabled: boolean
    pendingLabel: string
    className: string
    children: ReactNode
}

export default function AuthSubmitButton({ busy, disabled, pendingLabel, className, children }: Props) {
    return (
        <button type='submit' disabled={disabled} className={className}>
            {busy ? pendingLabel : children}
            <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
        </button>
    )
}
