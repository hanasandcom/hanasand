import run from '#db'

export default async function ensureVmPublicPortsSchema() {
    await run(`CREATE TABLE IF NOT EXISTS vm_public_ports (
        id BIGSERIAL PRIMARY KEY,
        vm_name TEXT NOT NULL REFERENCES vms(name) ON UPDATE CASCADE ON DELETE CASCADE,
        name TEXT NOT NULL UNIQUE,
        route_type TEXT NOT NULL CHECK (route_type IN ('minecraft-java', 'tls', 'http')),
        guest_port INTEGER NOT NULL CHECK (guest_port BETWEEN 1 AND 65535),
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await run(`DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'vm_public_ports'::regclass
              AND conname = 'vm_public_ports_route_type_check'
              AND pg_get_constraintdef(oid) LIKE '%http%'
        ) THEN
            ALTER TABLE vm_public_ports DROP CONSTRAINT IF EXISTS vm_public_ports_route_type_check;
            ALTER TABLE vm_public_ports ADD CONSTRAINT vm_public_ports_route_type_check
                CHECK (route_type IN ('minecraft-java', 'tls', 'http'));
        END IF;
    END $$`)
    await run('CREATE INDEX IF NOT EXISTS vm_public_ports_vm_name_idx ON vm_public_ports(vm_name)')
}
