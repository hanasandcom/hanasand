import { createContext, useContext, type ReactNode } from 'react'
import type { useAccessRecoveryController } from './controller'

type AccessRecoveryContextValue = ReturnType<typeof useAccessRecoveryController>
const AccessRecoveryContext = createContext<AccessRecoveryContextValue | null>(null)

export function AccessRecoveryProvider({ value, children }: { value: AccessRecoveryContextValue, children: ReactNode }) {
    return <AccessRecoveryContext.Provider value={value}>{children}</AccessRecoveryContext.Provider>
}

export function useAccessRecoveryContext() {
    const value = useContext(AccessRecoveryContext)
    if (!value) throw new Error('Access recovery form must be rendered inside its provider.')
    return value
}
