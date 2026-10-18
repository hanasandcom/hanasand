import type { Route } from '@playwright/test'

type AiReply = { message: string }

export async function fulfillAiReply(route: Route, reply: AiReply) {
    await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reply),
    })
}
