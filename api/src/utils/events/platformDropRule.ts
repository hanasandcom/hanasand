import type run from '#db'

export async function loadPlatformDropRule(ruleId: string, query: typeof run) {
    const result = await query(`SELECT r.organization_id,r.version,r.definition FROM rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o NOWAIT`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, ruleId])
    return result.rows[0]
}
