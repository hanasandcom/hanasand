import type { FormEvent } from 'react'
import VerificationCodeInput from '@/components/login/verificationCodeInput'
import { authGhostButtonClass } from './loginMode'

type Props = {
    code: string
    setCode(value: string): void
    busy: boolean
    onSubmit(event: FormEvent<HTMLFormElement>): void
    onVerify(code: string): void | Promise<void>
    onRequestAnother(): void
}

export default function ResetVerificationForm({ code, setCode, busy, onSubmit, onVerify, onRequestAnother }: Props) {
    return (
        <form className='flex w-full flex-col gap-4 self-center' onSubmit={onSubmit} method='post'>
            <VerificationCodeInput label='Reset code' value={code} setValue={setCode} disabled={busy} onComplete={onVerify} />
            <div className='mt-1 flex items-center gap-3'>
                <button type='button' onClick={onRequestAnother} className={authGhostButtonClass}>Send again</button>
                <p className='ml-auto text-xs font-medium text-ui-muted'>{busy ? 'Verifying...' : 'Verifies automatically'}</p>
            </div>
        </form>
    )
}
