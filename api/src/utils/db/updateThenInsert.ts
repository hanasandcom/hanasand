type RowCountResult = { rowCount: number | null }

export async function updateThenInsert<T extends RowCountResult>(
    update: () => Promise<T>,
    insert: () => Promise<T>,
    retryMiss: 'throw' | 'return' = 'throw',
) {
    const updated = await update()
    if (updated.rowCount) return updated
    try {
        return await insert()
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount && retryMiss === 'throw') throw error
        return retried
    }
}
