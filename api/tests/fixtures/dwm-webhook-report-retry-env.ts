export const controlledReceiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'

export function enableLiveDelivery() {
    const previous = process.env.DWM_WEBHOOK_LIVE_DELIVERY
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
    return () => {
        if (previous === undefined) delete process.env.DWM_WEBHOOK_LIVE_DELIVERY
        else process.env.DWM_WEBHOOK_LIVE_DELIVERY = previous
    }
}

export async function withLiveDelivery(work: () => Promise<void>) {
    const restore = enableLiveDelivery()
    try { await work() } finally { restore() }
}
