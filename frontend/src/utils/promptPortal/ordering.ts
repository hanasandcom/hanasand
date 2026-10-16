import type { PromptPortalItem } from './store'

export function comparePromptItems(a: PromptPortalItem, b: PromptPortalItem) {
    return priorityRank(a.priority) - priorityRank(b.priority) || Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

function priorityRank(value: PromptPortalItem['priority']) {
    return value === 'now' ? 0 : 1
}
