import type { BrowserContext } from '@playwright/test'

export async function installAiSocketMock(context: BrowserContext, {
    promptCompleteContent,
    promptResponses,
    modelConnected,
}: {
    promptCompleteContent: string
    promptResponses: { match: string, content: string }[]
    modelConnected: boolean
}) {
    await context.addInitScript(({ content, responses, connected }: { content: string, responses: { match: string, content: string }[], connected: boolean }) => {
        ;(window as typeof window & {
            __lastTerminalCommand?: string
            __lastAiPromptRequest?: unknown
            __HANASAND_CREATE_SOCKET__?: (url: string) => WebSocket
        }).__lastTerminalCommand = ''
        ;(window as typeof window & {
            __lastAiPromptRequest?: unknown
        }).__lastAiPromptRequest = null

        class MockHanasandSocket {
            static OPEN = 1
            static CLOSED = 3

            url: string
            readyState = MockHanasandSocket.OPEN
            onopen: ((event: Event) => void) | null = null
            onclose: ((event: CloseEvent) => void) | null = null
            onerror: ((event: Event) => void) | null = null
            onmessage: ((event: MessageEvent<string>) => void) | null = null

            constructor(url: string) {
                this.url = url
                window.setTimeout(() => {
                    this.onopen?.(new Event('open'))
                    if (url.includes('/client/ws/gpt') && connected) {
                        this.emit({
                            type: 'snapshot',
                            participants: 1,
                            clients: [{
                                name: 'local-32b',
                                ram: [],
                                cpu: [],
                                gpu: [],
                                model: {
                                    conversationId: null,
                                    status: 'idle',
                                    currentTokens: 0,
                                    maxTokens: 0,
                                    promptTokens: 0,
                                    generatedTokens: 0,
                                    contextTokens: 0,
                                    contextMaxTokens: 0,
                                    tps: 137,
                                    lastUpdated: new Date().toISOString(),
                                    lastError: null,
                                },
                            }],
                        })
                    }
                }, 0)
            }

            send(data: string) {
                if (this.url.includes('/client/ws/gpt')) {
                    const payload = JSON.parse(data) as { conversationId?: string, messages?: { role: string, content: string }[] }
                    ;(window as typeof window & {
                        __lastAiPromptRequest?: unknown
                    }).__lastAiPromptRequest = payload
                    const conversationId = payload.conversationId || 'unknown'
                    const userPrompt = [...(payload.messages || [])].reverse().find((message) => message.role === 'user')?.content || ''
                    const selectedContent = responses.find((response) => userPrompt.toLowerCase().includes(response.match.toLowerCase()))?.content || content
                    this.emit({
                        type: 'prompt_started',
                        conversationId,
                        clientName: 'local-32b',
                        metrics: {
                            conversationId,
                            status: 'generating',
                            currentTokens: 0,
                            maxTokens: 1024,
                            promptTokens: 200,
                            generatedTokens: 0,
                            contextTokens: 200,
                            contextMaxTokens: 24576,
                            tps: 137,
                            lastUpdated: new Date().toISOString(),
                            lastError: null,
                        },
                    })
                    window.setTimeout(() => {
                        this.emit({
                            type: 'prompt_complete',
                            conversationId,
                            clientName: 'local-32b',
                            content: selectedContent,
                            metrics: {
                                conversationId,
                                status: 'idle',
                                currentTokens: 0,
                                maxTokens: 1024,
                                promptTokens: 200,
                                generatedTokens: 80,
                                contextTokens: 280,
                                contextMaxTokens: 24576,
                                tps: 137,
                                lastUpdated: new Date().toISOString(),
                                lastError: null,
                            },
                        })
                    }, 50)
                    return
                }

                if (this.url.includes('/share/')) {
                    const payload = JSON.parse(data) as { content?: string }
                    ;(window as typeof window & {
                        __lastTerminalCommand?: string
                    }).__lastTerminalCommand = typeof payload.content === 'string' ? payload.content.trim() : ''
                    window.setTimeout(() => {
                        this.emit({
                            type: 'update',
                            content: '/workspace/northstar-admin\nREADME.md\npackage.json\n',
                        })
                        this.close()
                    }, 50)
                }
            }

            close() {
                this.readyState = MockHanasandSocket.CLOSED
                this.onclose?.(new CloseEvent('close'))
            }

            private emit(payload: unknown) {
                this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }))
            }
        }

        ;(window as typeof window & {
            __HANASAND_CREATE_SOCKET__?: (url: string) => WebSocket
        }).__HANASAND_CREATE_SOCKET__ = (url: string) => new MockHanasandSocket(url) as unknown as WebSocket
    }, { content: promptCompleteContent, responses: promptResponses, connected: modelConnected })
}
