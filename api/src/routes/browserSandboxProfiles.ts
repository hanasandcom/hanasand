import type { FastifyInstance } from 'fastify'
import { getBrowserSandboxProfiles, putBrowserSandboxProfiles } from '../handlers/browserSandboxProfiles.ts'

export default async function browserSandboxProfileRoutes(fastify: FastifyInstance) {
    fastify.get('/browser/profiles', getBrowserSandboxProfiles)
    fastify.put('/browser/profiles', putBrowserSandboxProfiles)
    fastify.get('/browser-sandbox/profiles', getBrowserSandboxProfiles)
    fastify.put('/browser-sandbox/profiles', putBrowserSandboxProfiles)
}
