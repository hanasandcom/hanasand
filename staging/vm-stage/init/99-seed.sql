INSERT INTO users (id, name, password, avatar, active)
VALUES ('vm-stage-user', 'VM Stage User', 'stage-only-placeholder', '', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, slug, created_by, status)
VALUES ('vm-stage-cashflow', 'Cashflow Staging', 'cashflow-staging', 'vm-stage-user', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role, status)
VALUES ('vm-stage-cashflow', 'vm-stage-user', 'owner', 'active')
ON CONFLICT (organization_id, user_id) DO NOTHING;
