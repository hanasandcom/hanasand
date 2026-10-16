import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import { CheckCircle2, CloudOff, Code2, FileCode2, Loader2, MessageSquare, Radio, TerminalSquare } from 'lucide-react'
import Code from '@/components/share/code'
import OpenFiles from '@/components/share/files/openFiles'
import ShareChat from '@/components/share/shareChat'
import type { ShareConflict, SharePresenceUser } from '@/components/share/useShareCodeSocket'
import { CollaborationStatus, normalizeTerminalStatus, StatusPill } from './workspaceStatus'

type SaveState = 'saved' | 'saving' | 'queued'
type CodeProps = ComponentProps<typeof Code>
type ChatProps = ComponentProps<typeof ShareChat>

type Props = {
    ui: {
        chatOpen: boolean
        setChatOpen: Dispatch<SetStateAction<boolean>>
        hydrated: boolean
        activeLabel: string
        openFiles: OpenFile[]
        setOpenFiles: Dispatch<SetStateAction<OpenFile[]>>
        isConnected: boolean
        participants: number
        saveState: SaveState
        terminalStatus: string
        workspaceCreated: boolean
    }
    presence: {
        users: SharePresenceUser[]
        otherUsers: SharePresenceUser[]
        editors: SharePresenceUser[]
        notice: string | null
        conflict: ShareConflict | null
        onDismissNotice(): void
        onUseRemote(): void
        onKeepMine(): void
    }
    code: CodeProps
    chat: ChatProps
}

export default function ShareWorkspaceMain({ ui, presence, code, chat }: Props) {
    return (
        <div className='flex-1 flex flex-col min-h-0 min-w-0 w-full gap-2 overflow-hidden text-ui-text max-w-full'>
            <div className='flex min-h-10 items-center justify-between gap-2 rounded-xl border border-ui-border bg-ui-panel px-2 py-1.5 shadow-lg backdrop-blur-md'>
                <div className='min-w-0 flex flex-1 items-center gap-2'>
                    {ui.chatOpen ? (
                        <div className='flex min-w-0 items-center gap-2 px-2 text-sm font-semibold text-ui-text'>
                            <MessageSquare className='h-4 w-4 shrink-0 text-ui-primary' />
                            <span className='truncate'>Workspace assistant</span>
                        </div>
                    ) : ui.openFiles.length ? (
                        <OpenFiles openFiles={ui.openFiles} setOpenFiles={ui.setOpenFiles} />
                    ) : (
                        <div className='flex min-w-0 items-center gap-2 px-2 text-sm text-ui-muted'>
                            <FileCode2 className='h-4 w-4 shrink-0 text-ui-primary' />
                            <span className='truncate'>{ui.activeLabel}</span>
                        </div>
                    )}
                </div>
                {!ui.chatOpen && (
                    <div className='hidden shrink-0 items-center gap-1.5 lg:flex'>
                        <StatusPill
                            icon={ui.isConnected ? <Radio className='h-3.5 w-3.5' /> : <CloudOff className='h-3.5 w-3.5' />}
                            label={ui.isConnected ? `${ui.participants} live` : ui.workspaceCreated ? 'Reconnecting' : 'Setting up'}
                            tone={ui.isConnected ? 'good' : 'warn'}
                        />
                        <StatusPill
                            icon={ui.saveState === 'saving' ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <CheckCircle2 className='h-3.5 w-3.5' />}
                            label={ui.saveState === 'saving' ? 'Saving' : ui.saveState === 'queued' ? 'Queued' : 'Saved'}
                            tone={ui.saveState === 'saved' ? 'good' : 'warn'}
                        />
                        <StatusPill
                            icon={<TerminalSquare className='h-3.5 w-3.5' />}
                            label={normalizeTerminalStatus(ui.terminalStatus)}
                            tone={ui.terminalStatus.toLowerCase().includes('ready') ? 'good' : 'neutral'}
                        />
                    </div>
                )}
                <button
                    type='button'
                    aria-label={ui.hydrated ? ui.chatOpen ? 'Back to workspace editor' : 'Open workspace assistant' : 'Setting up workspace assistant'}
                    disabled={!ui.hydrated}
                    onClick={() => ui.setChatOpen(prev => !prev)}
                    className='inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-muted transition hover:border-ui-primary/35 hover:bg-ui-primary/10 hover:text-ui-on-primary disabled:cursor-not-allowed disabled:opacity-45'
                >
                    {ui.chatOpen ? <Code2 className='h-4 w-4' /> : <MessageSquare className='h-4 w-4' />}
                    {ui.chatOpen ? 'Back to editor' : 'Assistant'}
                </button>
            </div>
            {!ui.chatOpen && <CollaborationStatus {...presence} />}
            {ui.chatOpen ? (
                <div className='min-h-0 flex-1 rounded-xl border border-ui-border bg-ui-panel p-2 shadow-lg backdrop-blur-md'>
                    <ShareChat {...chat} />
                </div>
            ) : <Code {...code} />}
        </div>
    )
}
