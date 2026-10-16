ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_by TEXT;

-- Index on user-roles
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- VM metrics indexes
CREATE INDEX IF NOT EXISTS idx_vm_metrics_id ON vm_metrics(id);
CREATE INDEX IF NOT EXISTS idx_vm_metrics_name ON vm_metrics(name);
CREATE INDEX IF NOT EXISTS idx_vm_metrics_name_created ON vm_metrics(name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vm_metrics_created_at ON vm_metrics(created_at);

-- Logs connections to the database
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_min_messages = 'info';
SELECT pg_reload_conf();

-- Creates the root user (required for creating roles)
INSERT INTO users (id, name, password, avatar)
VALUES (
    'administrator',
    'Administrator',
    crypt(encode(gen_random_bytes(32), 'base64'), gen_salt('bf', 12)),
    ''
);

-- Creates initial roles
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('administrator', 'Administrator', 0, 'Administrators', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('system_admin', 'System Administrator', 20, 'System Administrator. Gives elevated access to the system, including ability to manage and delete vms and containers.', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('user_admin', 'User Administrator', 40, 'User Administrator', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('content_admin', 'Content Administrator', 60, 'Content Administrator. Gives base access to create and delete content.', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('users', 'Users', 200, 'Default role for all users. Gives base access to internal services.', 'administrator');

-- Maps initial roles for the administrator
INSERT INTO user_roles (user_id, role_id, assigned_by)
VALUES ('administrator', 'administrator', 'administrator');


-- Shared site-wide thesis
