import { escapeHtml } from '#utils/auth/securityMail.ts'

export function sudoPasswordRevealMail(input: {
    vmName: string
    actorId: string
    actorName: string
    viewedAt: string
    ip: string | null
    city: string | null
    region: string | null
    country: string | null
}) {
    const details = [
        ['VM', input.vmName],
        ['User', `${input.actorName} (@${input.actorId})`],
        ['Time', input.viewedAt],
        ['IP address', input.ip || 'Unavailable'],
        ['City', input.city || 'Unavailable'],
        ['Region', input.region || 'Unavailable'],
        ['Country', input.country || 'Unavailable'],
    ] as const
    const rows = details.map(([label, value]) => `${label}: ${value}`).join('\n')
    const htmlRows = details.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')
    const approximate = 'Location is approximate and may be unavailable for private or unrecognized IP addresses.'

    return {
        subject: `Sudo password viewed for VM ${input.vmName}`,
        textBody: `The sudo password for VM ${input.vmName} was requested for display.\n\n${rows}\n\n${approximate}\nIf this was not you, change your Hanasand account password and review your VM access.`,
        htmlBody: `<h1>VM sudo password viewed</h1><p>The sudo password for VM ${escapeHtml(input.vmName)} was requested for display.</p><table>${htmlRows}</table><p>${escapeHtml(approximate)}</p><p>If this was not you, change your Hanasand account password and review your VM access.</p>`,
    }
}
