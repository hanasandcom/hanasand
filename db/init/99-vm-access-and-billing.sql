ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_description TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION vm_user_has_access(vm_name TEXT, viewer_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM vms v WHERE v.name = vm_name AND CASE
            WHEN v.organization_id IS NOT NULL THEN EXISTS (
                SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
                WHERE m.organization_id = v.organization_id AND m.user_id = viewer_id
                  AND m.status = 'active' AND o.status = 'active'
            )
            ELSE v.owner = viewer_id OR v.created_by = viewer_id OR v.access_users ? viewer_id
        END
    )
$$;

CREATE OR REPLACE FUNCTION vm_user_can_manage(vm_name TEXT, viewer_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM vms v WHERE v.name = vm_name AND CASE
            WHEN v.organization_id IS NOT NULL THEN EXISTS (
                SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
                WHERE m.organization_id = v.organization_id AND m.user_id = viewer_id
                  AND m.status = 'active' AND o.status = 'active' AND m.role IN ('owner', 'admin')
            )
            ELSE v.owner = viewer_id OR v.created_by = viewer_id OR v.access_users ? viewer_id
        END
    )
$$;
-- Paid host options belong to one container and never transfer to a recreated name.
CREATE TABLE IF NOT EXISTS container_subscriptions (
    id UUID PRIMARY KEY,
    vm_name TEXT REFERENCES vms(name) ON UPDATE CASCADE ON DELETE SET NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL CHECK (feature IN ('always_running', 'failover')),
    stripe_subscription_id TEXT UNIQUE,
    stripe_checkout_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS container_subscriptions_vm ON container_subscriptions(vm_name, feature);
CREATE TABLE IF NOT EXISTS vm_failover (
    vm_name TEXT PRIMARY KEY REFERENCES vms(name) ON UPDATE CASCADE ON DELETE CASCADE,
    replica_id UUID NOT NULL,
    phase TEXT NOT NULL DEFAULT 'queued',
    target_host TEXT NOT NULL,
    requested_host TEXT,
    request_id UUID,
    synced_at TIMESTAMPTZ,
    error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
