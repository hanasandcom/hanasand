import type { WorkbenchOrgContext } from '../types'
import { workflowStatusClass, formatDateTime } from './presentation'

export function OrganizationInviteCard({ inviteEmail, inviteRole, busyAction, inviteBlockedReason, orgContext, onInviteEmailChange, onInviteRoleChange, onInvite }: {
    inviteEmail: string
    inviteRole: string
    busyAction: string | null
    inviteBlockedReason?: string
    orgContext?: WorkbenchOrgContext
    onInviteEmailChange: (value: string) => void
    onInviteRoleChange: (value: string) => void
    onInvite: () => void | Promise<void>
}) {
    return (
                <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-ui-muted'>Team invite</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted'>Add analysts to the active customer case.</p>
                        </div>
                        <span className={workflowStatusClass(inviteBlockedReason ? 'blocked' : 'ready')}>{inviteBlockedReason ? 'syncing' : 'ready'}</span>
                    </div>
                    <div className='mt-3 grid gap-2'>
                        <input
                            value={inviteEmail}
                            onChange={event => onInviteEmailChange(event.target.value)}
                            disabled={Boolean(inviteBlockedReason) || Boolean(busyAction)}
                            placeholder='analyst@example.com'
                            className='h-9 rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                        />
                        <div className='flex gap-2'>
                            <select
                                value={inviteRole}
                                onChange={event => onInviteRoleChange(event.target.value)}
                                disabled={Boolean(inviteBlockedReason) || Boolean(busyAction)}
                                className='h-9 min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-canvas px-2 text-xs font-semibold text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                <option value='analyst'>Analyst</option>
                                <option value='admin'>Admin</option>
                                <option value='viewer'>Viewer</option>
                            </select>
                            <button
                                type='button'
                                disabled={Boolean(inviteBlockedReason) || Boolean(busyAction)}
                                title={inviteBlockedReason || undefined}
                                onClick={onInvite}
                                className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {busyAction === 'org:invite' ? 'Inviting...' : 'Invite'}
                            </button>
                        </div>
                    </div>
                    {inviteBlockedReason && <p className='mt-2 text-xs leading-5 text-ui-text'>{inviteBlockedReason}</p>}
                    {orgContext?.pendingInvites.length ? (
                        <div className='mt-3 grid gap-1'>
                            {orgContext.pendingInvites.slice(0, 4).map(invite => (
                                <p key={invite.id} className='truncate text-xs text-ui-muted'>{invite.email} · {invite.role} · expires {formatDateTime(invite.expiresAt)}</p>
                            ))}
                        </div>
                    ) : <p className='mt-3 text-xs text-ui-muted'>Invite state is updating.</p>}
                </div>

    )
}
