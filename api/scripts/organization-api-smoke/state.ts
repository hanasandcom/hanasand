export type Row = Record<string, any>

export interface OrganizationSmokeState {
    users: Map<string, Row>
    tokens: Map<string, string>
    organizations: Map<string, Row>
    members: Map<string, Row>
    invites: Map<string, Row>
    watchlists: Map<string, Row>
    rules: Map<string, Row>
    serviceLogs: Row[]
}

export function createOrganizationSmokeState(): OrganizationSmokeState {
    return {
        users: new Map<string, Row>([
            ['org_smoke_owner', { id: 'org_smoke_owner', name: 'Org Smoke Owner', avatar: '', email: 'owner@example.test', active: true }],
            ['org_smoke_admin', { id: 'org_smoke_admin', name: 'Org Smoke Admin', avatar: '', email: 'admin@example.test', active: true }],
            ['org_smoke_member', { id: 'org_smoke_member', name: 'Org Smoke Member', avatar: '', email: 'member@example.test', active: true }],
            ['org_smoke_viewer', { id: 'org_smoke_viewer', name: 'Org Smoke Viewer', avatar: '', email: 'viewer@example.test', active: true }],
            ['org_smoke_expired', { id: 'org_smoke_expired', name: 'Org Smoke Expired', avatar: '', email: 'expired@example.test', active: true }],
            ['org_smoke_deactivated', { id: 'org_smoke_deactivated', name: 'Org Smoke Deactivated', avatar: '', email: 'deactivated@example.test', active: false }],
            ['org_smoke_outsider', { id: 'org_smoke_outsider', name: 'Org Smoke Outsider', avatar: '', email: 'outsider@example.test', active: true }],
        ]),
        tokens: new Map([
            ['owner-token', 'org_smoke_owner'],
            ['admin-token', 'org_smoke_admin'],
            ['member-token', 'org_smoke_member'],
            ['viewer-token', 'org_smoke_viewer'],
            ['expired-token', 'org_smoke_expired'],
            ['deactivated-token', 'org_smoke_deactivated'],
            ['unknown-token', 'org_smoke_unknown'],
            ['outsider-token', 'org_smoke_outsider'],
        ]),
        organizations: new Map(),
        members: new Map(),
        invites: new Map(),
        watchlists: new Map(),
        rules: new Map(),
        serviceLogs: [],
    }
}
