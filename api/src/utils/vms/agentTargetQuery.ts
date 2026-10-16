import run from '#db'

export type AgentTargetVmRow = {
    name: string
    owner: string
    created_by: string
    organization_id: string | null
    access_users: string[] | null
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_image_description: string
    limits_cpu: string
    limits_memory: string
    device_eth0_ipv4_address: string
    last_checked: string
}

export const agentTargetSelect = `
    SELECT
        v.name,
        v.owner,
        v.created_by,
        v.organization_id,
        CASE WHEN v.organization_id IS NULL THEN v.access_users ELSE COALESCE((
            SELECT jsonb_agg(m.user_id) FROM organization_members m JOIN organizations o ON o.id = m.organization_id
            WHERE m.organization_id = v.organization_id AND m.status = 'active' AND o.status = 'active' AND m.role IN ('owner', 'admin')
        ), '[]'::jsonb) END AS access_users,
        COALESCE(d.status, 'unknown') AS status,
        COALESCE(d.type, 'virtual-machine') AS type,
        COALESCE(d.architecture, 'unknown') AS architecture,
        COALESCE(d.created, '') AS created,
        COALESCE(d.last_used, '') AS last_used,
        COALESCE(d.config_image_description, '') AS config_image_description,
        COALESCE(d.limits_cpu, '') AS limits_cpu,
        COALESCE(d.limits_memory, '') AS limits_memory,
        COALESCE(d.device_eth0_ipv4_address, '') AS device_eth0_ipv4_address,
        COALESCE(d.last_checked::text, '') AS last_checked
    FROM (SELECT * FROM vms WHERE deleted_at IS NULL) v
    LEFT JOIN vm_details d ON d.name = v.name
`

export async function loadAgentTargetVm(name: string): Promise<AgentTargetVmRow | null> {
    const result = await run(`
        ${agentTargetSelect}
        WHERE v.name = $1
        LIMIT 1
    `, [name])

    return result.rows.length ? result.rows[0] as AgentTargetVmRow : null
}
