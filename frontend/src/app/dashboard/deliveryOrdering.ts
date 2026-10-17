export function orderDeliveries<T extends { attemptedAt?: string }>(rows: T[]): T[] {
    return [...rows].sort((first, second) => String(second.attemptedAt || '').localeCompare(String(first.attemptedAt || '')))
}
