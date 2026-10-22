import run from '#db'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'

export default async function ensureUvmScannerSchema() {
    await run(`CREATE TABLE IF NOT EXISTS uvm_assets (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        hostname TEXT NOT NULL,
        verification_token TEXT NOT NULL,
        verification_method TEXT NOT NULL DEFAULT 'dns_txt' CHECK (verification_method IN ('dns_txt', 'internal')),
        verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'disabled')),
        verified_at TIMESTAMPTZ,
        scan_authorized_at TIMESTAMPTZ,
        scan_authorized_by TEXT,
        authorized_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
        schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        schedule_engine TEXT NOT NULL DEFAULT 'nmap' CHECK (schedule_engine IN ('nmap', 'tenable-vm')),
        schedule_scan_id TEXT,
        interval_minutes INT NOT NULL DEFAULT 60 CHECK (interval_minutes BETWEEN 5 AND 1440),
        next_run_at TIMESTAMPTZ,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, hostname)
    )`)
    await run('ALTER TABLE uvm_assets ADD COLUMN IF NOT EXISTS authorized_addresses JSONB NOT NULL DEFAULT \'[]\'::jsonb')
    await run('ALTER TABLE uvm_assets ADD COLUMN IF NOT EXISTS schedule_engine TEXT NOT NULL DEFAULT \'nmap\' CHECK (schedule_engine IN (\'nmap\', \'tenable-vm\'))')
    await run('ALTER TABLE uvm_assets ADD COLUMN IF NOT EXISTS schedule_scan_id TEXT')
    await run(`CREATE TABLE IF NOT EXISTS uvm_network_runs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        asset_id TEXT NOT NULL REFERENCES uvm_assets(id) ON DELETE RESTRICT,
        request_id TEXT NOT NULL UNIQUE,
        scanner_run_id TEXT UNIQUE,
        engine TEXT NOT NULL CHECK (engine = 'nmap'),
        profile TEXT NOT NULL CHECK (profile = 'tcp-top-100'),
        source TEXT NOT NULL CHECK (source IN ('manual', 'scheduled')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
        actor_id TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ
    )`)
    await run('CREATE INDEX IF NOT EXISTS uvm_network_runs_org_created_idx ON uvm_network_runs (organization_id, created_at DESC)')
    await run(`CREATE TABLE IF NOT EXISTS uvm_tenable_runs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        asset_id TEXT NOT NULL REFERENCES uvm_assets(id) ON DELETE RESTRICT,
        request_id TEXT NOT NULL UNIQUE,
        scanner_run_id TEXT UNIQUE,
        scan_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('manual', 'scheduled')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
        actor_id TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ
    )`)
    await run('CREATE INDEX IF NOT EXISTS uvm_tenable_runs_org_created_idx ON uvm_tenable_runs (organization_id, created_at DESC)')
    await run(`CREATE TABLE IF NOT EXISTS uvm_findings (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        asset_id TEXT REFERENCES uvm_assets(id) ON DELETE RESTRICT,
        asset_label TEXT NOT NULL,
        asset_address TEXT,
        engine TEXT NOT NULL,
        last_scan_profile TEXT,
        external_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        title TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info', 'unknown')),
        cvss_score DOUBLE PRECISION,
        cve_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        description TEXT,
        solution TEXT,
        evidence TEXT,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_verification', 'accepted_risk', 'false_positive', 'resolved')),
        triage_note TEXT,
        first_seen TIMESTAMPTZ,
        last_seen TIMESTAMPTZ,
        last_observed_run_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, fingerprint)
    )`)
    await run('ALTER TABLE uvm_findings ADD COLUMN IF NOT EXISTS asset_address TEXT')
    await run('ALTER TABLE uvm_findings ADD COLUMN IF NOT EXISTS last_scan_profile TEXT')
    await run('CREATE INDEX IF NOT EXISTS uvm_findings_org_status_severity_idx ON uvm_findings (organization_id, status, severity)')
    await run(`CREATE TABLE IF NOT EXISTS uvm_finding_observations (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES uvm_findings(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        evidence TEXT,
        observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (finding_id, run_id)
    )`)
    await run(`CREATE TABLE IF NOT EXISTS uvm_finding_sync_runs (
        organization_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, run_id)
    )`)
    await run(`INSERT INTO uvm_assets (id, organization_id, hostname, verification_token, verification_method, verification_status, verified_at, created_by)
        VALUES ('hanasand-primary', $1, 'hanasand.com', '', 'internal', 'verified', NOW(), 'system')
        ON CONFLICT (organization_id, hostname) DO NOTHING`, [HANASAND_ORGANIZATION_ID])
}
