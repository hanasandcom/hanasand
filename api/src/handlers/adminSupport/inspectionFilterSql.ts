export type SharedAuditFilter = 'organization' | 'action' | 'severity' | 'source' | 'service' | 'entityType' | 'request' | 'supportSession' | 'workflow' | 'blocker' | 'reason' | 'scope' | 'context' | 'outcome' | 'from' | 'to'

export function supportSqlFilters() {
    const where: string[] = []
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    return { where, values, add }
}

export function appendSharedAuditFilter(
    where: string[],
    add: (value: string) => string,
    alias: 'e' | 'event',
    filter: SharedAuditFilter,
    value: string,
) {
    const search = () => add(`%${value}%`)
    switch (filter) {
        case 'organization': {
            const placeholder = search()
            where.push(`(${alias}.organization_id ILIKE ${placeholder} OR organization.name ILIKE ${placeholder} OR organization.slug ILIKE ${placeholder})`)
            break
        }
        case 'action': where.push(`${alias}.event_type ILIKE ${search()}`); break
        case 'severity': where.push(`${alias}.severity = ${add(value)}`); break
        case 'source': where.push(`${alias}.source ILIKE ${search()}`); break
        case 'service': where.push(`${alias}.service ILIKE ${search()}`); break
        case 'entityType': where.push(`${alias}.object_type ILIKE ${search()}`); break
        case 'request': where.push(`${alias}.request_id ILIKE ${search()}`); break
        case 'supportSession': {
            const placeholder = search()
            where.push(`(${alias}.subject_id ILIKE ${placeholder} OR ${alias}.context->>'supportSessionId' ILIKE ${placeholder})`)
            break
        }
        case 'workflow': where.push(`${alias}.context->>'workflow' ILIKE ${search()}`); break
        case 'blocker': {
            const placeholder = search()
            where.push(`(${alias}.context->>'blockerCode' ILIKE ${placeholder} OR ${alias}.context->>'blocker' ILIKE ${placeholder})`)
            break
        }
        case 'reason': where.push(`${alias}.reason ILIKE ${search()}`); break
        case 'scope': {
            const placeholder = search()
            where.push(`(${alias}.context->>'scope' ILIKE ${placeholder} OR ${alias}.context->>'supportScope' ILIKE ${placeholder} OR ${alias}.context::text ILIKE ${placeholder})`)
            break
        }
        case 'context': where.push(`${alias}.context::text ILIKE ${search()}`); break
        case 'outcome': where.push(`${alias}.outcome = ${add(value)}`); break
        case 'from': where.push(`${alias}.created_at >= ${add(new Date(value).toISOString())}`); break
        case 'to': where.push(`${alias}.created_at <= ${add(new Date(value).toISOString())}`); break
    }
}
