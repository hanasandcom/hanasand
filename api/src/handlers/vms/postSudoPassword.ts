import bcrypt from 'bcrypt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { queryOnce } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { sessionNetwork } from '#utils/auth/sessionNetwork.ts'
import { addressForUser } from '#utils/mail/helpers.ts'
import { sendSystemMail } from '#utils/mail/system.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { hostJson } from '#utils/vms/hostTransport.ts'
import { sudoPasswordRevealMail } from '#utils/vms/sudoPasswordMail.ts'

type VmRow = {
    name: string
    owner: string
    organization_id: string | null
    deleted_at: string | null
    primary_host: string
}

type HostPassword = { password?: unknown }

export default async function postVmSudoPassword(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store, private').header('Pragma', 'no-cache')
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) return res.status(401).send({ error: 'Unauthorized.' })
    if (auth.impersonating || !auth.authenticatedId || auth.authenticatedId !== auth.id) {
        return res.status(403).send({ error: 'Sign in as the VM owner to view its sudo password.' })
    }

    const currentPassword = (req.body as { currentPassword?: unknown } | undefined)?.currentPassword
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024) {
        return res.status(400).send({ error: 'Enter your Hanasand account password to continue.' })
    }

    const user = (await queryOnce('SELECT password, name FROM users WHERE id = $1 AND active IS TRUE', [auth.id])).rows[0] as { password?: string, name?: string } | undefined
    if (!user?.password || !await bcrypt.compare(currentPassword, user.password)) {
        return res.status(403).send({ error: 'Reauthentication failed.' })
    }
    const reauthenticatedAt = new Date().toISOString()

    const { id: vmName } = req.params as { id: string }
    if (!vmName || vmName.length > 100) return res.status(400).send({ error: 'VM name is invalid.' })

    const vm = (await run(`
        SELECT name, owner, organization_id, deleted_at, primary_host
        FROM vms
        WHERE LOWER(name) = LOWER($1)
        LIMIT 1
    `, [vmName])).rows[0] as VmRow | undefined
    if (!vm) return res.status(404).send({ error: 'VM not found.' })
    if (vm.deleted_at) return res.status(409).send({ error: 'Restore this VM before viewing its sudo password.' })
    if (!await isCredentialOwner(vm, auth.id, await isPlatformAdmin(req))) return res.status(404).send({ error: 'VM not found.' })

    let password: string
    try {
        const result = await hostJson<HostPassword>(vm.primary_host, vm.name, '/sudo-password', {})
        if (typeof result.password !== 'string' || !validVmPassword(result.password)) {
            req.log.warn({ vmName: vm.name, host: vm.primary_host }, 'VM host returned no usable sudo credential.')
            return res.status(503).send({ code: 'SUDO_PASSWORD_UNAVAILABLE', error: 'Unavailable. Contact Support if the problem persists.' })
        }
        password = result.password
    } catch (error) {
        const statusCode = error && typeof error === 'object' && 'statusCode' in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : undefined
        req.log.warn({ vmName: vm.name, host: vm.primary_host, hostStatusCode: Number.isInteger(statusCode) ? statusCode : undefined }, 'VM host could not provide a sudo credential.')
        return res.status(503).send({ code: 'SUDO_PASSWORD_UNAVAILABLE', error: 'Unavailable. Contact Support if the problem persists.' })
    }

    const viewedAt = new Date().toISOString()
    const network = await sessionNetwork(req.ip)
    const location = network.network
    try {
        await recordSystemEvent(req, {
            actionType: 'vm.sudo_password.viewed',
            actorId: auth.id,
            source: 'vm',
            targetType: 'vm',
            targetId: vm.name,
            context: {
                schemaVersion: 'vm.sudo_password.view.v1',
                viewedAt,
                reauthenticatedAt,
                ip: network.ip,
                privateIp: network.private_ip || null,
                location: {
                    precision: 'approximate',
                    status: location ? 'resolved' : 'unavailable',
                    provider: location?.provider || null,
                    city: location?.city || null,
                    region: location?.region || null,
                    country: location?.country || null,
                    countryCode: location?.country_code || null,
                },
            },
        })
    } catch {
        return res.status(503).send({ error: 'The password cannot be shown until the access audit is available.' })
    }

    try {
        const email = await userNotificationAddress(vm.owner)
        await sendSystemMail({
            to: email,
            ...sudoPasswordRevealMail({
                vmName: vm.name,
                actorId: auth.id,
                actorName: user.name || auth.id,
                viewedAt,
                ip: network.ip || network.private_ip || null,
                city: location?.city || null,
                region: location?.region || null,
                country: location?.country || null,
            }),
        })
    } catch {
        return res.status(503).send({ error: 'The password cannot be shown until the security email can be sent.' })
    }

    return res.send({ password })
}

async function isCredentialOwner(vm: VmRow, userId: string, platformAdmin: boolean) {
    if (platformAdmin) return true
    if (!vm.organization_id) return vm.owner === userId
    const result = await run(`
        SELECT 1
        FROM organization_members membership
        JOIN organizations organization ON organization.id = membership.organization_id
        WHERE membership.organization_id = $1
          AND membership.user_id = $2
          AND membership.status = 'active'
          AND membership.role IN ('owner', 'admin')
          AND organization.status = 'active'
        LIMIT 1
    `, [vm.organization_id, userId])
    return result.rows.length > 0
}

async function isPlatformAdmin(req: FastifyRequest) {
    return (await hasHanasandInternalRouteAccess(req)).valid
}

async function userNotificationAddress(userId: string) {
    const result = await queryOnce(`
        SELECT COALESCE(NULLIF(user_account.email, ''), NULLIF(mail.recovery_email, ''), NULLIF(mail.mail_address, '')) AS email
        FROM users user_account
        LEFT JOIN mail_accounts mail ON mail.user_id = user_account.id
        WHERE user_account.id = $1
        LIMIT 1
    `, [userId])
    return String(result.rows[0]?.email || addressForUser(userId))
}

function validVmPassword(value: string) {
    return value.length >= 8 && value.length <= 128 && !/[\s\p{Cc}]/u.test(value)
}
