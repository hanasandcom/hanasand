export default function conversationTitle(title?: string | null) {
    const normalized = title?.trim()
    return !normalized || normalized === 'New chat' || normalized === 'New workspace review' || normalized === 'Workspace review' ? 'Review assistant' : normalized
}
