import randomId from '@/utils/random/randomId'
import { findTreeFileId } from '@/components/ai/shareTree'
import type { PendingShareChange, ToolCall } from './shareChatTypes'

export function parseToolCalls(content: string): ToolCall[] {
    return [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].flatMap((match) => {
        try {
            const parsed = JSON.parse(match[1]) as ToolCall
            return Array.isArray(parsed.actions) ? parsed.actions : [parsed]
        } catch {
            return []
        }
    })
}

export function buildPendingChanges(toolCalls: ToolCall[], share: Share, tree: Tree | null, editingContent: string): PendingShareChange[] {
    return toolCalls.flatMap((call) => {
        if (!call.content || !['update_share', 'upsert_share', 'create_share'].includes(call.action || '')) {
            return []
        }
        const path = normalizeSharePath(call.path || share.path || 'index.html')
        const existingShareId = call.shareId || findTreeFileId(tree, path) || (path === share.path ? share.id : undefined)
        return [{
            id: randomId(),
            action: call.action === 'update_share' ? 'update_share' : 'upsert_share',
            shareId: existingShareId,
            path,
            beforeContent: existingShareId === share.id ? editingContent : '',
            content: call.content,
            created: !existingShareId,
        }]
    })
}
export function normalizeSharePath(path: string) {
    return path.replace(/^\/+/, '').trim() || 'index.html'
}

export function fileNameFromPath(path: string) {
    return normalizeSharePath(path).split('/').filter(Boolean).pop() || 'index.html'
}

export function parentIdForPath(tree: Tree | null, filePath: string) {
    const folders = normalizeSharePath(filePath).split('/').filter(Boolean).slice(0, -1)
    if (!tree || folders.length === 0) {
        return undefined
    }

    function walk(items: Tree, depth: number): string | undefined {
        const name = folders[depth]
        const folder = items.find((item) => item.type === 'folder' && item.name === name)
        if (!folder || folder.type !== 'folder') {
            return undefined
        }
        if (depth === folders.length - 1) {
            return folder.id
        }
        return walk(folder.children, depth + 1)
    }

    return walk(tree, 0)
}
export function summarizePendingChange(change: PendingShareChange) {
    const beforeLines = change.beforeContent ? change.beforeContent.split('\n') : []
    const afterLines = change.content ? change.content.split('\n') : []
    const max = Math.max(beforeLines.length, afterLines.length)
    let added = 0
    let removed = 0
    for (let index = 0; index < max; index += 1) {
        const oldLine = beforeLines[index]
        const newLine = afterLines[index]
        if (oldLine === newLine) {
            continue
        }
        if (typeof oldLine === 'string' && oldLine.length > 0) {
            removed += 1
        }
        if (typeof newLine === 'string' && newLine.length > 0) {
            added += 1
        }
    }
    return {
        action: change.shareId ? 'Update' : 'Create',
        added,
        removed,
        totalLines: afterLines.filter((line) => line.length > 0).length,
        kind: change.created || !change.shareId ? 'New file' : 'Existing file',
    }
}

export function buildDiff(before: string, after: string) {
    const beforeLines = before.split('\n')
    const afterLines = after.split('\n')
    const lines: string[] = []
    const max = Math.max(beforeLines.length, afterLines.length)
    for (let index = 0; index < max; index += 1) {
        const oldLine = beforeLines[index]
        const newLine = afterLines[index]
        if (oldLine === newLine) {
            if (typeof newLine === 'string') {
                lines.push(`  ${newLine}`)
            }
            continue
        }
        if (typeof oldLine === 'string') {
            lines.push(`- ${oldLine}`)
        }
        if (typeof newLine === 'string') {
            lines.push(`+ ${newLine}`)
        }
    }
    return lines.slice(0, 260).join('\n') || 'No visible line changes.'
}
