import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { isValidMetricValue, isWritableMetricField } from './fields.ts'

export default async function putVMMetrics(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasHanasandInternalRouteAccess(req)
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const data = req.body as Record<string, unknown> | undefined ?? {}
    if (!id) {
        return res.status(400).send({ error: 'Missing metrics id' })
    }

    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        return res.status(400).send({ error: 'No fields to update' })
    }

    const fields = Object.keys(data)
    if (fields.some((field) => !isWritableMetricField(field))) {
        return res.status(400).send({ error: 'Invalid metrics field' })
    }
    if (fields.some((field) => !isValidMetricValue(field, data[field]))) {
        return res.status(400).send({ error: 'Invalid metrics value' })
    }

    try {
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
        const values = fields.map((field) => data[field] as string | number | boolean | null)

        const query = `
            UPDATE vm_metrics
            SET ${setClause}
            WHERE id = $${fields.length + 1}
            RETURNING *
        `

        const result = await run(query, [...values, id])

        if (result.rows.length === 0) {
            return res.status(404).send({ error: 'Metrics not found' })
        }

        return res.send(result.rows[0])
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Failed to update vm metrics' })
    }
}
