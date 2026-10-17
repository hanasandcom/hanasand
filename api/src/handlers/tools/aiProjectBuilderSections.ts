import { containsAny } from './aiProjectBuilderText.ts'

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

export function sectionsForPage(lower: string) {
    const rule = sectionRules.find(([matches]) => matches(lower))
    return rule ? [...rule[1]] : ['Overview', 'Highlights', 'Process', 'Next steps']
}

export function detailForSection(section: string) {
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

export function productTypeFor(lower: string) {
    if (lower.includes('restaurant')) return 'restaurant reservation'
    if (lower.includes('marketing') || lower.includes('landing')) return 'marketing landing'
    if (lower.includes('dashboard') || lower.includes('admin')) return 'operations dashboard'
    if (lower.includes('ecommerce') || lower.includes('store')) return 'ecommerce'
    if (lower.includes('accessibility') || lower.includes('a11y')) return 'accessibility-first'
    if (lower.includes('seo') || lower.includes('local')) return 'local SEO'
    return 'product'
}
