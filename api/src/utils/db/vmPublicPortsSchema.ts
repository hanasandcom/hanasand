import run from '#db'

export default async function ensureVmPublicPortsSchema() {
    await run(`CREATE TABLE IF NOT EXISTS vm_public_ports (
        id BIGSERIAL PRIMARY KEY,
        vm_name TEXT NOT NULL REFERENCES vms(name) ON UPDATE CASCADE ON DELETE CASCADE,
        name TEXT NOT NULL UNIQUE,
        route_type TEXT NOT NULL CHECK (route_type IN ('minecraft-java', 'tls')),
        guest_port INTEGER NOT NULL CHECK (guest_port BETWEEN 1 AND 65535),
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await run('CREATE INDEX IF NOT EXISTS vm_public_ports_vm_name_idx ON vm_public_ports(vm_name)')
}
