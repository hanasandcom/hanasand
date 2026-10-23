import { Panel, Stat } from './workbenchPaneDisplay'
import { useState } from 'react'
import Link from 'next/link'
import { UsersRound } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'

export function WorkspaceCollaborationPanel({ activeConversation, currentUserId, collaboratorPending, collaborationError, onInviteCollaborator, onRemoveCollaborator }: { activeConversation: AIConversation | null, currentUserId: string | null, collaboratorPending: boolean, collaborationError: string | null, onInviteCollaborator: (input: { userId: string, role: 'reviewer' | 'editor' }) => void | Promise<void>, onRemoveCollaborator: (userId: string) => void | Promise<void> }) {
    const [collaboratorUserId, setCollaboratorUserId] = useState('')
    const [collaboratorRole, setCollaboratorRole] = useState<'reviewer' | 'editor'>('editor')
    return (<>
        <Panel
            icon={<UsersRound className='h-4 w-4' />}
            title='Review access'
            subtitle={activeConversation?.collaboration?.role === 'owner' ? 'Invite an editor or reviewer.' : `Shared with you as ${activeConversation?.collaboration?.role || 'viewer'}.`}
        >
            <Stat label='Owner' value={activeConversation?.ownerId || 'Unknown'} />
            <Stat label='Collaborators' value={`${activeConversation?.collaboration?.collaborators?.length || 0} invited`} />
            <Stat label='Seats' value={`${activeConversation?.collaboration?.seatCount || 0}/${activeConversation?.collaboration?.seatLimit || 0} used`} />
            {activeConversation?.id ? (
                <Link href={`/ai/${activeConversation.id}`} className='text-xs text-ui-muted underline-offset-4 hover:text-ui-text hover:underline'>
                    Session link: /ai/{activeConversation.id}
                </Link>
            ) : null}
            {activeConversation?.collaboration?.canInvite ? (
                <>
                    <div className='grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2'>
                        <input value={collaboratorUserId} onChange={(event) => setCollaboratorUserId(event.target.value)} placeholder='user id' className='min-w-0 rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
                        <select value={collaboratorRole} onChange={(event) => setCollaboratorRole(event.target.value === 'reviewer' ? 'reviewer' : 'editor')} className='rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border'>
                            <option value='editor'>Editor</option>
                            <option value='reviewer'>Reviewer</option>
                        </select>
                    </div>
                    <button
                        type='button'
                        onClick={() => void onInviteCollaborator({ userId: collaboratorUserId, role: collaboratorRole })}
                        disabled={collaboratorPending || (activeConversation.collaboration.remainingSeats <= 0 && !activeConversation.collaboration.collaborators.some((collaborator) => collaborator.userId === collaboratorUserId.trim()))}
                        className='rounded-lg bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text outline outline-ui-border transition-colors hover:text-ui-primary disabled:opacity-60'
                    >
                        {collaboratorPending ? 'Inviting...' : 'Invite collaborator'}
                    </button>
                </>
            ) : null}
            {activeConversation?.collaboration?.collaborators?.length ? (
                <div className='space-y-1'>
                    {activeConversation.collaboration.collaborators.slice(0, 6).map((collaborator) => (
                        <div key={collaborator.userId} className='flex items-center justify-between gap-3 rounded-lg bg-ui-raised px-3 py-2 text-xs text-ui-muted outline outline-ui-border'>
                            <div className='min-w-0'>
                                <div className='truncate'>{collaborator.name || collaborator.userId}</div>
                                <div className='truncate text-[10px] text-ui-muted'>{collaborator.userId}</div>
                            </div>
                            <div className='flex items-center gap-2'>
                                <span className='shrink-0 rounded-full bg-ui-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]'>{collaborator.role}</span>
                                {activeConversation.collaboration.canInvite || collaborator.userId === currentUserId ? (
                                    <button
                                        type='button'
                                        onClick={() => void onRemoveCollaborator(collaborator.userId)}
                                        disabled={collaboratorPending}
                                        className='rounded-lg bg-ui-panel px-2 py-1 text-[10px] text-ui-muted outline outline-ui-border transition-colors hover:text-ui-text disabled:opacity-60'
                                    >
                                        {collaborator.userId === currentUserId ? 'Leave' : 'Remove'}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            {activeConversation?.collaboration?.role !== 'owner' ? (
                <div className='text-xs text-ui-muted'>
                    Your current access lets you inspect this shared review and continue from the same conversation route.
                </div>
            ) : null}
            {collaborationError ? <ErrorNotice compact message={collaborationError} /> : null}
        </Panel>


    </>)
}
