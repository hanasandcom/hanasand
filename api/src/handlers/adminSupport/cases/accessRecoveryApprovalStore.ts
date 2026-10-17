import run from '#db'
import { supportAccessRecoveryApprovalSelect } from '../accessRecovery/approvalQuery.ts'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'

export async function loadAccessRecoveryApproval(requestId: string, query: typeof run = run, lock = false) {
    const result = await query(`${supportAccessRecoveryApprovalSelect()}
        WHERE approval.request_id = $1
        LIMIT 1${lock ? '\n        FOR UPDATE OF approval' : ''}
    `, [requestId])
    return result.rows[0] as AccessRecoveryApprovalRow | undefined
}
