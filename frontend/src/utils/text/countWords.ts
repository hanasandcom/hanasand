export default function countWords(value: string) {
    return value.trim() ? value.trim().split(/\s+/).length : 0
}
