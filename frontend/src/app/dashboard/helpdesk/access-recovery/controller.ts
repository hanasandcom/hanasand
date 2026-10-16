import { useState } from 'react'
import { useImpersonationActions } from './impersonationActions'
import { useInspectionActions } from './inspectionActions'
import { useOrganizationActions } from './organizationActions'
import { useRecoveryActions } from './recoveryActions'
import type { SupportOperation } from './types'

export function useAccessRecoveryController(initialOperation: SupportOperation) {
    const [operation, setOperation] = useState<SupportOperation>(initialOperation)
    const [submitting, setSubmitting] = useState('')
    const inspection = useInspectionActions(setSubmitting)
    const recovery = useRecoveryActions(setSubmitting)
    const organization = useOrganizationActions(setSubmitting)
    const impersonation = useImpersonationActions(setSubmitting)

    return {
        operation, setOperation, submitting,
        ...inspection, ...recovery, ...organization, ...impersonation,
    }
}
