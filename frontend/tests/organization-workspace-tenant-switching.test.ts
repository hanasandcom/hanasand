import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { organizationWorkspaceSource } from './organization-workspace-source.mjs'
import test from 'node:test'
import path from 'node:path'

const root = process.cwd()

test('organization workspace scopes alert workflow by selected tenant and role', async () => {
    const source = organizationWorkspaceSource
    const destinationsRoute = await readFile(path.join(root, 'src/app/api/organizations/[id]/webhooks/route.ts'), 'utf8')
    const deliveriesRoute = await readFile(path.join(root, 'src/app/api/findings/webhooks/deliveries/route.ts'), 'utf8')

    assert.match(source, /const \[selectedId, setSelectedId\] = useState\(requestedOrganizationId\)/)
    assert.match(source, /requestedOrganizationId \|\| selectedId/)
    assert.match(source, /selectOrganization\(organization\.id\)/)
    assert.match(source, /selectedOrganization\?\.id === organization\.id/)
    assert.match(source, /replaceOrganizationWorkspaceSelectionUrl\(organizationId, subject\)/)
    assert.match(source, /replaceOrganizationWorkspaceSelectionUrl\(selectedOrganization\?\.id \|\| selectedId, subject\)/)
    assert.match(source, /url\.searchParams\.set\('org', organizationId\)/)
    assert.match(source, /url\.searchParams\.set\('watchlistId', subject\.id\)/)
    assert.match(source, /url\.searchParams\.set\('destinationId', subject\.id\)/)
    assert.match(source, /url\.searchParams\.set\('inviteId', subject\.id\)/)
    assert.match(source, /url\.searchParams\.set\('memberId', subject\.id\)/)
    assert.match(source, /window\.history\.replaceState\(window\.history\.state, '', cleanWorkspaceUrl\(url\.toString\(\)\)\)/)

    assert.match(source, /\['owner', 'admin'\]\.includes\(selectedOrganization\?\.role\?\.toLowerCase\(\) \|\| ''\)/)
    assert.match(source, /disabled=\{!canManage \|\| !draft\.value\.trim\(\) \|\| draftDuplicate \|\| Boolean\(busy\)\}/)
    assert.match(source, /disabled=\{!canManage \|\| Boolean\(busy\)\}/)
    assert.match(source, /const canMutateMember = canManage && memberCanMutate\(member\)/)
    assert.match(source, /disabled=\{!canMutateMember \|\| Boolean\(busy\)\}/)
    assert.match(source, /return member\.role\.toLowerCase\(\) !== 'owner' && status !== 'removed' && status !== 'revoked' && status !== 'inactive'/)
    assert.match(source, /members=\{bundle\.members\}/)
    assert.match(source, /function inviteEmailConflicts\(emails: string\[\], invites: OrganizationInvite\[\], members: OrganizationMember\[\]\)/)
    assert.match(source, /email\?: string/)
    assert.match(source, /member\.email\?\.toLowerCase\(\)/)
    assert.match(source, /member\.name \|\| member\.email \|\| member\.userId/)
    assert.match(source, /!\['revoked', 'expired'\]\.includes\(invite\.status\.toLowerCase\(\)\)/)
    assert.match(source, /!\['removed', 'revoked', 'inactive'\]\.includes\(member\.status\.toLowerCase\(\)\)/)
    assert.match(source, /disabled=\{!canSendInvite\}/)
    assert.match(source, /watchlistMutationMessage\(payload\.dwmAlertBridge/)
    assert.match(source, /generated/)
    assert.match(source, /No matching captures found/)

    for (const scopedRoute of [
        '${base}/settings',
        '${base}/members',
        '${base}/invites',
        '${base}/watchlists',
        '${base}/watchlists/alert-terms',
        '${base}/alert-case-visibility',
        '/api/findings/alerts?organizationId=${encodeURIComponent(organizationId)}',
        '/api/cases?organizationId=${encodeURIComponent(organizationId)}',
        '${base}/webhooks',
        '/api/findings/webhooks/deliveries?organizationId=${encodeURIComponent(organizationId)}',
    ]) {
        assert.ok(source.includes(scopedRoute), `Expected organization workspace to load ${scopedRoute}`)
    }

    assert.match(destinationsRoute, /\/dwm\/webhook-destinations\?orgId=\$\{encodeURIComponent\(id\)\}/)
    assert.doesNotMatch(destinationsRoute, /webhook-destinations\?organizationId=/)
    assert.match(deliveriesRoute, /if \(organizationId\) \{[\s\S]*searchParams\.set\('orgId', organizationId\)[\s\S]*proxyOrganizationApiRequest\(new NextRequest\(scopedUrl, \{ headers: request\.headers \}\), '\/dwm\/webhook-deliveries'/)
    assert.match(deliveriesRoute, /proxyTiRequest\(request, '\/v1\/dwm\/webhooks\/deliveries'/)
})
