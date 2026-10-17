export function printAuditResults(results) {
    const failed = results.filter(result => !result.ok)
    console.table(results.map(({ body, ...result }) => {
        void body
        return result
    }))
    if (failed.length) {
        console.error(JSON.stringify(failed, null, 2))
        process.exitCode = 1
    }
}
