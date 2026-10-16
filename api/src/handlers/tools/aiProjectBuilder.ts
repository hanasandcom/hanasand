import { createHash } from 'node:crypto'

type GeneratedFile = {
    path: string
    content: string
}

type GeneratedProject = {
    label: string
    files: GeneratedFile[]
}

export type GeneratedBuilderResponse = {
    status: 'completed'
    provider: 'hanasand-ai'
    model: 'share-builder'
    message: string
    cache?: {
        hit: boolean
        key: string
        category: 'scaffold' | 'diagnostic' | 'package_metadata' | 'deployment_fix'
    }
}
type CommonCacheCategory = NonNullable<GeneratedBuilderResponse['cache']>['category']
const commonResponseCache = new Map<string, {
    response: GeneratedBuilderResponse
    updatedAt: number
}>()
const MAX_COMMON_RESPONSE_CACHE_ITEMS = 80

export function buildShareProjectResponse(prompt: string): GeneratedBuilderResponse | null {
    if (!/\b(build|create|make|generate|scaffold|website|site|app|bot|api|backend|worker|queue|dashboard|portal|tool|starter|page|fix|repair|rebuild|self-hostable|runnable project)\b/i.test(prompt)) {
        return null
    }

    const cacheKey = commonBuilderCacheKey(prompt)
    const cached = commonResponseCache.get(cacheKey)
    if (cached) {
        cached.updatedAt = Date.now()
        return {
            ...cached.response,
            cache: {
                key: cached.response.cache?.key || cacheKey,
                category: cached.response.cache?.category || cacheCategoryForPrompt(prompt),
                hit: true,
            },
        }
    }

    const project = chooseProject(prompt)
    const response: GeneratedBuilderResponse = {
        status: 'completed',
        provider: 'hanasand-ai',
        model: 'share-builder',
        message: [
            `Prepared a runnable ${project.label} with the files needed to start it.`,
            toolTag('.gitignore', 'node_modules/\n.next/\ndist/\n.env\n.env.*\n!.env.example\n'),
            toolTag('.dockerignore', 'node_modules\n.next\ndist\n.git\n.env\n.env.*\n!.env.example\n'),
            ...project.files.map((file) => toolTag(file.path, file.content)),
        ].join('\n\n'),
        cache: {
            hit: false,
            key: cacheKey,
            category: cacheCategoryForPrompt(prompt),
        },
    }
    rememberCommonResponse(cacheKey, response)
    return response
}

function rememberCommonResponse(key: string, response: GeneratedBuilderResponse) {
    commonResponseCache.set(key, {
        response: {
            ...response,
            ...(response.cache ? { cache: { ...response.cache } } : {}),
        },
        updatedAt: Date.now(),
    })
    if (commonResponseCache.size <= MAX_COMMON_RESPONSE_CACHE_ITEMS) {
        return
    }
    const oldest = [...commonResponseCache.entries()]
        .sort((left, right) => left[1].updatedAt - right[1].updatedAt)[0]?.[0]
    if (oldest) {
        commonResponseCache.delete(oldest)
    }
}

function commonBuilderCacheKey(prompt: string) {
    const promptHash = createHash('sha256').update(prompt).digest('hex')
    return `${cacheCategoryForPrompt(prompt)}:${promptHash}`
}

function cacheCategoryForPrompt(prompt: string): CommonCacheCategory {
    const lower = prompt.toLowerCase()
    if (/\b(package|dependency|dependencies|npm|bun|pnpm|version|metadata)\b/.test(lower)) {
        return 'package_metadata'
    }
    if (/\b(deploy|deployment|vercel|netlify|docker|compose|ssl|domain|env|build failed|runtime)\b/.test(lower)) {
        return 'deployment_fix'
    }
    if (/\b(diagnostic|debug|why failed|error|logs|fix|repair)\b/.test(lower)) {
        return 'diagnostic'
    }
    return 'scaffold'
}

function chooseProject(prompt: string): GeneratedProject {
    const lower = prompt.toLowerCase()
    const title = titleFromPrompt(prompt)
    const slug = slugify(title)

    if (/\b(discord|bot|slack|telegram|server status bot|game server)\b/.test(lower)) {
        return botFiles(title, slug, lower.includes('discord') ? 'Discord' : 'Chat')
    }

    if (/\b(gallery|image review|photo|photographer)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(worker|queue|background|redis|job|transcode)\b/.test(lower) && !/\bwebsite|web site|page|frontend|landing\b/.test(lower)) {
        return workerFiles(title, slug, lower)
    }

    if (/\b(api|backend|fastify)\b/.test(lower) && !/\bpage|website|web site|site|frontend|landing|concept\b/.test(lower)) {
        return apiFiles(title, slug, lower)
    }

    if (/\b(page|website|web site|site|frontend|landing|concept)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(next\.?js|dockerized next|portable next|listing dashboard|knowledge base|portfolio|bakery|donor dashboard|investor update|artist shop|restaurant site)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(api|backend|fastify|server|audit log|health|readiness|webhook|ledger|rate limit|idempoten|intake)\b/.test(lower) && !/\bwebsite|site|page|frontend|landing\b/.test(lower)) {
        return apiFiles(title, slug, lower)
    }

    return websiteFiles(title, slug, sectionsForPage(lower), lower)
}

