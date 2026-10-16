'use client'

import randomId from '@/utils/random/randomId'
import type { AiToolCall } from './aiToolTypes'
export type { AiToolCall } from './aiToolTypes'

export function parseToolCalls(content: string): AiToolCall[] {
    const matches = [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)]
    const results: AiToolCall[] = []
    for (const match of matches) {
        try {
            const parsed = JSON.parse(match[1]) as AiToolCall
            if (parsed?.action) {
                results.push(parsed)
            }
        } catch (error) {
            console.error('Invalid Hanasand tool payload', error)
        }
    }
    return results
}

export function stripToolTags(content: string) {
    return content.replace(/<hanasand-tool>[\s\S]*?<\/hanasand-tool>/g, '').replace(/\n{3,}/g, '\n\n')
}

export function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `vm-${randomId(6).toLowerCase()}`
}
