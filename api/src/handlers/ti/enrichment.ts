import type { FastifyReply, FastifyRequest } from 'fastify'

interface RunBody {
    batchSize?: number
}

export async function getTiEnrichment(_req: FastifyRequest, res: FastifyReply) {
    return sendRetiredResponse(res, 410, 'API-owned actor enrichment is retired. Read canonical evidence through the TI scraper.')
}

export async function postTiEnrichmentRun(_req: FastifyRequest<{ Body: RunBody }>, res: FastifyReply) {
    return sendRetiredResponse(res, 409, 'API-owned actor enrichment is retired. Run collection through the canonical TI scraper.')
}

function sendRetiredResponse(res: FastifyReply, status: 409 | 410, message: string) {
    res.header('cache-control', 'no-store, max-age=0')
    return res.status(status).send({
        ok: false,
        error: 'api_ti_enrichment_retired',
        message,
        canonicalRoute: '/v1/intel/search',
    })
}
