export default async function uploadMarkdownImage(file: File, studioPublic = false): Promise<string> {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5_242_880) throw new Error('Use a PNG, JPEG, WebP or GIF under 5 MB.')
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    const response = await fetch('/api/markdown/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: file.type, data: btoa(binary), studioPublic }) })
    const result = await response.json()
    if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'Image upload failed.')
    return result.url
}
