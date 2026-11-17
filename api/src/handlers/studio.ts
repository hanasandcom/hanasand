import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { queryOnce } from '#db'
import { createStudioPage, listStudioPages, readStudio, saveStudio, validStudio } from '#utils/studio.ts'
import { hanasandOrganizationSession, thesisCredentials } from '#utils/thesisAccess.ts'

async function member(req: FastifyRequest, res: FastifyReply) {
    const { id, token, deviceProof } = thesisCredentials(req)
    const session = await hanasandOrganizationSession(id, token, deviceProof, req)
    if (!session) { res.status(401).send({ error: 'A valid session is required.' }); return false }
    if (!session.organizationMember) { res.status(403).send({ error: 'Hanasand organization membership is required.' }); return false }
    return true
}

export async function getStudio(req: FastifyRequest, res: FastifyReply) {
    try {
        const raw = (req.query as { page?: string } | undefined)?.page
        const id = raw === undefined ? 1 : Number(raw)
        if (!Number.isSafeInteger(id) || id < 1 || id > 32767) return res.status(404).send()
        const document = await readStudio(id)
        if (!document) return res.status(404).send()
        return res.header('Cache-Control', 'no-store').send(document)
    } catch (error) { req.log.error(error); return res.status(500).send({ error: 'Studio could not be loaded.' }) }
}

export async function getStudioPages(req: FastifyRequest, res: FastifyReply) {
    try { return res.header('Cache-Control', 'no-store').send(await listStudioPages()) }
    catch (error) { req.log.error(error); return res.status(500).send({ error: 'Studio pages could not be loaded.' }) }
}

export async function postStudioPage(req: FastifyRequest, res: FastifyReply) {
    try {
        if (!await member(req, res)) return res
        return res.status(201).header('Cache-Control', 'no-store').send(await createStudioPage())
    } catch (error) { req.log.error(error); return res.status(500).send({ error: 'Studio page could not be created.' }) }
}

export async function putStudio(req: FastifyRequest, res: FastifyReply) {
    try {
        if (!await member(req, res)) return res
        if (!validStudio(req.body)) return res.status(400).send({ error: 'Invalid Studio document.' })
        const result = await saveStudio(req.body)
        return res.status(result.status).header('Cache-Control', 'no-store').send(result.document)
    } catch (error) { req.log.error(error); return res.status(500).send({ error: 'Studio could not be saved.' }) }
}

function matchesImage(type: string, data: Buffer) {
    if (type === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (type === 'image/jpeg') return data[0] === 255 && data[1] === 216 && data[2] === 255
    if (type === 'image/gif') return data.subarray(0, 6).toString('ascii') === 'GIF87a' || data.subarray(0, 6).toString('ascii') === 'GIF89a'
    if (type === 'image/webp') return data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP'
    return false
}

export async function postMarkdownImage(req: FastifyRequest, res: FastifyReply) {
    try {
        if (!await member(req, res)) return res
        const body = req.body as { type?: unknown, data?: unknown, studioPublic?: unknown } | null
        if (typeof body?.type !== 'string' || typeof body.data !== 'string' || body.data.length > 7_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data)) return res.status(400).send({ error: 'Invalid image.' })
        const data = Buffer.from(body.data, 'base64')
        if (!data.length || data.length > 5_242_880 || !matchesImage(body.type, data)) return res.status(400).send({ error: 'Use a PNG, JPEG, WebP or GIF under 5 MB.' })
        const id = randomUUID()
        const studioPublic = body.studioPublic === true
        await queryOnce('INSERT INTO markdown_images (id, media_type, data, studio_public) VALUES ($1, $2, decode($3, $4), $5)', [id, body.type, data.toString('base64'), 'base64', studioPublic])
        return res.status(201).header('Cache-Control', 'no-store').send({ url: `/api/markdown/images/${id}` })
    } catch (error) { req.log.error(error); return res.status(500).send({ error: 'Image upload failed.' }) }
}

export async function getMarkdownImage(req: FastifyRequest, res: FastifyReply) {
    try {
        const { id } = req.params as { id: string }
        if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(404).send()
        const result = await queryOnce('SELECT media_type, data, studio_public FROM markdown_images WHERE id = $1', [id])
        if (!result.rows[0]) return res.status(404).send()
        if (!result.rows[0].studio_public && !await member(req, res)) return res
        return res.header('Content-Type', result.rows[0].media_type).header('X-Content-Type-Options', 'nosniff').header('Cache-Control', 'no-store').send(result.rows[0].data)
    } catch (error) { req.log.error(error); return res.status(500).send() }
}
