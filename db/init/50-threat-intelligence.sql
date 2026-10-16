CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    ingestion_id TEXT NOT NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_vendor TEXT NOT NULL DEFAULT 'custom',
    source_product TEXT NOT NULL DEFAULT 'generic-json',
    event_timestamp TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL DEFAULT 'unknown',
    action TEXT NOT NULL DEFAULT 'unknown',
    outcome TEXT NOT NULL DEFAULT 'unknown',
    user_id TEXT,
    user_email TEXT,
    source_ip TEXT,
    source_country TEXT,
    source_city TEXT,
    device_id TEXT,
    normalized JSONB NOT NULL DEFAULT '{}'::jsonb,
    original JSONB NOT NULL DEFAULT '{}'::jsonb,
    parser_version TEXT NOT NULL DEFAULT 'event.v1',
    processing_status TEXT NOT NULL DEFAULT 'processed'
);

CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1',
    name TEXT NOT NULL,
    family TEXT NOT NULL DEFAULT 'Custom',
    severity TEXT NOT NULL DEFAULT 'medium',
    explanation TEXT NOT NULL,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    source TEXT NOT NULL DEFAULT 'owned' CHECK (source IN ('owned', 'open_source', 'hanasand')),
    source_reference TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, rule_id),
    CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);
CREATE INDEX IF NOT EXISTS idx_rules_org_enabled ON rules(organization_id, enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    finding_key TEXT NOT NULL UNIQUE,
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'benign', 'resolved', 'suppressed')),
    summary TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_ids TEXT[] NOT NULL DEFAULT '{}',
    first_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    analyst_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_findings_org_status ON findings(organization_id, status, last_observed DESC);
