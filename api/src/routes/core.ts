import { caseRepositoryWebhooks, getCaseDevelopment, getCaseRepositories, postCaseRepository, deleteCaseRepository, getCaseCommits, postCaseCommit } from '../handlers/caseDevelopment.ts'
import indexHandler from '../handlers/index.ts'
import { downloadAppUpdate, downloadNamedAppUpdate, getAppUpdate, getTauriAppUpdate } from '../handlers/app/get.ts'

import type { FastifyInstance } from 'fastify'

export async function registerCoreRoutes(fastify: FastifyInstance) {
    // Index handler
    fastify.get('/', indexHandler)
    fastify.get('/health', async () => ({ ok: true, service: 'hanasand_api', release: process.env.HANASAND_RELEASE_COMMIT || 'unknown' }))

    // Desktop app update feed
    fastify.get('/app', getAppUpdate)
    fastify.get('/app/:target/:version', getTauriAppUpdate)
    fastify.get('/app/download', downloadAppUpdate)
    fastify.get('/app/download/:name', downloadNamedAppUpdate)

    await fastify.register(caseRepositoryWebhooks)
    fastify.get('/cases/development', getCaseDevelopment)
    fastify.get('/cases/development/commits', getCaseCommits)
    fastify.post('/cases/development/commits', postCaseCommit)
    fastify.get('/cases/repositories', getCaseRepositories)
    fastify.post('/cases/repositories', postCaseRepository)
    fastify.delete('/cases/repositories/:id', deleteCaseRepository)

}
