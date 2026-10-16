import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { writeVmDetails } from '#utils/vms/vmDetails.ts'

const requiredFields: (keyof PostVmDetails)[] = [
    'name', 'status', 'type', 'architecture', 'created', 'last_used',
    'config_architecture', 'config_image_architecture', 'config_image_description',
    'config_image_label', 'config_image_os', 'config_image_release', 'config_image_serial',
    'config_image_type', 'config_image_version', 'limits_cpu', 'limits_memory',
    'volatile_base_image', 'volatile_cloud_init_instance_id', 'volatile_eth0_hwaddr',
    'volatile_last_state_power', 'volatile_uuid',
    'volatile_uuid_generation', 'volatile_vsock_id',
    'device_eth0_ipv4_address', 'device_eth0_name', 'device_eth0_network',
    'device_eth0_type', 'ephemeral', 'stateful', 'description', 'profiles'
]

export default async function postVMDetails(req: FastifyRequest, res: FastifyReply) {
    const details = req.body as PostVmDetails ?? {}

    if (!hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const missingFields = requiredFields.filter(field => details[field] === undefined || details[field] === null)
    if (missingFields.length > 0) {
        return res.status(400).send({ error: `Missing required fields: ${missingFields.join(', ')}` })
    }

    try {
        await run(`
            DELETE FROM vms
            WHERE name = $1
              AND owner = 'ownerless'
              AND EXISTS (
                  SELECT 1
                  FROM vms owned
                  WHERE LOWER(owned.name) = LOWER($1)
                    AND owned.name <> $1
                    AND owned.owner <> 'ownerless'
              )
        `, [details.name])

        await run(`
            UPDATE vms
            SET name = $1
            WHERE LOWER(name) = LOWER($1)
              AND name <> $1
              AND NOT EXISTS (SELECT 1 FROM vms WHERE name = $1)
        `, [details.name])

        await run(`
            INSERT INTO vms (name, owner, created_by, access_users)
            VALUES ($1, 'ownerless', 'unknown', '[]'::jsonb)
            ON CONFLICT (name) DO NOTHING
        `, [details.name])

        const result = await writeVmDetails({
            ...details,
            ephemeral: details.ephemeral === 'true',
            stateful: details.stateful === 'true',
            last_checked: new Date().toISOString(),
        })

        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
