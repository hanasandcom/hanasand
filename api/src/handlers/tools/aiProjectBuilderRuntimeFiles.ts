import type { GeneratedFile } from './aiProjectBuilderTypes.ts'
import { designNotes, securityNotes, threatNotes, procurementNotes, ciConfig, envExample } from './aiProjectBuilderDocumentation.ts'

export function nextPackage(slug: string) {
    return packageJson(slug, { dev: 'next dev', build: 'next build', start: 'next start' }, { next: '16.2.4', react: '19.2.5', 'react-dom': '19.2.5' }, { '@types/node': '^25.6.0', '@types/react': '^19.2.14', '@types/react-dom': '^19.2.3', typescript: '^6.0.3' })
}

export function packageJson(name: string, scripts: Record<string, string>, dependencies: Record<string, string>, devDependencies: Record<string, string>): GeneratedFile {
    return {
        path: 'package.json',
        content: JSON.stringify({ name, version: '0.1.0', private: true, type: 'module', scripts, dependencies, devDependencies: { '@types/node': '^22.0.0', ...devDependencies } }, null, 2),
    }
}

export function tsconfig(): GeneratedFile {
    return {
        path: 'tsconfig.json',
        content: JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, outDir: 'dist', jsx: 'preserve' }, include: ['src/**/*'] }, null, 2),
    }
}

export function nextConfig(): GeneratedFile {
    return { path: 'next.config.ts', content: 'import type { NextConfig } from \'next\'\n\nconst nextConfig: NextConfig = {\n  output: \'standalone\',\n}\n\nexport default nextConfig\n' }
}

export function dockerfile(kind: 'next' | 'node'): GeneratedFile {
    if (kind === 'next') {
        return { path: 'Dockerfile', content: 'FROM node:22-alpine AS deps\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\n\nFROM node:22-alpine AS builder\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=builder /app/.next/standalone ./\nCOPY --from=builder /app/.next/static ./.next/static\nCOPY --from=builder /app/public ./public\nEXPOSE 3000\nCMD ["node", "server.js"]\n' }
    }
    return { path: 'Dockerfile', content: 'FROM node:22-alpine AS deps\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\n\nFROM node:22-alpine AS builder\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nCOPY package.json ./package.json\nEXPOSE 3000\nCMD ["npm", "run", "start"]\n' }
}

export function composeFile(slug: string, port: string, includeRedis = false, includePostgres = false): GeneratedFile {
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

export function postgresMigrationFile(): GeneratedFile {
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

export function postgresDatabaseSeam(): GeneratedFile {
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

export function sharedProjectFiles(title: string, slug: string, {
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
