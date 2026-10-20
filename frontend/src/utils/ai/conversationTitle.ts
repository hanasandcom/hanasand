export default function conversationTitle(title?: string | null) {
    const normalized = title?.trim()
    return !normalized || normalized === 'Review assistant' || normalized === 'New workspace review' || normalized === 'Workspace review' ? 'New chat' : normalized
}
