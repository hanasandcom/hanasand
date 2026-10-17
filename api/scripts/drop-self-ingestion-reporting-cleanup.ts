import type { queryOnce } from '#db'

export function deleteSelfIngestionReportingRows(
    query: typeof queryOnce,
    organizationId: string,
    eventIds: string[],
) {
    return query(`DELETE FROM log_dimensions d
        USING events e WHERE d.event_id=e.id AND e.organization_id=$1 AND e.id=ANY($2::text[])`, [organizationId, eventIds])
}
