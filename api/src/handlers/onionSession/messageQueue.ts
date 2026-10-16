const MAX_PENDING_MESSAGES = 100
const MAX_PENDING_MESSAGE_BYTES = 1024 * 1024

export type OnionSessionMessage = {
    type: string
    event?: string
    buttons?: number
}

export class OnionSessionMessageQueue<T extends OnionSessionMessage> {
    private readonly pending: Array<{ message: T; bytes: number }> = []
    private running = false
    private pendingBytes = 0

    constructor(
        private readonly handle: (message: T) => Promise<void>,
        private readonly reportError: (error: unknown) => void,
        private readonly maximumPending = MAX_PENDING_MESSAGES,
        private readonly maximumPendingBytes = MAX_PENDING_MESSAGE_BYTES,
    ) {}

    enqueue(message: T) {
        const messageBytes = Buffer.byteLength(JSON.stringify(message), 'utf8')
        if (this.isHoverPointerMove(message)) {
            const lastPending = this.pending.at(-1)
            if (lastPending && this.isHoverPointerMove(lastPending.message)) {
                if (this.pendingBytes - lastPending.bytes + messageBytes > this.maximumPendingBytes) return true
                this.pending[this.pending.length - 1] = { message, bytes: messageBytes }
                this.pendingBytes += messageBytes - lastPending.bytes
                return true
            }
            if (this.isOverLimit(messageBytes)) return true
        } else if (this.isOverLimit(messageBytes)) {
            return false
        }

        this.pending.push({ message, bytes: messageBytes })
        this.pendingBytes += messageBytes
        void this.drain()
        return true
    }

    private isOverLimit(messageBytes: number) {
        return this.pending.length >= this.maximumPending
            || this.pendingBytes + messageBytes > this.maximumPendingBytes
    }

    private async drain() {
        if (this.running) return
        this.running = true
        try {
            while (this.pending.length) {
                const { message, bytes } = this.pending.shift()!
                this.pendingBytes -= bytes
                await this.handle(message).catch(this.reportError)
            }
        } finally {
            this.running = false
            if (this.pending.length) void this.drain()
        }
    }

    private isHoverPointerMove(message: T) {
        return message.type === 'pointer' && message.event === 'pointermove' && !(message.buttons && message.buttons > 0)
    }
}