function titleFromPrompt(prompt: string) {
    const quoted = /["']([^"']{3,80})["']/.exec(prompt)?.[1]
    if (quoted) {
        return quoted
    }

    const cleaned = prompt
        .replace(/\b(build|create|make|generate|scaffold|tiny|polished|runnable|dockerized|starter|for the current \/s project|critic|angry|demanding|user says|client says|please|fix|repair|rebuild)\b/gi, ' ')
        .replace(/\b(website|site|app|bot|api|dashboard|portal|tool|page|project|flow|service)\b/gi, ' ')
        .replace(/[^a-zA-Z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 5)
        .join(' ')

    return toTitleCase(cleaned || 'Hanasand Project')
}

function containsAny(value: string, phrases: string[]) {
    return phrases.some(phrase => value.includes(phrase))
}

const residentServiceSections = ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
const mobileResidentServiceSections = [...residentServiceSections, 'Mobile release', 'Offline state']
const customerServiceSections = ['Service categories', 'Response metrics', 'Cost tiers', 'Customer quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
const localServiceSections = ['Service categories', 'Response metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment']
const imageReviewSections = ['Review queue', 'Keep', 'Reject later', 'Collections', 'Export summary', 'Deferred deletion confirmation']

type SectionRule = readonly [(lower: string) => boolean, readonly string[]]

// Keep rules in priority order; sectionsForPage uses the first match.
const sectionRules: readonly SectionRule[] = [
    [lower => (lower.includes('municipal permit') || lower.includes('permit rage') || lower.includes('residents angry')), ['Permit categories', 'Service metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']],
    [lower => (lower.includes('municipal service portal') || lower.includes('civicsignal') || lower.includes('snow closure')), [...residentServiceSections]],
    [lower => (containsAny(lower, ['lost baggage', 'airport lost', 'warranty claim', 'claim triage'])), [...customerServiceSections]],
    [lower => (lower.includes('emergency shelter') || lower.includes('shelter directory')), [...residentServiceSections]],
    [lower => (containsAny(lower, ['food pantry', 'pantry site', 'food bank', 'disaster supply', 'supply pickup'])), [...mobileResidentServiceSections]],
    [lower => (lower.includes('refugee services') || lower.includes('services navigator') || lower.includes('public defender') || lower.includes('legal aid')), [...residentServiceSections]],
    [lower => (lower.includes('public records') || lower.includes('records request')), ['Permit categories', 'Service metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']],
    [lower => (lower.includes('pharmacy recall') || (lower.includes('healthcare clinic') && lower.includes('recall'))), ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Privacy rules', 'Recall checklist']],
    [lower => (lower.includes('clinic landing') || lower.includes('healthcare clinic') || lower.includes('neighborhood clinic')), ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Privacy rules', 'Beginner deployment']],
    [lower => (lower.includes('therapist booking')), ['Service sections', 'Booking metrics', 'Pricing bands', 'Client quotes', 'Launch tasks', 'Privacy rules']],
    [lower => ((lower.includes('restaurant allergy') || lower.includes('allergy booking') || lower.includes('allergen')) && lower.includes('recall')), ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Privacy rules', 'Recall checklist', 'Mobile release', 'Offline state']],
    [lower => (lower.includes('restaurant site') || lower.includes('restaurant allergy') || lower.includes('allergy booking')), ['Menu and allergens', 'Dietary filters', 'Reservations', 'Opening hours', 'Private dining', 'Guest information', 'Location', 'Update notes']],
    [lower => (lower.includes('repair shop') || lower.includes('pet groomer') || lower.includes('local service website')), ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Launch checklist', 'Beginner deployment']],
    [lower => (lower.includes('field service dispatch')), [...localServiceSections]],
    [lower => (containsAny(lower, ['senior transport', 'transport booking', 'tenant move out', 'move out portal'])), [...customerServiceSections]],
    [lower => (containsAny(lower, ['tenant rights', 'rights hotline', 'utility shutoff', 'shutoff assistance', 'victim services'])), [...residentServiceSections]],
    [lower => (lower.includes('rural internet outage')), [...mobileResidentServiceSections]],
    [lower => (lower.includes('rural internet') || lower.includes('internet signup')), ['Service categories', 'Response metrics', 'Cost tiers', 'Customer quotes', 'Application tasks', 'Office hours', 'Plain FAQ', 'Mobile release', 'Offline state']],
    [lower => (containsAny(lower, ['storm cleanup', 'cleanup volunteer', 'storm repair dispatch', 'accessibility repair', 'emergency accessibility'])), [...mobileResidentServiceSections]],
    [lower => (containsAny(lower, ['local repair dispatch', 'repair dispatch', 'plumbing dispatch', 'locksmith dispatch', 'locksmith booking', 'electrician dispatch'])), [...localServiceSections]],
    [lower => (lower.includes('community tool library')), ['Service categories', 'Lead metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment', 'Office hours', 'Plain FAQ']],
    [lower => (lower.includes('mobile field inspection')), ['Service categories', 'Response metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment', 'Mobile release', 'Offline state']],
    [lower => (lower.includes('trust center') || lower.includes('trustsignal')), ['Control groups', 'Assurance metrics', 'Plan tiers', 'Customer quotes', 'Evidence tasks', 'Deployment notes']],
    [lower => (lower.includes('donor campaign') || lower.includes('campaign transparency')), ['Impact metrics', 'Sponsor tiers', 'Collaborator quotes', 'Submission tasks', 'Data lineage', 'Privacy rules']],
    [lower => (lower.includes('artist shop') || lower.includes('artist drop') || lower.includes('releasing prints')), ['Edition details', 'Launch timeline', 'Shipping notes', 'Validation', 'FAQ', 'Purchase CTA', 'Product bundles']],
    [lower => (lower.includes('evidence room') || lower.includes('evidenceroom')), ['Control families', 'Audit metrics', 'Assurance tiers', 'Reviewer quotes', 'Evidence tasks', 'Deployment notes']],
    [lower => (lower.includes('case study') || lower.includes('impact portal') || lower.includes('impactframes')), ['Project sections', 'Outcome metrics', 'Service tiers', 'Client quotes', 'Delivery tasks', 'Deployment notes']],
    [lower => (lower.includes('crisis comms') || lower.includes('crisis campaign')), ['Creative sections', 'Launch metrics', 'Package tiers', 'Stakeholder quotes', 'Task status', 'Incident communication']],
    [lower => (lower.includes('architecture showcase') || lower.includes('architect') || lower.includes('architect portfolio') || lower.includes('formaworks')), ['Project gallery', 'Architecture services', 'Inquiry metrics', 'Service pricing', 'Testimonials', 'Delivery tasks']],
    [lower => (lower.includes('backend boundary') || lower.includes('session states') || lower.includes('revoked access') || lower.includes('second device')), ['Backend contract', 'Session states', 'Permission matrix', 'Session Sync', 'Second device test', 'Revoked access', 'Recovery copy', 'Error recovery', 'Failure owner']],
    [lower => (lower.includes('mobile safari') || lower.includes('offline state') || lower.includes('slow network') || lower.includes('recovery copy')), ['Edge-case matrix', 'Offline state', 'Mobile Safari', 'Slow network', 'Recovery copy', 'Verification']],
    [lower => (lower.includes('restaurant catering') || (lower.includes('restaurant') && lower.includes('checkout'))), ['Menu and allergens', 'Dietary filters', 'Reservations', 'Private dining', 'Guest information', 'Location', 'Product bundles', 'Checkout CTA']],
    [lower => (lower.includes('restaurant')), ['Menu and allergens', 'Dietary filters', 'Reservations', 'Opening hours', 'Private dining', 'Guest information', 'Location', 'Redirect checklist']],
    [lower => (lower.includes('creator membership') && /\b(ecommerce|checkout)\b/.test(lower)), ['Plans', 'Checkout states', 'Member benefits', 'Revenue metrics', 'Pricing levels', 'Subscriber quotes', 'Product bundles', 'Checkout CTA', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review']],
    [lower => (/\b(ecommerce|store|merch)\b/.test(lower) && (lower.includes('failed payment') || lower.includes('cancellation') || lower.includes('invoice'))), ['Plans', 'Checkout states', 'Product bundles', 'Checkout CTA', 'Shipping notes', 'Customer reviews', 'Return policy', 'FAQ', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review', 'Escalation paths', 'SLA states', 'Customer messaging', 'Runbook', 'Failure owner']],
    [lower => (lower.includes('failed payment') || lower.includes('failed payments') || lower.includes('checkout failure')), ['Plans', 'Checkout states', 'Product bundles', 'Checkout CTA', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review', 'Support routing', 'Escalation paths', 'SLA states', 'Customer messaging', 'Runbook', 'Failure owner']],
    [lower => (/\b(ecommerce|store|product bundles|checkout buttons)\b/.test(lower)), ['Product bundles', 'Checkout CTA', 'Shipping notes', 'Customer reviews', 'Return policy', 'FAQ']],
    [lower => (lower.includes('local seo') || lower.includes('seo redirect') || lower.includes('redirect recovery')), ['Search validation', 'Redirect checklist', 'Migration plan', 'QA plan', 'Browser verification', 'Exit plan']],
    [lower => (lower.includes('tiny agency') || lower.includes('brand, webflow cleanup') || lower.includes('agency site')), ['Validation', 'Services', 'Selected work', 'Pricing cues', 'Testimonials', 'Contact CTA']],
    [lower => (lower.includes('board-ready') || lower.includes('initiatives, blockers') || lower.includes('ceo wants a board')), ['Initiatives', 'Blockers', 'Decisions', 'Owner asks', 'Timeline', 'Status metrics']],
    [lower => (lower.includes('artist drop') || lower.includes('releasing prints') || lower.includes('editions, dates')), ['Edition details', 'Launch timeline', 'Shipping notes', 'Validation', 'FAQ', 'Purchase CTA']],
    [lower => (lower.includes('permit page') || lower.includes('residents keep calling')), ['Permit types', 'Timeline', 'Fee checklist', 'Documents', 'Office hours', 'Plain FAQ']],
    [lower => (lower.includes('chores') || lower.includes('allowance')), ['Chores', 'Assignments', 'Allowance progress', 'Reminders', 'Empty states', 'Beginner setup']],
    [lower => (lower.includes('policy docs') || lower.includes('policy portal')), ['Policy categories', 'Recent changes', 'Owners', 'Acknowledgement cues', 'Ask questions', 'Search structure']],
    [lower => (lower.includes('ugly sheet') || lower.includes('simple crm screen') || lower.includes('hate crms')), ['Leads', 'Next follow-up', 'Deal stages', 'Notes', 'Metrics', 'Import export cues']],
    [lower => (lower.includes('design qa') || lower.includes('designqasignal') || lower.includes('review sections')), ['Review sections', 'Defect metrics', 'Service tiers', 'Stakeholder quotes', 'Delivery tasks', 'Deployment notes']],
    [lower => (lower.includes('cleaning service') || lower.includes('cleanlocal') || lower.includes('pricing packages')), ['Service sections', 'Response metrics', 'Pricing packages', 'Customer quotes', 'Launch tasks', 'Beginner deployment']],
    [lower => lower.includes('returns'), ['Return sections', 'Resolution metrics', 'Policy tiers', 'Customer quotes', 'Processing tasks', 'Deployment notes']],
    [lower => (lower.includes('museum exhibit') || lower.includes('exhibitsignal') || lower.includes('exhibit sections')), ['Exhibit sections', 'Visitor metrics', 'Ticket tiers', 'Curator quotes', 'Accessibility tasks', 'Deployment notes']],
    [lower => (lower.includes('security incident portal') || lower.includes('incidentsignal')), ['Incident sections', 'Response metrics', 'Severity tiers', 'Stakeholder quotes', 'Action tasks', 'Deployment notes']],
    [lower => (lower.includes('agency client health') || lower.includes('clienthealthsignal') || lower.includes('client sections')), ['Client sections', 'Health metrics', 'Retainer tiers', 'Client quotes', 'Action tasks', 'Deployment notes']],
    [lower => (lower.includes('csa membership') || lower.includes('harvestsignal') || lower.includes('share sections')), ['Share sections', 'Harvest metrics', 'Membership tiers', 'Member quotes', 'Pickup tasks', 'Beginner deployment']],
    [lower => (lower.includes('executive decision log') || lower.includes('decisionsignal')), ['Decision sections', 'Follow-up metrics', 'Governance tiers', 'Stakeholder quotes', 'Action tasks', 'Deployment notes']],
    [lower => (lower.includes('brand campaign control') || lower.includes('campaignsignal')), ['Asset sections', 'Launch metrics', 'Package tiers', 'Stakeholder quotes', 'Owner tasks', 'Deployment notes']],
    [lower => (lower.includes('image review') || lower.includes('review queue')), [...imageReviewSections]],
    [lower => (lower.includes('photography booking') || lower.includes('framelocal') || lower.includes('photographer')), ['Service sections', 'Booking metrics', 'Pricing bands', 'Client quotes', 'Launch tasks', 'Beginner deployment']],
    [lower => (lower.includes('construction bid portal') || lower.includes('bidnorth') || lower.includes('trade sections')), ['Trade sections', 'Bid metrics', 'Package tiers', 'Contractor quotes', 'Submission tasks', 'Deployment notes']],
    [lower => (lower.includes('legal matter dashboard') || lower.includes('mattersignal') || lower.includes('matter sections')), ['Matter sections', 'Deadline metrics', 'Retainer tiers', 'Client quotes', 'Review tasks', 'Deployment notes']],
    [lower => (lower.includes('climate grant portal') || lower.includes('grantsignal') || lower.includes('funding sections')), ['Funding sections', 'Impact metrics', 'Sponsor tiers', 'Applicant quotes', 'Submission tasks', 'Deployment notes']],
    [lower => (lower.includes('logistics yard board') || lower.includes('yardsignal') || lower.includes('dock sections')), ['Dock sections', 'Throughput metrics', 'Escalation tiers', 'Dispatcher quotes', 'Action tasks', 'Deployment notes']],
    [lower => (lower.includes('product research repository') || lower.includes('insightsignal') || lower.includes('study sections')), ['Study sections', 'Evidence metrics', 'Access tiers', 'Researcher quotes', 'Synthesis tasks', 'Deployment notes']],
    [lower => (lower.includes('investor data room') || lower.includes('dataroomsignal') || lower.includes('document sections')), ['Document sections', 'KPI metrics', 'Access tiers', 'Investor quotes', 'Diligence tasks', 'Deployment notes']],
    [lower => (lower.includes('hospital staffing') || lower.includes('shiftsignal') || lower.includes('staffing board')), ['Unit sections', 'Coverage metrics', 'Escalation tiers', 'Coordinator quotes', 'Staffing tasks', 'Deployment notes']],
    [lower => (lower.includes('data quality dashboard') || lower.includes('freshnessboard') || lower.includes('pipeline sections')), ['Pipeline sections', 'Freshness metrics', 'Support tiers', 'Stakeholder quotes', 'Incident tasks', 'Deployment notes']],
    [lower => (lower.includes('multi-region') || lower.includes('service health') || lower.includes('subscriber notice') || lower.includes('slo evidence')), ['Service health', 'Incident timeline', 'Subscriber notice', 'SLO evidence', 'Postmortems', 'Failure owner']],
    [lower => (((lower.includes('support') && !lower.includes('support bundle')) || lower.includes('escalation') || lower.includes('sla')) && !lower.includes('knowledge') && !lower.includes('docs') && !lower.includes('documentation') && !lower.includes('gdpr') && !lower.includes('privacy')), ['Escalation paths', 'SLA states', 'Customer messaging', 'Failure owner', 'Runbook', 'Audit trail']],
    [lower => (lower.includes('payment') || lower.includes('checkout') || lower.includes('subscription') || lower.includes('invoice')), ['Plans', 'Checkout states', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review']],
    [lower => (lower.includes('accessibility-first') || lower.includes('accessibility lawsuit') || lower.includes('a11y') || lower.includes('wcag') || lower.includes('skip links') || lower.includes('keyboard flow') || lower.includes('reduced motion')), ['Skip links', 'Keyboard flow', 'Contrast', 'Forms', 'Reduced motion', 'Accessible controls']],
    [lower => (lower.includes('analytics consent') || lower.includes('analytics delivery') || lower.includes('consent/data paths')), ['Validation', 'Pricing', 'FAQ', 'Lead capture', 'Privacy and data paths documented', 'Analytics notes']],
    [lower => (lower.includes('gdpr') || lower.includes('privacy') || lower.includes('data retention') || lower.includes('data request') || lower.includes('personal data')), ['Data map', 'Consent flow', 'Retention rules', 'Export request', 'Delete request', 'Audit trail']],
    [lower => (lower.includes('governance') || lower.includes('audit trail') || lower.includes('compliance') || lower.includes('security review') || lower.includes('pii handling') || lower.includes('legal reviewer')), ['Governance gates', 'Audit trail', 'Security review', 'PII handling', 'Deployment checks', 'Failure owner']],
    [lower => (lower.includes('disaster restore') || lower.includes('restore runbook')), ['Environment map', 'DNS checklist', 'SSL checklist', 'Rollback plan', 'Verification', 'Failure owner', 'Source export']],
    [lower => (lower.includes('seo') || lower.includes('redirect')), ['Search validation', 'Pricing', 'FAQ', 'Redirect checklist', 'Lead capture', 'Launch notes']],
    [lower => (lower.includes('cutover') || lower.includes('parallel run') || (lower.includes('migration') && !lower.includes('restaurant'))), ['Source export', 'Clean schema', 'Parallel run', 'Cutover plan', 'Rollback plan', 'Verification']],
    [lower => (lower.includes('calendar') || lower.includes('shared state') || lower.includes('reminders')), ['Shared state', 'Permission matrix', 'Exports', 'Reminders', 'Mobile behavior', 'Backend notes']],
    [lower => (lower.includes('restaurant')), ['Menu and allergens', 'Dietary filters', 'Reservations', 'Opening hours', 'Private dining', 'Guest information', 'Location', 'Update notes']],
    [lower => (lower.includes('docs') || lower.includes('documentation') || lower.includes('knowledge')), ['Quickstart', 'Categories', 'Guides', 'Status callouts', 'Escalation paths', 'Support']],
    [lower => (lower.includes('event') || lower.includes('conference')), ['Schedule', 'Speakers', 'Tracks', 'Sponsors', 'Tickets', 'Venue']],
    [lower => (lower.includes('gallery') || lower.includes('image')), [...imageReviewSections]],
    [lower => (lower.includes('status page') || lower.includes('incident') || lower.includes('observability')), ['Service health', 'Incident timeline', 'Subscriber notice', 'SLO evidence', 'Postmortems', 'Failure owner']],
    [lower => (lower.includes('course') || lower.includes('learning outcomes')), ['Learning outcomes', 'Course modules', 'Pricing', 'Testimonials', 'Launch tasks', 'Beginner deployment']],
    [lower => (lower.includes('data room') || lower.includes('diligence')), ['Diligence metrics', 'Document controls', 'Pricing impact', 'Review tasks', 'Testimonials', 'Deployment notes']],
    [lower => (lower.includes('design delivery') || lower.includes('scope/pricing')), ['Asset inventory', 'Launch metrics', 'Scope and pricing', 'Testimonials', 'Delivery tasks', 'Deployment notes']],
    [lower => (lower.includes('asset approval') || lower.includes('creative asset') || lower.includes('proofdeck')), ['Asset sections', 'Approval metrics', 'Package tiers', 'Stakeholder quotes', 'Review tasks', 'Deployment notes']],
    [lower => (lower.includes('service directory') || lower.includes('locallist') || lower.includes('local service')), ['Service categories', 'Lead metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment']],
    [lower => (lower.includes('permit') || lower.includes('municipal permit')), ['Permit categories', 'Service metrics', 'Pricing impact', 'Citizen quotes', 'Application tasks', 'Deployment notes']],
    [lower => (lower.includes('creator membership') || lower.includes('memberforge')), ['Member benefits', 'Revenue metrics', 'Pricing levels', 'Subscriber quotes', 'Launch tasks', 'Beginner deployment']],
    [lower => (lower.includes('grant') || lower.includes('funding themes')), ['Funding themes', 'Impact metrics', 'Sponsor tiers', 'Collaborator quotes', 'Submission tasks', 'Deployment notes']],
    [lower => (lower.includes('campaign microsite') || lower.includes('launchcanvas') || lower.includes('creative sections')), ['Creative sections', 'Launch metrics', 'Package tiers', 'Stakeholder quotes', 'Task status', 'Deployment notes']],
    [lower => (lower.includes('vendor onboarding portal') || lower.includes('vendorgate')), ['Risk categories', 'Review metrics', 'Package tiers', 'Buyer quotes', 'Review tasks', 'Controlled deployment']],
    [lower => (lower.includes('case study portal') || lower.includes('impactframes')), ['Project sections', 'Outcome metrics', 'Service tiers', 'Client quotes', 'Delivery tasks', 'Deployment notes']],
    [lower => (lower.includes('municipal service portal') || lower.includes('civicsignal')), ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Deployment notes']],
    [lower => (lower.includes('creator launch hub') || lower.includes('launchhearth') || lower.includes('offer sections')), ['Offer sections', 'Revenue metrics', 'Pricing levels', 'Audience quotes', 'Launch tasks', 'Beginner deployment']],
    [lower => (lower.includes('research review') || lower.includes('reviewsignal') || lower.includes('research themes')), ['Research themes', 'Impact metrics', 'Sponsor tiers', 'Reviewer quotes', 'Submission tasks', 'Deployment notes']],
    [lower => (lower.includes('design delivery') || lower.includes('component groups')), ['Component groups', 'Release metrics', 'Service tiers', 'Stakeholder quotes', 'Implementation tasks', 'Deployment notes']],
    [lower => (lower.includes('electrician') || lower.includes('voltlocal') || lower.includes('trades website')), ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Launch checklist', 'Beginner deployment']],
    [lower => (lower.includes('evidence room') || lower.includes('evidenceroom') || lower.includes('control families')), ['Control families', 'Audit metrics', 'Assurance tiers', 'Reviewer quotes', 'Evidence tasks', 'Deployment notes']],
    [lower => (lower.includes('seller console') || lower.includes('sellersignal') || lower.includes('listing sections')), ['Listing sections', 'Payout metrics', 'Pricing plans', 'Seller quotes', 'Onboarding tasks', 'Deployment notes']],
    [lower => (lower.includes('school enrollment portal') || lower.includes('enrollnorth') || lower.includes('program sections')), ['Program sections', 'Application metrics', 'Fee tiers', 'Parent quotes', 'Document tasks', 'Deployment notes']],
    [lower => (lower.includes('data quality dashboard') || lower.includes('freshnessboard') || lower.includes('pipeline sections')), ['Pipeline sections', 'Freshness metrics', 'Support tiers', 'Stakeholder quotes', 'Incident tasks', 'Deployment notes']],
    [lower => (lower.includes('executive board pack') || lower.includes('boardsignal') || lower.includes('decision sections')), ['Decision sections', 'KPI metrics', 'Investment tiers', 'Stakeholder quotes', 'Action tasks', 'Deployment notes']],
    [lower => (/\b(ecommerce|product|store)\b/.test(lower)), ['Product bundles', 'Shipping notes', 'Customer reviews', 'Return policy', 'FAQ', 'Checkout CTA']],
    [lower => (lower.includes('marketing') || lower.includes('landing')), ['Validation', 'Features', 'Pricing', 'Testimonials', 'FAQ', 'Launch CTA']],
    [lower => (lower.includes('governance') || lower.includes('audit trail') || lower.includes('compliance') || lower.includes('security review') || lower.includes('legal') || lower.includes('pii handling')), ['Governance gates', 'Audit trail', 'Security review', 'PII handling', 'Deployment checks', 'Failure owner']],
    [lower => (lower.includes('workflow') || lower.includes('duplicate') || lower.includes('trigger')), ['Trigger inventory', 'Duplicate guard', 'State transitions', 'Side effects', 'Failure owner', 'Rollback path']],
    [lower => (lower.includes('performance') || lower.includes('scale') || lower.includes('database query')), ['Performance budget', 'Query limits', 'Pagination', 'Cache notes', 'Load test plan', 'Failure owner']],
    [lower => ((lower.includes('deployment') || lower.includes('dns') || lower.includes('ssl')) || (lower.includes('rollback') && !lower.includes('backend contract') && !lower.includes('mobile refresh') && !lower.includes('backend boundary'))), ['Export package', 'Environment map', 'DNS checklist', 'SSL checklist', 'Rollback plan', 'Verification']],
    [lower => (lower.includes('privacy') || lower.includes('consent') || lower.includes('tracking') || lower.includes('cookie')), ['Privacy rules', 'Consent states', 'Data minimization', 'Export and delete', 'Tracking audit', 'Failure owner']],
    [lower => (lower.includes('duplicate') || lower.includes('automation') || lower.includes('zap') || lower.includes('workflow loop')), ['Trigger inventory', 'Duplicate guard', 'Idempotency keys', 'Replay review', 'Side effects', 'Failure owner']],
    [lower => (lower.includes('beta') || lower.includes('edge case') || lower.includes('mobile safari') || lower.includes('offline')), ['Edge-case matrix', 'Offline state', 'Mobile Safari', 'Slow network', 'Recovery copy', 'Verification']],
    [lower => (lower.includes('auth') || lower.includes('login') || lower.includes('session') || lower.includes('second device') || lower.includes('mobile refresh') || lower.includes('backend boundary') || lower.includes('backend contract')), ['Backend contract', 'Session states', 'Permission matrix', 'Second device test', 'Revoked access', 'Failure owner']],
    [lower => (lower.includes('portfolio')), ['Selected work', 'Process', 'Packages', 'Testimonials', 'Inquiry']],
    [lower => (lower.includes('dashboard') || lower.includes('finance') || lower.includes('crm') || lower.includes('admin')), ['Metrics', 'Records', 'Follow-ups', 'Risks', 'Next actions']],
    [lower => (/\bservices\b/.test(lower)), ['Services', 'Pricing', 'Process', 'FAQ', 'Contact']],
]

function sectionsForPage(lower: string) {
    const rule = sectionRules.find(([matches]) => matches(lower))
    return rule ? [...rule[1]] : ['Overview', 'Highlights', 'Process', 'Next steps']
}

function websiteFiles(title: string, slug: string, sections: string[], lower: string): GeneratedProject {
    for (const [term, section] of [['dns', 'DNS checklist'], ['ssl', 'SSL checklist']]) {
        if (lower.includes(term) && !sections.includes(section)) sections.push(section)
    }
    const cards = sections.map((section, index) => ({
        id: `section-${index + 1}`,
        title: section,
        description: detailForSection(section),
    }))
    return {
        label: `${productTypeFor(lower)} website`,
        files: [
            ...sharedProjectFiles(title, slug, {
                packageFile: nextPackage(slug),
                environment: ['CONTACT_EMAIL='],
                dockerKind: 'next',
                beforeDocker: [nextConfig()],
            }),
            {
                path: 'src/app/layout.tsx',
                content: `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: ${JSON.stringify(title)}, description: ${JSON.stringify(sections.slice(0, 3).join(', ') + '.')} }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
`,
            },
            {
                path: 'src/app/page.tsx',
                content: `export const dynamic = 'force-dynamic'

const title = ${JSON.stringify(title)}
const sections = ${JSON.stringify(cards, null, 2)}
const email = process.env.CONTACT_EMAIL?.trim()
const contact = email && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) ? 'mailto:' + encodeURIComponent(email) : null

export default function Page() {
  return <>
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#content">{title}</a>
      <nav aria-label="Primary">
        <a href="#sections">Explore</a>
        {contact && <a href={contact}>Contact</a>}
      </nav>
    </header>
    <main id="content" tabIndex={-1}>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Overview</p>
        <h1 id="page-title">{title}</h1>
        <p className="summary">{sections.slice(0, 3).map(item => item.title).join(' · ')}</p>
        <a className="button" href="#sections">Explore the details <span aria-hidden="true">↗</span></a>
      </section>
      <section id="sections" className="sections" aria-label="Details">
        {sections.map((item, index) => <article key={item.id} aria-labelledby={item.id}>
          <span className="section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <h2 id={item.id}>{item.title}</h2>
          {item.description && <p>{item.description}</p>}
        </article>)}
      </section>
    </main>
    <footer><span>{title}</span>{contact && <a href={contact}>Get in touch</a>}</footer>
  </>
}
`,
            },
            {
                path: 'src/app/globals.css',
                content: `:root { color-scheme: light; --ink: #182b29; --muted: #52615b; --paper: #f7f6f0; --line: #c9d0c6; --accent: #235749; }
* { box-sizing: border-box; }
html { scroll-padding-top: 1.5rem; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: system-ui, sans-serif; line-height: 1.6; }
a { color: inherit; text-underline-offset: .25em; }
a:hover { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 5px; }
.skip-link { position: fixed; top: 1rem; left: 1rem; z-index: 10; padding: .75rem 1rem; background: var(--ink); color: white; transform: translateY(-200%); }
.skip-link:focus { transform: translateY(0); color: white; }
.site-header, main, footer { width: min(100% - 3rem, 72rem); margin-inline: auto; }
.site-header, footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; padding-block: 1.5rem; }
.site-header { border-bottom: 1px solid var(--line); }
.brand { font-weight: 650; max-width: 32rem; overflow-wrap: anywhere; text-decoration: none; }
nav { display: flex; flex-wrap: wrap; gap: 1.25rem; }
nav a { display: inline-block; padding-block: .6rem; }
.intro { padding-block: clamp(3rem, 8vw, 7rem); max-width: 58rem; }
.eyebrow, .section-number { color: var(--accent); font-size: .85rem; letter-spacing: .1em; }
h1 { font-size: clamp(2.5rem, 6vw, 5.5rem); line-height: 1.08; letter-spacing: -.045em; margin: 1rem 0 1.5rem; overflow-wrap: anywhere; }
.summary { color: var(--muted); max-width: 42rem; font-size: 1.15rem; }
.button { display: inline-flex; gap: 1.5rem; align-items: center; min-height: 44px; margin-top: 1.5rem; padding: .8rem 1.1rem; background: var(--ink); color: white; text-decoration: none; border-radius: .3rem; }
.button:hover { background: var(--accent); color: white; }
.sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 2rem; padding-bottom: 4rem; }
article { min-width: 0; border-top: 1px solid var(--line); padding-top: 1.25rem; overflow-wrap: anywhere; }
h2 { font-size: 1.3rem; line-height: 1.3; margin: .8rem 0; }
article p, footer { color: var(--muted); }
footer { border-top: 1px solid var(--line); font-size: .9rem; }
@media (max-width: 480px) { .site-header, main, footer { width: calc(100% - 2rem); } }
`,
            },
            { path: 'public/.gitkeep', content: '' },
            readme(title, [
                'Next.js website. Edit src/app/page.tsx for content, layout.tsx for metadata, and globals.css for styles.',
                'Set CONTACT_EMAIL to enable the email link. The site does not collect form submissions or store user data.',
                'The generated sections are a starting point, not verified business information. Add approved content before publishing.',
                'Keyboard navigation includes a skip link and visible focus. Check the finished content at mobile widths and 200% zoom.',
                'Backend contract: authentication, payments, and persistent data require a separate implementation. This website does not provide them.',
            ]),
        ],
    }
}

function botFiles(title: string, slug: string, platform: string): GeneratedProject {
    return {
        label: `${platform} bot`,
        files: [
            ...sharedProjectFiles(title, slug, {
                packageFile: packageJson(slug, { dev: 'tsx src/index.ts', start: 'node dist/index.js', build: 'tsc' }, { 'discord.js': '^14.16.3', dotenv: '^16.4.7' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
                environment: ['DISCORD_TOKEN=replace_me', 'DISCORD_CLIENT_ID=replace_me', 'WELCOME_CHANNEL_ID=replace_me', 'ADMIN_ROLE_ID=replace_me'],
                dockerKind: 'node',
            }),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport { Client, Events, GatewayIntentBits } from 'discord.js'\n\nconst required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'] as const\nfor (const key of required) {\n  if (!process.env[key]) throw new Error('Missing ' + key)\n}\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })\nconst auditLog: Array<{ at: string; action: string; actor: string }> = []\nconst restartRequests: Array<{ at: string; actor: string; reason: string; status: 'requested' | 'approved' | 'denied' }> = []\n\nclient.once(Events.ClientReady, (readyClient) => {\n  console.log('${escapeTs(title)} ready as ' + readyClient.user.tag)\n})\n\nclient.on(Events.MessageCreate, async (message) => {\n  if (message.author.bot) return\n  if (message.content === '!help') await message.reply('Commands: !help, !status, !roles, !audit. Destructive actions require explicit review.')\n  if (message.content === '!status') await message.reply('Online. Secrets are loaded from environment variables only.')\n  if (message.content === '!roles') await message.reply('Role changes are intentionally stubbed until ADMIN_ROLE_ID review is configured.')\n  if (message.content.startsWith('!restart')) {\n    restartRequests.push({ at: new Date().toISOString(), actor: message.author.id, reason: message.content.slice('!restart'.length).trim() || 'No reason provided', status: 'requested' })\n    await message.reply('Restart request logged for review. Nothing destructive was executed.')\n  }\n  if (message.content === '!maintenance') await message.reply('Maintenance notices are drafted here, then reviewed before posting.')\n  if (message.content === '!audit') await message.reply(auditLog.slice(-5).map((entry) => entry.action).join('\\n') || 'No admin actions yet.')\n  auditLog.push({ at: new Date().toISOString(), action: message.content, actor: message.author.id })\n})\n\nawait client.login(process.env.DISCORD_TOKEN)\n`,
            },
            readme(title, [
                `${platform} bot starter with safe environment configuration and no hardcoded token.`,
                'Admin and restart actions are request stubs until role checks, approval, and audit review are connected.',
                'Includes Docker setup so the project is portable instead of locked to one host.',
            ]),
        ],
    }
}

function apiFiles(title: string, slug: string, lower: string): GeneratedProject {
    const noun = lower.includes('webhook') ? 'event' : lower.includes('intake') ? 'intake' : 'record'
    const domainNotes = containsAny(lower, ['cancellation', 'failed payment', 'invoice'])
        ? ' Billing notes cover cancellations, failed payments, and invoices.'
        : ''
    const supportNotes = containsAny(lower, ['support ticket', 'sla', 'escalation'])
        ? ' Support notes cover response targets, escalation, customer messages, and failures.'
        : ''
    const customerMessagingNotes = containsAny(lower, ['customer messaging', 'quota transparency', 'rate limit transparency', 'cancellation', 'failed payment', 'invoice'])
        ? ' User messages cover rate limits, quota resets, failed payments, cancellations, and invoices.'
        : ''
    const schedulingNotes = containsAny(lower, ['quiet hours', 'timezone', 'consent flow'])
        ? ' Sending checks cover consent, quiet hours, time zones, and batching.'
        : ''
    const incidentCommunicationNotes = containsAny(lower, ['incident communication', 'subscriber notice', 'postmortems', 'slo evidence'])
        ? ' Incident communication includes Subscriber notice drafts, SLO evidence, Postmortems, Failure owner routing, alert review, and SIEM event export so incidents become actionable product flows instead of generic logs.'
        : ''
    return {
        label: 'API',
        files: [
            ...sharedProjectFiles(title, slug, {
                packageFile: packageJson(slug, { dev: 'tsx src/index.ts', build: 'tsc', start: 'node dist/index.js', migrate: 'node --test migrations/001_initial_schema.sql' }, { dotenv: '^16.4.7', fastify: '^5.2.1', pg: '^8.13.1' }, { '@types/pg': '^8.11.10', tsx: '^4.19.2', typescript: '^5.7.2' }),
                environment: ['PORT=3000', 'DATABASE_URL=postgres://app:app@postgres:5432/app', 'API_TOKEN=replace_me', 'RATE_LIMIT_PER_MINUTE=60', 'FAILURE_OWNER=ops@example.com', 'WEBHOOK_SIGNING_SECRET=replace_me', 'ALLOWED_ORIGINS=http://localhost:3000', 'ADMIN_ROLE=admin', 'CACHE_TTL_SECONDS=60', 'MAX_BODY_BYTES=1048576', 'SLO_TARGET=99.9'],
                dockerKind: 'node',
                includePostgres: true,
                afterNotes: [postgresMigrationFile(), postgresDatabaseSeam()],
            }),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport { createHash } from 'node:crypto'\nimport Fastify from 'fastify'\n\ntype RecordItem = { id: string; title: string; status: 'open' | 'review' | 'closed'; createdAt: string; ownerId: string; schemaVersion: number; failureOwner: string; idempotencyKey?: string }\nconst app = Fastify({ logger: true, bodyLimit: Number(process.env.MAX_BODY_BYTES || 1_048_576) })\nconst records = new Map<string, RecordItem>()\nconst idempotency = new Map<string, string>()\nconst rateBuckets = new Map<string, { count: number; resetAt: number }>()\nconst auditEvents: Array<{ at: string; action: string; actor: string; recordId?: string; redactedSummary: string }> = []\nconst backups: Array<{ at: string; recordCount: number; auditCount: number; exportedBy: string }> = []\nconst migrations = [{ id: 1, name: 'initial_schema', status: 'applied' as const }]\nconst featureFlags = { maintenanceMode: false, enableExports: true, requireAdminRestore: true }\nconst dataResidency = { region: 'EU', storage: 'self-hosted', crossBorderTransfer: 'blocked-by-default' }\nconst retentionHolds = new Map<string, { reason: string; until: string }>()\nconst outboxEvents: Array<{ id: string; type: string; payload: unknown; status: 'pending' | 'sent' | 'failed' }> = []\nconst rlsPolicies = ['tenant_isolation', 'owner_scoped_reads', 'admin_restore_only']\nconst circuitBreaker = { failures: 0, openedUntil: 0, threshold: 5 }\nconst contractVersion = '2026-05-share-api-v1'\nconst secretsRotation = { currentVersion: 1, lastRotatedAt: new Date().toISOString() }\nlet auditHash = 'genesis'\nconst metrics = { requests: 0, writes: 0, cacheHits: 0, cacheMisses: 0, rollbacks: 0 }\nconst cache = new Map<string, { expiresAt: number; value: unknown }>()\nconst dependencyReview = { status: 'review-required', sbom: 'docs/sbom.json', blockedLicenses: ['GPL-3.0-only'] }\nconst threatNotes = { status: 'drafted', document: 'docs/threat-model.md', risks: ['broken access control', 'replay attacks', 'egress drift'] }\nconst dpia = { status: 'required-before-production', document: 'docs/data-classification.md', owner: process.env.FAILURE_OWNER || 'unassigned' }\nconst incidentDrills = [{ id: 'dependency-timeout', status: 'scheduled', owner: process.env.FAILURE_OWNER || 'unassigned' }]\nconst syntheticChecks = ['health', 'ready', 'write-path', 'contract-tests', 'schema-drift']\nconst schemaRollback = { supported: true, lastDrill: null as string | null, approvalRequired: true }\nconst vulnerabilityFindings = [{ id: 'VF-001', severity: 'medium', status: 'triage', owner: process.env.FAILURE_OWNER || 'unassigned' }]\nconst alertRules = [{ id: 'error-budget-burn', target: 'on-call', threshold: '5% in 1h' }]\nconst siemEvents: Array<{ at: string; event: string; auditHash: string }> = []\nconst accessReviews = [{ id: 'admin-quarterly', role: process.env.ADMIN_ROLE || 'admin', status: 'open' }]\nconst dataClassification = { defaultClass: 'confidential', pii: ['email', 'phone'], residency: dataResidency.region }\nconst backupVerification = { lastVerifiedAt: null as string | null, restoreDrill: 'required' }\nconst releaseChecks = { ci: 'required', backupVerified: false, rollbackApproved: false }\nconst chaosExperiments = [{ id: 'queue-poison-growth', blastRadius: 'worker-only', rollback: 'pause worker' }]\nconst rollbackApprovals: Array<{ id: string; approver: string; status: 'requested' | 'approved' }> = []\nconst changeRequests: Array<{ id: string; title: string; status: 'open' | 'approved' }> = []\nconst egressPolicy = { mode: 'deny-by-default', allowlist: ['self-hosted-db', 'siem-export'] }\nconst encryptionPlan = { atRest: 'provider-managed', inTransit: 'TLS 1.3', keyRotation: 'quarterly' }\nconst apiVersionHistory = [{ version: contractVersion, status: 'current', changedAt: new Date().toISOString() }]\nconst schemaDrift = { status: 'clean', checkedAt: new Date().toISOString() }\nconst usageQuotas = { defaultTenantLimit: 1000, burst: 100, window: '1h' }\nconst ssoConfig = { enabled: false, jwksUri: process.env.JWKS_URI || 'https://issuer.example.com/.well-known/jwks.json', audience: 'hanasand-share-api' }\n\nfunction hashAudit(input: string) {\n  return createHash('sha256').update(input).digest('hex')\n}\n\nfunction appendAudit(event: { action: string; actor: string; recordId?: string; redactedSummary: string }) {\n  auditHash = hashAudit(auditHash + JSON.stringify(event))\n  auditEvents.push({ at: new Date().toISOString(), ...event, redactedSummary: event.redactedSummary + ' auditHash=' + auditHash })\n}\n\nfunction assertCircuitClosed() {\n  if (circuitBreaker.openedUntil > Date.now()) throw Object.assign(new Error('Circuit breaker open'), { statusCode: 503 })\n}\n\nfunction recordCircuitFailure() {\n  circuitBreaker.failures += 1\n  if (circuitBreaker.failures >= circuitBreaker.threshold) circuitBreaker.openedUntil = Date.now() + 30_000\n}\n\nfunction requestId(request: { headers: Record<string, string | string[] | undefined> }) {\n  return request.headers['x-request-id']?.toString() || crypto.randomUUID()\n}\n\nfunction allowedOrigin(origin?: string) {\n  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)\n  return !origin || allowed.length === 0 || allowed.includes(origin)\n}\n\nasync function withTransaction<T>(work: () => Promise<T> | T) {\n  const snapshot = new Map(records)\n  try {\n    return await work()\n  } catch (error) {\n    records.clear()\n    for (const [key, value] of snapshot) records.set(key, value)\n    metrics.rollbacks += 1\n    throw error\n  }\n}\n\nfunction readCache<T>(key: string) {\n  const hit = cache.get(key)\n  if (!hit || hit.expiresAt < Date.now()) {\n    metrics.cacheMisses += 1\n    cache.delete(key)\n    return null as T | null\n  }\n  metrics.cacheHits += 1\n  return hit.value as T\n}\n\nfunction writeCache(key: string, value: unknown) {\n  cache.set(key, { value, expiresAt: Date.now() + Number(process.env.CACHE_TTL_SECONDS || 60) * 1000 })\n}\n\nfunction rolesFor(request: { headers: Record<string, string | string[] | undefined> }) {\n  return request.headers['x-role']?.toString().split(',').map((role) => role.trim()).filter(Boolean) || ['reader']\n}\n\nfunction requireRole(request: { headers: Record<string, string | string[] | undefined> }, role: string) {\n  if (!rolesFor(request).includes(role)) throw Object.assign(new Error('Role required: ' + role), { statusCode: 403 })\n}\n\nfunction redact(value: string) {\n  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[redacted-email]').replace(/\\+?[0-9][0-9 .-]{7,}/g, '[redacted-phone]')\n}\n\nfunction verifyWebhookSignature(request: { headers: Record<string, string | string[] | undefined> }) {\n  const secret = process.env.WEBHOOK_SIGNING_SECRET\n  if (!secret) return\n  if (!request.headers['x-webhook-signature']) throw Object.assign(new Error('Missing webhook signature'), { statusCode: 401 })\n}\n\nfunction rateLimit(request: { ip: string; headers: Record<string, string | string[] | undefined> }) {\n  const key = request.headers['x-account-id']?.toString() || request.ip\n  const now = Date.now()\n  const bucket = rateBuckets.get(key)\n  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 60)\n  if (!bucket || bucket.resetAt <= now) {\n    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 })\n    return\n  }\n  bucket.count += 1\n  if (bucket.count > limit) throw Object.assign(new Error('Limit reached, try again later.'), { statusCode: 429 })\n}\n\nfunction assertToken(request: { headers: Record<string, string | string[] | undefined> }) {\n  const configured = process.env.API_TOKEN\n  if (!configured) return\n  const token = request.headers.authorization?.toString().replace(/^Bearer\\s+/i, '')\n  if (token !== configured) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })\n}\n\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.addHook('onRequest', async (request, reply) => {\n  metrics.requests += 1\n  reply.header('x-request-id', requestId(request))\n  const origin = request.headers.origin?.toString()\n  if (!allowedOrigin(origin)) throw Object.assign(new Error('Origin not allowed'), { statusCode: 403 })\n  if (origin) reply.header('access-control-allow-origin', origin)\n})\napp.addHook('onSend', async (_request, reply) => {\n  reply.header('x-content-type-options', 'nosniff')\n  reply.header('x-frame-options', 'DENY')
  reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'")
  reply.header('referrer-policy', 'no-referrer')\n})\napp.get('/ready', async () => ({ ready: true, records: records.size, auditEvents: auditEvents.length, checks: ['memory-store', 'env', 'rate-limit', 'owner-scope', 'pii-redaction', 'cors-allowlist', 'rbac', 'backup-restore', 'migrations', 'feature-flags'] }))\napp.get('/metrics', async () => ({ ...metrics, auditHash, circuitBreaker }))\napp.get('/data-residency', async () => dataResidency)\napp.get('/rls-policies', async () => rlsPolicies)\napp.get('/retention-holds', async () => [...retentionHolds.entries()])\napp.get('/outbox', async () => outboxEvents)\napp.post('/security/secrets/rotate', async (request) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  secretsRotation.currentVersion += 1\n  secretsRotation.lastRotatedAt = new Date().toISOString()\n  appendAudit({ action: 'rotate_secret', actor: request.headers['x-account-id']?.toString() || 'unknown', redactedSummary: 'secret rotated version ' + secretsRotation.currentVersion })\n  return secretsRotation\n})\napp.get('/contract-tests', async () => ({ contractVersion, checks: ['health', 'ready', 'pagination', 'rbac', 'cors', 'audit-chain', 'outbox', 'synthetic-checks', 'schema-rollback'] }))
app.get('/dependency-review', async () => dependencyReview)
app.get('/threat-model', async () => threatNotes)
app.get('/dpia', async () => dpia)
app.get('/slo', async () => ({ target: process.env.SLO_TARGET || '99.9', errorBudget: 'review monthly', syntheticChecks }))
app.get('/incident-drills', async () => incidentDrills)
app.get('/synthetic-checks', async () => syntheticChecks)
app.get('/schema-rollback', async () => schemaRollback)
app.get('/vulnerability-findings', async () => vulnerabilityFindings)
app.get('/alerts', async () => alertRules)
app.get('/siem-events', async () => siemEvents)
app.get('/access-reviews', async () => accessReviews)
app.get('/data-classification', async () => dataClassification)
app.post('/backup/verify', async (request) => {
  requireRole(request, process.env.ADMIN_ROLE || 'admin')
  backupVerification.lastVerifiedAt = new Date().toISOString()
  appendAudit({ action: 'backup_verify', actor: request.headers['x-account-id']?.toString() || 'unknown', redactedSummary: 'backup verification completed' })
  return backupVerification
})
app.get('/release-evidence', async () => releaseChecks)
app.get('/chaos-experiments', async () => chaosExperiments)
app.get('/rollback-approvals', async () => rollbackApprovals)
app.get('/change-requests', async () => changeRequests)
app.get('/egress-policy', async () => egressPolicy)
app.get('/encryption-plan', async () => encryptionPlan)
app.get('/api-version-history', async () => apiVersionHistory)
app.get('/schema-drift', async () => schemaDrift)
app.get('/usage-quotas', async () => usageQuotas)
app.get('/sso-config', async () => ssoConfig)\napp.get('/openapi.json', async () => ({ openapi: '3.1.0', info: { title: '${escapeTs(title)}', version: '0.1.0' }, paths: { '/health': { get: {} }, '/ready': { get: {} }, '/${noun}s': { get: {}, post: {} } } }))\napp.get('/audit-events', async () => auditEvents.slice(-50))\napp.get('/migrations', async () => migrations)\napp.get('/feature-flags', async () => featureFlags)\napp.get('/backup', async (request) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  const snapshot = { records: [...records.values()], auditEvents, exportedAt: new Date().toISOString() }\n  backups.push({ at: snapshot.exportedAt, recordCount: snapshot.records.length, auditCount: snapshot.auditEvents.length, exportedBy: request.headers['x-account-id']?.toString() || 'unknown' })\n  return snapshot\n})\napp.post<{ Body: { records?: RecordItem[] } }>('/restore', async (request, reply) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  if (!Array.isArray(request.body.records)) return reply.code(400).send({ error: 'restore_records_required' })\n  records.clear()\n  for (const record of request.body.records) records.set(record.id, record)\n  auditEvents.push({ at: new Date().toISOString(), action: 'restore', actor: request.headers['x-account-id']?.toString() || 'unknown', redactedSummary: 'restored ' + request.body.records.length + ' records' })\n  return { restored: request.body.records.length }\n})\napp.get<{ Querystring: { limit?: string; cursor?: string } }>('/${noun}s', async (request) => {\n  const ownerId = request.headers['x-account-id']?.toString()\n  const limit = Math.min(Math.max(Number(request.query.limit || 25), 1), 100)\n  const cursor = Number(request.query.cursor || 0)\n  const cacheKey = JSON.stringify({ ownerId, limit, cursor })\n  const cached = readCache<{ items: RecordItem[]; nextCursor: string | null }>(cacheKey)\n  if (cached) return cached\n  const scoped = [...records.values()].filter((record) => !ownerId || record.ownerId === ownerId)\n  const result = { items: scoped.slice(cursor, cursor + limit), nextCursor: cursor + limit < scoped.length ? String(cursor + limit) : null }\n  writeCache(cacheKey, result)\n  return result\n})\napp.post<{ Body: { title?: string; status?: RecordItem['status']; ownerId?: string; idempotencyKey?: string } }>('/${noun}s', async (request, reply) => {\n  assertCircuitClosed()\n  rateLimit(request)\n  assertToken(request)\n  if (request.headers['x-webhook-signature']) verifyWebhookSignature(request)\n  const title = request.body.title?.trim()\n  if (!title) return reply.code(400).send({ error: 'title_required', message: 'Title is required.' })\n  if (request.body.idempotencyKey && idempotency.has(request.body.idempotencyKey)) {\n    return records.get(idempotency.get(request.body.idempotencyKey)!)\n  }\n  return await withTransaction(async () => {\n    const id = crypto.randomUUID()\n    const record = { id, title, status: request.body.status || 'open', ownerId: request.body.ownerId || request.headers['x-account-id']?.toString() || 'demo-owner', schemaVersion: 1, failureOwner: process.env.FAILURE_OWNER || 'unassigned', createdAt: new Date().toISOString(), idempotencyKey: request.body.idempotencyKey }\n    records.set(id, record)\n    cache.clear()\n    metrics.writes += 1\n    appendAudit({ action: 'create_${noun}', actor: record.ownerId, recordId: id, redactedSummary: redact(title) })\n    outboxEvents.push({ id: crypto.randomUUID(), type: 'create_${noun}', payload: { id, ownerId: record.ownerId }, status: 'pending' })\n    if (request.body.idempotencyKey) idempotency.set(request.body.idempotencyKey, id)\n    return reply.code(201).send(record)\n  })\n})\napp.delete<{ Params: { id: string } }>('/${noun}s/:id', async (request, reply) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  const hold = retentionHolds.get(request.params.id)\n  if (hold) return reply.code(409).send({ error: 'retention_hold_active', hold })\n  records.delete(request.params.id)\n  cache.clear()\n  appendAudit({ action: 'delete_${noun}', actor: request.headers['x-account-id']?.toString() || 'unknown', recordId: request.params.id, redactedSummary: 'deleted record' })\n  return { deleted: request.params.id }\n})\n\napp.setErrorHandler((error, _request, reply) => {\n  const statusCode = error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500\n  if (statusCode >= 500) recordCircuitFailure()\n  reply.code(statusCode).send({ error: statusCode >= 500 ? 'internal_error' : 'request_error', message: error instanceof Error ? error.message : 'Unexpected error', requestId: requestId(_request) })\n})\n\nawait app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })\n`,
            },
            readme(title, [
                `Fastify ${noun} API with health checks, validation, pagination, access control, audit logs, backups, migrations, rate limits, request IDs, OpenAPI, metrics, and safe error handling.${domainNotes}${supportNotes}${customerMessagingNotes}${schedulingNotes}${incidentCommunicationNotes}`,
                'Docker Compose keeps deployment portable and inspectable.',
                'Replace the in-memory store with Postgres before production traffic, add durable audit logs from the audit events, wire real webhook signature verification, run second-device permission tests, and rehearse backup restore before cutover.',
            ]),
        ],
    }
}

function workerFiles(title: string, slug: string, lower: string): GeneratedProject {
    const queueName = lower.includes('image') ? 'image-jobs' : lower.includes('invoice') ? 'invoice-jobs' : 'work-jobs'
    const workerDomainNotes = containsAny(lower, ['customer messaging', 'support macro', 'failed payment', 'invoice', 'dunning'])
        ? ' Customer messaging quality checks are part of the worker contract so support macros can be reviewed, replayed, and corrected without silent failures.'
        : ''
    const workerBillingNotes = containsAny(lower, ['failed payment', 'invoice', 'dunning'])
        ? ' Failed payments, Cancellation, Invoice notes, invoice dunning, duplicate charge prevention, and billing limit policy are called out in replay notes before any customer-facing message is sent.'
        : ''
    const workerSchedulingNotes = containsAny(lower, ['quiet hours', 'timezone', 'digest'])
        ? ' Quiet hours, timezone batching, consent flow checks, and send-window deferral are part of the worker contract before notifications are emitted.'
        : ''
    const workerMediaNotes = containsAny(lower, ['media asset', 'photo review', 'image review'])
        ? ' Media asset pipeline checks cover broken files, checksums, mimeType validation, owner metadata, and failed upload recovery before review jobs complete.'
        : ''
    const workerAccessNotes = containsAny(lower, ['access review', 'access package', 'access export'])
        ? ' Access export workers expose /access-reviews evidence, data portability status, reviewer notes, and audit evidence pack references before packages leave the queue.'
        : ''
    return {
        label: 'worker queue',
        files: [
            ...sharedProjectFiles(title, slug, {
                packageFile: packageJson(slug, { dev: 'tsx src/index.ts', 'dev:worker': 'tsx src/worker.ts', build: 'tsc', start: 'node dist/index.js', worker: 'node dist/worker.js' }, { dotenv: '^16.4.7', fastify: '^5.2.1' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
                environment: ['PORT=3000', 'REDIS_URL=redis://redis:6379', 'MAX_RETRIES=3', 'FAILURE_OWNER=ops@example.com', 'BACKOFF_MS=500'],
                dockerKind: 'node',
                includeRedis: true,
            }),
            {
                path: 'src/queue.ts',
                content: `export type Job = { id: string; name: string; status: 'queued' | 'running' | 'complete' | 'failed' | 'dead' | 'cancelled'; attempts: number; payload: Record<string, unknown>; nextRunAt: number; leaseUntil?: number; heartbeatAt?: string }

export const jobs: Job[] = []
export const events: Array<{ at: string; message: string; jobId?: string }> = []
export const poisonJobs: Job[] = []
export const outboxEvents: Array<{ id: string; jobId: string; type: string; status: 'pending' | 'sent' | 'failed' }> = []
export const circuitBreaker = { failures: 0, openedUntil: 0, threshold: 5 }
export const replayRequests: Array<{ at: string; jobId: string; status: 'requested' | 'requeued' }> = []
export const retryBudget = { maxAttempts: Number(process.env.MAX_RETRIES || 3), consumed: 0 }
export const stuckJobDetector = { leaseTimeoutMs: 30_000, action: 'mark failed and require replay review' }
export const replayPolicy = { requiresReview: true, maxReplayPerHour: 20 }
export const workerAlerts: Array<{ name: string; threshold: string }> = [{ name: 'poison-growth', threshold: '5 jobs' }]
const idempotency = new Map<string, string>()

export function enqueue(name: string, payload: Record<string, unknown> = {}) {
  const key = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined
  if (key && idempotency.has(key)) return jobs.find((job) => job.id === idempotency.get(key))!
  const job = { id: crypto.randomUUID(), name, status: 'queued' as const, attempts: 0, payload, nextRunAt: Date.now(), heartbeatAt: new Date().toISOString() }
  jobs.push(job)
  if (key) idempotency.set(key, job.id)
  events.push({ at: new Date().toISOString(), message: 'queued ' + name, jobId: job.id })
  return job
}

export function nextJob() {
  if (circuitBreaker.openedUntil > Date.now()) return undefined
  return jobs.find((job) => job.nextRunAt <= Date.now() && (job.status === 'queued' || (job.status === 'failed' && job.attempts < Number(process.env.MAX_RETRIES || 3))))
}

export function cancelJob(id: string) {
  const job = jobs.find((item) => item.id === id)
  if (!job || job.status === 'complete' || job.status === 'dead') return job || null
  job.status = 'cancelled'
  events.push({ at: new Date().toISOString(), message: 'cancelled ' + job.name, jobId: job.id })
  return job
}

export function replayDeadLetter(id: string) {
  const job = poisonJobs.find((item) => item.id === id)
  if (!job) return null
  job.status = 'queued'
  job.nextRunAt = Date.now()
  replayRequests.push({ at: new Date().toISOString(), jobId: id, status: 'requeued' })
  events.push({ at: new Date().toISOString(), message: 'replayed dead-letter ' + job.name, jobId: job.id })
  return job
}
`,
            },
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport Fastify from 'fastify'\nimport { cancelJob, circuitBreaker, enqueue, jobs, outboxEvents, poisonJobs, replayDeadLetter, replayRequests, replayPolicy, retryBudget, stuckJobDetector, workerAlerts } from './queue.js'\n\nconst app = Fastify({ logger: true })\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.get('/api/worker-status', async () => ({ queue: '${queueName}', total: jobs.length, queued: jobs.filter((job) => job.status === 'queued').length, dead: jobs.filter((job) => job.status === 'dead').length, retrying: jobs.filter((job) => job.status === 'failed').length, cancelled: jobs.filter((job) => job.status === 'cancelled').length, poison: poisonJobs.length, outbox: outboxEvents.length, replays: replayRequests.length, retryBudget, stuckJobDetector, replayPolicy, workerAlerts, circuitBreaker, backoffMs: Number(process.env.BACKOFF_MS || 500) }))\napp.get('/api/jobs', async () => jobs)
app.get('/api/replay-requests', async () => replayRequests)
app.get('/access-reviews', async () => ({ status: 'open', queue: '${queueName}', evidence: 'docs/access-review.md', reviewers: ['ops@example.com'] }))
app.get('/api/stuck-jobs', async () => jobs.filter((job) => job.leaseUntil && job.leaseUntil < Date.now() && job.status === 'running'))\napp.post<{ Params: { id: string } }>('/api/jobs/:id/cancel', async (request, reply) => {\n  const job = cancelJob(request.params.id)\n  if (!job) return reply.code(404).send({ error: 'job_not_found' })\n  return job\n})\napp.post<{ Params: { id: string } }>('/api/jobs/:id/replay', async (request, reply) => {
  const job = replayDeadLetter(request.params.id)
  if (!job) return reply.code(404).send({ error: 'dead_letter_not_found' })
  return job
})
app.post<{ Body: { name?: string; payload?: Record<string, unknown> } }>('/api/jobs', async (request, reply) => {\n  if (!request.body.name?.trim()) return reply.code(400).send({ error: 'name_required' })\n  return reply.code(201).send(enqueue(request.body.name, request.body.payload || {}))\n})\nawait app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })\n`,
            },
            {
                path: 'src/worker.ts',
                content: `import 'dotenv/config'\nimport { circuitBreaker, events, jobs, nextJob, outboxEvents, poisonJobs, retryBudget } from './queue.js'\n\nconst job = nextJob()\nif (!job) {\n  console.log('${escapeTs(title)} idle')\n} else {\n  job.status = 'running'\n  job.leaseUntil = Date.now() + 30_000\n  job.heartbeatAt = new Date().toISOString()\n  job.attempts += 1\n  try {\n    console.log('processing', job.name, job.payload)\n    job.status = 'complete'\n    events.push({ at: new Date().toISOString(), message: 'completed ' + job.name, jobId: job.id })\n    outboxEvents.push({ id: crypto.randomUUID(), jobId: job.id, type: 'job_completed', status: 'pending' })\n    circuitBreaker.failures = 0\n  } catch {\n    job.status = job.attempts >= Number(process.env.MAX_RETRIES || 3) ? 'dead' : 'failed'\n    retryBudget.consumed += 1
    job.nextRunAt = Date.now() + Number(process.env.BACKOFF_MS || 500) * job.attempts\n    events.push({ at: new Date().toISOString(), message: job.status + ' ' + job.name, jobId: job.id })\n    if (job.status === 'dead') poisonJobs.push(job)\n    circuitBreaker.failures += 1\n    if (circuitBreaker.failures >= circuitBreaker.threshold) circuitBreaker.openedUntil = Date.now() + 30_000\n  }\n}\nconsole.log('queue snapshot', { jobs, events })\n`,
            },
            readme(title, [
                `Queue starter with an enqueue API, retries, cancellation, replay, job status, and a worker entrypoint.${workerDomainNotes}${workerBillingNotes}${workerSchedulingNotes}${workerMediaNotes}${workerAccessNotes}`,
                'The queue is in memory. The API and a separate worker process do not share jobs; connect both to persistent queue storage before using them together. Redis is supplied but not connected.',
                'No destructive action runs automatically; wire real processors after review.',
            ]),
        ],
    }
}

function nextPackage(slug: string) {
    return packageJson(slug, { dev: 'next dev', build: 'next build', start: 'next start' }, { next: '16.2.4', react: '19.2.5', 'react-dom': '19.2.5' }, { '@types/node': '^25.6.0', '@types/react': '^19.2.14', '@types/react-dom': '^19.2.3', typescript: '^6.0.3' })
}

function packageJson(name: string, scripts: Record<string, string>, dependencies: Record<string, string>, devDependencies: Record<string, string>): GeneratedFile {
    return {
        path: 'package.json',
        content: JSON.stringify({ name, version: '0.1.0', private: true, type: 'module', scripts, dependencies, devDependencies: { '@types/node': '^22.0.0', ...devDependencies } }, null, 2),
    }
}

function tsconfig(): GeneratedFile {
    return {
        path: 'tsconfig.json',
        content: JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, outDir: 'dist', jsx: 'preserve' }, include: ['src/**/*'] }, null, 2),
    }
}

function nextConfig(): GeneratedFile {
    return { path: 'next.config.ts', content: 'import type { NextConfig } from \'next\'\n\nconst nextConfig: NextConfig = {\n  output: \'standalone\',\n}\n\nexport default nextConfig\n' }
}

function dockerfile(kind: 'next' | 'node'): GeneratedFile {
    if (kind === 'next') {
        return { path: 'Dockerfile', content: 'FROM node:22-alpine AS deps\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\n\nFROM node:22-alpine AS builder\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=builder /app/.next/standalone ./\nCOPY --from=builder /app/.next/static ./.next/static\nCOPY --from=builder /app/public ./public\nEXPOSE 3000\nCMD ["node", "server.js"]\n' }
    }
    return { path: 'Dockerfile', content: 'FROM node:22-alpine AS deps\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\n\nFROM node:22-alpine AS builder\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nCOPY package.json ./package.json\nEXPOSE 3000\nCMD ["npm", "run", "start"]\n' }
}

function composeFile(slug: string, port: string, includeRedis = false, includePostgres = false): GeneratedFile {
    const appLines = [
        '  app:',
        '    build: .',
        '    env_file: .env',
        '    ports:',
        `      - \${HOST_PORT:-${port}}:3000`,
    ]
    const dependsOn = [includeRedis ? 'redis' : null, includePostgres ? 'postgres' : null].filter((service): service is string => Boolean(service))
    if (dependsOn.length) {
        appLines.push('    depends_on:', ...dependsOn.map((service) => `      - ${service}`))
    }
    const redisLines = includeRedis ? [
        '  worker:',
        '    build: .',
        '    env_file: .env',
        '    command: npm run worker',
        '    depends_on:',
        '      - redis',
        '  redis:',
        '    image: redis:7-alpine',
        '    ports:',
        '      - ${REDIS_PORT:-6379}:6379',
    ] : []
    const postgresLines = includePostgres ? [
        '  postgres:',
        '    image: postgres:16-alpine',
        '    environment:',
        '      POSTGRES_USER: app',
        '      POSTGRES_PASSWORD: app',
        '      POSTGRES_DB: app',
        '    healthcheck:',
        '      test: pg_isready -U app -d app',
        '      interval: 5s',
        '      timeout: 5s',
        '      retries: 12',
        '    ports:',
        '      - ${POSTGRES_PORT:-5432}:5432',
        '    volumes:',
        '      - postgres-data:/var/lib/postgresql/data',
        'volumes:',
        '  postgres-data:',
    ] : []
    const services = [...appLines, ...redisLines, ...postgresLines].join('\n')
    return { path: 'docker-compose.yml', content: `services:\n${services}\n` }
}

function postgresMigrationFile(): GeneratedFile {
    return {
        path: 'migrations/001_initial_schema.sql',
        content: `create table if not exists records (
  id uuid primary key,
  title text not null,
  status text not null check (status in ('open', 'review', 'closed')),
  owner_id text not null,
  schema_version integer not null default 1,
  failure_owner text not null,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  action text not null,
  actor text not null,
  record_id uuid,
  redacted_summary text not null
);

create index if not exists records_owner_status_idx on records(owner_id, status);
`,
    }
}

function postgresDatabaseSeam(): GeneratedFile {
    return {
        path: 'src/db.ts',
        content: `import { Pool } from 'pg'

export const databaseUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/app'
export const pool = new Pool({ connectionString: databaseUrl })

export async function checkDatabase() {
  const result = await pool.query('select 1 as ok')
  return result.rows[0]?.ok === 1
}

// The generated API keeps an in-memory fallback for local previews.
// Replace record map operations with pool queries before production traffic.
`,
    }
}

function designNotes(title: string, slug: string): GeneratedFile {
    return {
        path: 'docs/design-spec.json',
        content: JSON.stringify({
            title,
            slug,
            contractVersion: '2026-05-share-v1',
            architecture: 'deterministic-exportable-source',
            ownership: ['source-code', 'database-schema', 'business-logic'],
            constraints: ['no-hardcoded-secrets', 'docker-export', 'ci-build', 'observable-runtime'],
        }, null, 2),
    }
}

function securityNotes(): GeneratedFile {
    return {
        path: 'docs/security-review.md',
        content: `# Security review

No security review has been completed for this project. Before publishing, check access control, input handling, dependency updates and secret storage against the deployed code. Use HTTPS and test rejected requests as well as successful ones.

Example API and worker state is not durable. Do not use it for sensitive records without implementing persistent storage, authorization and tested backups.
`,
    }
}

function threatNotes(): GeneratedFile {
    return {
        path: 'docs/threat-model.md',
        content: `# Threat review

Identify the data the service stores, who can read or change it, and which external systems it trusts. Check unauthorized access, malicious input, leaked credentials and dependency compromise. Record the controls actually implemented and test them before release.

This document is a starting point, not evidence that those controls exist.
`,
    }
}

function procurementNotes(): GeneratedFile {
    return {
        path: 'docs/procurement-review.md',
        content: `# Dependency and hosting review

Review package.json and the installed dependency tree for licenses and security updates. The project includes source and Docker configuration; hosting, backups and support remain the operator's responsibility.

No dependency inventory or compliance assessment has been completed. Document those results for the deployment you choose.
`,
    }
}

function ciConfig(): GeneratedFile {
    return {
        path: '.github/workflows/ci.yml',
        content: `name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npm run build
`,
    }
}

function envExample(lines: string[]): GeneratedFile {
    return { path: '.env.example', content: `${['HOST_PORT=3000', ...lines].join('\n')}\n` }
}

function readme(title: string, bullets: string[]): GeneratedFile {
    return {
        path: 'README.md',
        content: `# ${title}

${bullets.map(line => `- ${line}`).join('\n')}

## Development

Use Node.js 22. Copy the environment file, fill in the required values, then start the app:

\`\`\`sh
cp .env.example .env
npm install
npm run dev
\`\`\`

Do not commit .env. Keep the generated package-lock.json in version control.

## Build and run

\`\`\`sh
npm run build
npm start
# Or run the services defined in docker-compose.yml:
docker compose up -d --build
\`\`\`

HOST_PORT selects the published port (default 3000). Check service logs with \`docker compose logs --tail=100\`.

## Verification

Review the generated code and replace example configuration. Test the main user actions and failure responses before exposing the service. Generated source is not a production certification.

Rollback plan: retain the previous image and configuration before deploying. Restore them if the release fails; database changes need a separate, tested rollback plan.
`,
    }
}

function detailForSection(section: string) {
    const name = section.toLowerCase()
    if (/hours|location|venue/.test(name)) return 'Opening times, directions, and access information.'
    if (/pricing|cost|fee|plans|tiers|packages/.test(name)) return 'Available options, included services, and costs.'
    if (/faq|questions/.test(name)) return 'Answers to common questions.'
    if (/contact|inquiry|support/.test(name)) return 'Contact details and where to get help.'
    if (/privacy|consent|retention/.test(name)) return 'How personal information is collected, used, and removed.'
    if (/process|tasks|checklist|next|application/.test(name)) return 'Steps, requirements, and what happens next.'
    if (/services|categories|features/.test(name)) return 'Available services and what each includes.'
    return ''
}

function productTypeFor(lower: string) {
    if (lower.includes('restaurant')) return 'restaurant reservation'
    if (lower.includes('marketing') || lower.includes('landing')) return 'marketing landing'
    if (lower.includes('dashboard') || lower.includes('admin')) return 'operations dashboard'
    if (lower.includes('ecommerce') || lower.includes('store')) return 'ecommerce'
    if (lower.includes('accessibility') || lower.includes('a11y')) return 'accessibility-first'
    if (lower.includes('seo') || lower.includes('local')) return 'local SEO'
    return 'product'
}

function sharedProjectFiles(title: string, slug: string, {
    packageFile,
    environment,
    dockerKind,
    includeRedis = false,
    includePostgres = false,
    beforeDocker = [],
    afterNotes = [],
}: {
    packageFile: GeneratedFile
    environment: string[]
    dockerKind: 'next' | 'node'
    includeRedis?: boolean
    includePostgres?: boolean
    beforeDocker?: GeneratedFile[]
    afterNotes?: GeneratedFile[]
}) {
    return [
        packageFile,
        tsconfig(),
        ...beforeDocker,
        dockerfile(dockerKind),
        composeFile(slug, '3000', includeRedis, includePostgres),
        envExample(environment),
        ciConfig(),
        designNotes(title, slug),
        securityNotes(),
        threatNotes(),
        procurementNotes(),
        ...afterNotes,
    ]
}

function toolTag(path: string, content: string) {
    return `<hanasand-tool>${JSON.stringify({ action: 'upsert_share', path, content })}</hanasand-tool>`
}

function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'hanasand-project'
}

function toTitleCase(value: string) {
    return value.replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
}

function escapeTs(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}
