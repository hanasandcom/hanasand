export function numberValue(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
}
