'use client'

import { AccessRecoveryProvider } from './access-recovery/context'
import { useAccessRecoveryController } from './access-recovery/controller'
import { ApiUsagePanel } from './access-recovery/apiUsagePanel'
import { DecisionPanel } from './access-recovery/decisionPanel'
import { ImpersonationPanel } from './access-recovery/impersonationPanel'
import { InspectionPanel } from './access-recovery/inspectPanel'
import { InvitePanel } from './access-recovery/invitePanel'
import { MemberPanel } from './access-recovery/memberPanel'
import { QueuePanel } from './access-recovery/queuePanel'
import { RecoveryPanel } from './access-recovery/recoveryPanel'
import { OperationTab, operationTabs, primaryButton, secondaryButton } from './access-recovery/shared'
import type { SupportOperation } from './access-recovery/types'

export default function AccessRecoveryForm({ initialOperation = 'inspect' }: { initialOperation?: SupportOperation }) {
    const form = useAccessRecoveryController(initialOperation)
    const { operation, setOperation } = form

    return (
        <AccessRecoveryProvider value={form}>
            <div className='grid gap-4'>
                <div data-testid='support-primary-operation' className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3'>
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                        <div><h3 className='text-sm font-semibold text-ui-text'>Customer lookup</h3></div>
                        <button type='button' aria-pressed={operation === 'inspect'} className={operation === 'inspect' ? primaryButton : secondaryButton} onClick={() => setOperation('inspect')}>
                            Inspect access
                        </button>
                    </div>
                </div>

                <details data-testid='support-secondary-operations' className='group rounded-md border border-ui-border bg-ui-canvas' open={operation !== 'inspect'}>
                    <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                        <span>Actions</span>
                        <span className='text-xs font-medium text-ui-muted group-open:hidden'>Sessions, invites, roles, API usage</span>
                        <span className='hidden text-xs font-medium text-ui-muted group-open:inline'>Hide actions</span>
                    </summary>
                    <div className='grid gap-2 border-t border-ui-border p-3 sm:grid-cols-2' role='group' aria-label='Support operation'>
                        {operationTabs.filter(tab => tab.id !== 'inspect').map(tab => (
                            <OperationTab key={tab.id} active={operation === tab.id} label={tab.label} detail={tab.detail} onClick={() => setOperation(tab.id)} />
                        ))}
                    </div>
                </details>

                {operation === 'inspect' && <InspectionPanel />}
                {operation === 'invite' && <InvitePanel />}
                {operation === 'member' && <MemberPanel />}
                {operation === 'apiUsage' && <ApiUsagePanel />}
                {operation === 'impersonation' && <ImpersonationPanel />}
                {operation === 'recovery' && <RecoveryPanel />}
                {operation === 'decision' && <DecisionPanel />}
                {operation === 'queue' && <QueuePanel />}
            </div>
        </AccessRecoveryProvider>
    )
}
