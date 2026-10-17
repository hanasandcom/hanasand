export async function copyTextToClipboard(value: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(value)
        return true
    } catch {
        const textarea = document.createElement('textarea')
        textarea.value = value
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        try {
            textarea.select()
            return document.execCommand('copy')
        } catch {
            return false
        } finally {
            textarea.remove()
        }
    }
}
