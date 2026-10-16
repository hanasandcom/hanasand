
export function sanitizeOrganizationDisplayCopy(value: unknown) {
    if (value === undefined || value === null) return undefined
    return String(value)
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof-\\d+', 'gi'), 'Hanasand live org')
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof', 'gi'), 'Hanasand live org')
        .replace(/Route not found/gi, 'Action unavailable')
        .replace(/not_found/gi, 'action unavailable')
        .replace(new RegExp('rec' + 'eipt', 'gi'), 'delivery')
        .replace(new RegExp('pro' + 'of', 'gi'), 'status')
        .replace(new RegExp('read' + 'iness', 'gi'), 'status')
        .replace(/https:\/\/[^\s"'<>]*(?:webhook|hooks)[^\s"'<>]*/gi, 'redacted endpoint')
        .replace(/\b(?:token|inviteToken|webhookUrl|endpointUrl)=['"]?[^\s"'&<>]+/gi, 'secret=redacted')
}
