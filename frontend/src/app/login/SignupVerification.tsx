import VerificationCodeInput from '@/components/login/verificationCodeInput'
import { authGhostButtonClass } from './loginMode'
import type { useSignupFlow } from './useSignupFlow'

type Props = {
    flow: ReturnType<typeof useSignupFlow>
    busy: boolean
}

export default function SignupVerification({ flow, busy }: Props) {
    return (
        <div className='grid gap-4'>
            <h2 className='text-xl font-semibold'>Check your email</h2>
            {flow.notice && <p role='status' className='text-sm text-ui-muted'>{flow.notice}</p>}
            {flow.sendError && <p role='alert' className='text-sm text-ui-text'>{flow.sendError}</p>}
            <p className='text-sm text-ui-muted'>Enter the six digit code sent to {flow.email}. Expires in 10 minutes.</p>
            <VerificationCodeInput
                value={flow.code}
                setValue={flow.setCode}
                disabled={busy}
                onComplete={flow.submitSignup}
            />
            <div className='flex flex-wrap gap-2'>
                <button type='button' disabled={busy} className={authGhostButtonClass} onClick={() => void flow.submitSignup('', true)}>
                    Resend code
                </button>
                <button type='button' disabled={busy} className={authGhostButtonClass} onClick={flow.editDetails}>
                    Edit signup details
                </button>
            </div>
        </div>
    )
}
