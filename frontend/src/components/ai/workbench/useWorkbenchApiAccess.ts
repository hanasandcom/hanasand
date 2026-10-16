import { useCallback, useEffect } from 'react'
import type { WorkbenchState } from './useWorkbenchState'

export function useWorkbenchApiAccess(state: WorkbenchState) {
    const { isAuthenticated, setAiApiAvailable } = state
    useEffect(() => setAiApiAvailable(isAuthenticated), [isAuthenticated, setAiApiAvailable])
    return useCallback((response: Response) => {
        if (response.status === 401 || response.status === 403) {
            setAiApiAvailable(false)
            return true
        }
        return false
    }, [setAiApiAvailable])
}
