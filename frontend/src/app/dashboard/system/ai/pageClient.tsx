'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import GPT_Content from '@components/gpt/content'
import GPT_EmptyState from '@components/gpt/emptyState'
import GPT_Header from '@components/gpt/header'
import TestClientPopup from '@components/gpt/testClientPopup'
import useGptPageState from '@components/gpt/useGptPageState'
import { AIContainerHealth, logContainerFrom } from './aiContainerHealth'
import { ReliabilityCards } from './aiReliabilityCards'
import { useAiDashboardTelemetry } from './useAiDashboardTelemetry'

export default function GPT_Page() {
    const gpt = useGptPageState()
    const { economics, economicsError, aiContainers, containerError } = useAiDashboardTelemetry()
    const logContainer = logContainerFrom(aiContainers)

    return (
        <>
            <div className='h-full w-full overflow-y-auto'>
                <div className='mx-auto flex w-full max-w-330 flex-col gap-4 px-4 pb-4 pt-6 sm:px-6 md:px-8 md:pt-8'>
                    <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
                        <div>
                            <h1 className='mt-1 text-2xl font-semibold text-ui-text'>AI operations</h1>
                        </div>
                        <div className='flex flex-wrap items-center justify-end gap-2'>
                            <GPT_Header
                                isConnected={gpt.isConnected}
                                participants={gpt.participants}
                                logsHref={logContainer
                                    ? `/logs?service=${encodeURIComponent(logContainer.name)}`
                                    : undefined}
                            />
                            <Link
                                href='/system'
                                className='flex h-9 items-center gap-2 rounded-md bg-ui-raised px-4 text-sm text-ui-text border border-ui-border transition-colors hover:bg-ui-panel'
                            >
                                <ArrowLeft className='h-4 w-4' />
                                Back to system
                            </Link>
                        </div>
                    </div>
                    <AIContainerHealth containers={aiContainers} error={containerError} />
                    <div id='ai-clients' data-ai-clients>
                        {gpt.clients.length ? (
                            <GPT_Content
                                clients={gpt.clients}
                                onTestClient={gpt.openChat}
                                metrics={<ReliabilityCards economics={economics} error={economicsError} />}
                            />
                        ) : (
                            <div className='space-y-4'>
                                <div className='grid gap-4 md:grid-cols-2'>
                                    <ReliabilityCards economics={economics} error={economicsError} />
                                </div>
                                <GPT_EmptyState />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {gpt.chatSession && gpt.activeClient ? (
                <TestClientPopup
                    client={gpt.activeClient}
                    conversationId={gpt.chatSession.conversationId}
                    isSending={gpt.chatSession.isSending}
                    messages={gpt.chatSession.messages}
                    metrics={gpt.chatSession.metrics}
                    onClose={gpt.closeChat}
                    onSend={gpt.sendPrompt}
                />
            ) : null}
        </>
    )
}
