import type { FastifyReply, FastifyRequest } from 'fastify'
import { vmViewer } from '#utils/vms/access.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { missingInstanceMessage, restoreVm, scheduleVmDeletion } from '#utils/vms/deletion.ts'
import { sessionNetwork } from '#utils/auth/sessionNetwork.ts'
import { sendSystemMail } from '#utils/mail/system.ts'
import { vmDeletionNotificationRecipients, vmDeletionScheduledMail } from '#utils/vms/deletionMail.ts'

export default async function deleteVM(req: FastifyRequest, res: FastifyReply) { return changeDeletion(req, res, false) }
export async function restoreVM(req: FastifyRequest, res: FastifyReply) { return changeDeletion(req, res, true) }

async function changeDeletion(req: FastifyRequest, res: FastifyReply, restore: boolean) {
    const viewer = await vmViewer(req, res)
    if (!viewer) return
    if (!viewer.admin) return res.status(403).send({ error: 'Only an administrator can delete or restore VMs.' })
    const { id } = req.params as { id: string }
    if (!id) return res.status(400).send({ error: 'Missing VM name.' })
    try {
        const result = restore ? await restoreVm(id) : await scheduleVmDeletion(id, (req.body as { confirmation?: string } | undefined)?.confirmation)
        const { deletion_notification_pending: notifyResponsibleUsers, ...vm } = result
        await recordSystemEvent(req, { actionType: restore ? 'vm.restored' : 'vm.deletion_scheduled', actorId: viewer.id, targetType: 'vm', targetId: id, context: { deleteAfter: vm.delete_after } })
        let notificationWarning: string | undefined
        if (!restore && notifyResponsibleUsers) {
            try {
                const recipients = await vmDeletionNotificationRecipients(vm.owner, vm.organization_id)
                if (!recipients.length) throw new Error('No active VM owner or organization administrator has an email address.')
                const network = await sessionNetwork(req.ip)
                const location = network.network
                const message = vmDeletionScheduledMail({
                    vmName: vm.name,
                    actorId: viewer.id,
                    scheduledAt: new Date(vm.deleted_at).toISOString(),
                    deleteAfter: new Date(vm.delete_after).toISOString(),
                    ip: network.ip || network.private_ip || null,
                    city: location?.city || null,
                    region: location?.region || null,
                    country: location?.country || null,
                })
                const deliveries = await Promise.allSettled(recipients.map(recipient => sendSystemMail({ to: recipient.email, ...message })))
                const failedCount = deliveries.filter(delivery => delivery.status === 'rejected').length
                if (failedCount) throw new Error(`Email delivery failed for ${failedCount} of ${recipients.length} VM deletion recipients.`)
            } catch (error) {
                notificationWarning = ' The responsible user or organization administrators could not be emailed.'
                req.log.error({ err: error, id }, 'Unable to send VM deletion notification.')
            }
        }
        const message = restore
            ? 'VM restored.'
            : vm.deletion_restore?.instanceMissing
                ? `${missingInstanceMessage} Its record is retained for 30 days.`
                : 'VM stopped. You can restore it for 30 days.'
        return res.send({ message: `${message}${notificationWarning || ''}`, vm })
    } catch (error) {
        req.log.error({ err: error, id }, 'Unable to change VM deletion state.')
        const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 503
        return res.status(status).send({ error: error instanceof Error ? error.message : 'Unable to update the VM. Try again.' })
    }
}
