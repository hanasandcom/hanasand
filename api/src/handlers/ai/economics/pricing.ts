export function pricingModes() {
    return [
        { id: 'draft', label: 'Cheap draft', priority: 0, concurrency: 1, verification: 'none', discountFailedPlatformRuns: true },
        { id: 'standard', label: 'Standard', priority: 1, concurrency: 2, verification: 'basic build and smoke', discountFailedPlatformRuns: true },
        { id: 'verified', label: 'Verified', priority: 2, concurrency: 3, verification: 'browser check, build, mobile, a11y basics', discountFailedPlatformRuns: true },
        { id: 'priority', label: 'Priority', priority: 4, concurrency: 5, verification: 'verified lane plus faster queue', discountFailedPlatformRuns: true },
    ]
}

export function subscriptionTiers() {
    return [
        {
            id: 'free',
            label: 'Free',
            outcomeAllowance: 5,
            queuePriority: 'draft',
            concurrency: 1,
            fit: 'Small prototypes',
            features: ['limited verification', 'cheap draft lane', 'community queue'],
        },
        {
            id: 'starter',
            label: 'Starter',
            outcomeAllowance: 25,
            queuePriority: 'standard',
            concurrency: 1,
            fit: 'Personal sites',
            features: ['async queue', 'basic deploy', 'basic verification'],
        },
        {
            id: 'pro',
            label: 'Pro',
            outcomeAllowance: 120,
            queuePriority: 'verified',
            concurrency: 3,
            fit: 'Larger projects',
            features: ['custom domains', 'priority verification', 'rollback'],
        },
        {
            id: 'agency',
            label: 'Agency',
            outcomeAllowance: 350,
            queuePriority: 'priority',
            concurrency: 6,
            fit: 'Multiple client workspaces',
            features: ['client reports', 'white-label deploy', 'client workspace separation'],
        },
        {
            id: 'business',
            label: 'Business',
            outcomeAllowance: 900,
            queuePriority: 'priority',
            concurrency: 10,
            fit: 'Controlled teams',
            features: ['audit logs', 'approvals', 'scoped secrets', 'SSO later'],
        },
    ]
}
