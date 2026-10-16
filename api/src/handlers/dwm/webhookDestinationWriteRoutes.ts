import type { FastifyReply, FastifyRequest } from 'fastify'
import {
    archiveDwmWebhookDestination,
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookCustomerSetupProof,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationContracts,
    buildDwmWebhookDestinationCrudContract,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationLifecycle,
    clean,
    createDwmWebhookDestination,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    updateDwmWebhookDestination,
} from '#utils/dwm/webhooks.ts'
import { authenticatedUserId, sendConfigurationPermissionError, updatePreview } from './webhookRouteAuth.ts'
import { loadDestinationCrudPreflight } from './webhookRouteOrganizations.ts'
import { buildDwmWebhookDestinationChangeResponse } from './webhookResponses.ts'
import type { IdParams } from './webhookRouteTypes.ts'
import type { DwmWebhookDestinationInput } from '#utils/dwm/webhooks.ts'

export async function postDwmWebhookDestination(req: FastifyRequest<{ Body: DwmWebhookDestinationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = clean(req.body?.orgId) || userId
    if (await sendConfigurationPermissionError(res, orgId, userId)) return

    const existingDestinations = await listDwmWebhookDestinations(userId, orgId)
    const destinationCrud = buildDwmWebhookDestinationCrudContract({
        action: 'create',
        ownerId: userId,
        input: { ...req.body, orgId },
        destinations: existingDestinations,
        viewerRole: orgId === userId ? 'owner' : 'admin',
        canManage: true,
    })
    if (!destinationCrud.canApply) {
        return res.status(destinationCrud.blockingCodes.includes('duplicate_destination') ? 409 : 400).send({
            error: destinationCrud.blockers[0]?.message || 'Webhook destination cannot be created.',
            destinationCrud,
        })
    }

    try {
        const destination = await createDwmWebhookDestination(userId, { ...req.body, orgId })
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        const destinations = [destination, ...existingDestinations.filter(item => item.id !== destination.id)]
        return res.status(201).send({
            destination,
            destinationCrud: buildDwmWebhookDestinationCrudContract({
                action: 'create',
                ownerId: userId,
                input: { ...req.body, orgId },
                destination,
                destinations,
                auditEvents,
                viewerRole: orgId === userId ? 'owner' : 'admin',
                canManage: true,
            }),
            destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], auditEvents })[0],
            destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], auditEvents })[0],
            customerSetup: buildDwmWebhookCustomerSetupProof({ destinations, auditEvents, viewerRole: orgId === userId ? 'owner' : 'admin', canManage: true }),
            destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], auditEvents, viewerRole: 'owner', canManage: true })[0],
            destinationAdminProof: buildDwmWebhookDestinationAdminProof({ destinations: [destination], auditEvents, viewerRole: 'owner', canManage: true }),
            auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, destinations: [destination] }),
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid webhook destination.' })
    }
}

export async function putDwmWebhookDestination(req: FastifyRequest<{ Params: IdParams, Body: DwmWebhookDestinationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const nextOrgId = clean(req.body?.orgId) || existing.orgId || userId
    const destinationOrgId = existing.orgId || userId
    if (await sendConfigurationPermissionError(res, destinationOrgId, userId)) return

    try {
        const input = { ...req.body, orgId: nextOrgId }
        const preflight = await loadDestinationCrudPreflight(userId, destinationOrgId, req.params.id, 'update', input)
        const { action, destinationCrud: preflightCrud } = preflight
        if (!preflightCrud.canApply) {
            return res.status(400).send({
                error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be updated.',
                destinationCrud: preflightCrud,
            })
        }

        const destination = await updateDwmWebhookDestination(userId, req.params.id, { ...req.body, orgId: destinationOrgId })
        if (!destination) {
            return res.status(404).send({ error: 'Webhook destination not found.' })
        }
        const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        const destinations = preflight.destinations.map(item => item.id === destination.id ? destination : item)
        return res.send(buildDwmWebhookDestinationChangeResponse({
            action,
            ownerId: userId,
            input,
            destination,
            destinations,
            deliveries,
            auditEvents,
        }))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid webhook destination.' })
    }
}

export async function deleteDwmWebhookDestination(req: FastifyRequest<{ Params: IdParams }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    if (await sendConfigurationPermissionError(res, existing.orgId, userId)) return

    const input = { orgId: existing.orgId }
    const preflight = await loadDestinationCrudPreflight(userId, existing.orgId, req.params.id, 'delete', input)
    const { destinationCrud: preflightCrud } = preflight
    if (!preflightCrud.canApply) {
        return res.status(400).send({
            error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be deleted.',
            destinationCrud: preflightCrud,
        })
    }

    const destination = await archiveDwmWebhookDestination(userId, req.params.id)
    if (!destination) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }
    const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
    const destinations = [destination, ...preflight.destinations.filter(item => item.id !== destination.id)]
    return res.send(buildDwmWebhookDestinationChangeResponse({
        action: 'delete',
        ownerId: userId,
        input: { orgId: destination.orgId },
        destination,
        destinations,
        deliveries,
        auditEvents,
    }))
}
