import AIWorkspacePage from '../AIWorkspacePage'

export default async function AIConversationPage({ params }: { params: Promise<{ id: string }> }) {
    return AIWorkspacePage({ params })
}
