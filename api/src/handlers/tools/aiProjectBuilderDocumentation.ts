import type { GeneratedFile } from './aiProjectBuilderTypes.ts'

export function designNotes(title: string, slug: string): GeneratedFile {
    return {
        path: 'docs/design-spec.json',
        content: JSON.stringify({
            title,
            slug,
            contractVersion: '2026-05-share-v1',
            architecture: 'deterministic-exportable-source',
            ownership: ['source-code', 'database-schema', 'business-logic'],
            constraints: ['no-hardcoded-secrets', 'docker-export', 'ci-build', 'observable-runtime'],
        }, null, 2),
    }
}

export function securityNotes(): GeneratedFile {
    return {
        path: 'docs/security-review.md',
        content: `# Security review

No security review has been completed for this project. Before publishing, check access control, input handling, dependency updates and secret storage against the deployed code. Use HTTPS and test rejected requests as well as successful ones.

Example API and worker state is not durable. Do not use it for sensitive records without implementing persistent storage, authorization and tested backups.
`,
    }
}

export function threatNotes(): GeneratedFile {
    return {
        path: 'docs/threat-model.md',
        content: `# Threat review

Identify the data the service stores, who can read or change it, and which external systems it trusts. Check unauthorized access, malicious input, leaked credentials and dependency compromise. Record the controls actually implemented and test them before release.

This document is a starting point, not evidence that those controls exist.
`,
    }
}

export function procurementNotes(): GeneratedFile {
    return {
        path: 'docs/procurement-review.md',
        content: `# Dependency and hosting review

Review package.json and the installed dependency tree for licenses and security updates. The project includes source and Docker configuration; hosting, backups and support remain the operator's responsibility.

No dependency inventory or compliance assessment has been completed. Document those results for the deployment you choose.
`,
    }
}

export function ciConfig(): GeneratedFile {
    return {
        path: '.github/workflows/ci.yml',
        content: `name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npm run build
`,
    }
}

export function envExample(lines: string[]): GeneratedFile {
    return { path: '.env.example', content: `${['HOST_PORT=3000', ...lines].join('\n')}\n` }
}

export function readme(title: string, bullets: string[]): GeneratedFile {
    return {
        path: 'README.md',
        content: `# ${title}

${bullets.map(line => `- ${line}`).join('\n')}

## Development

Use Node.js 22. Copy the environment file, fill in the required values, then start the app:

\`\`\`sh
cp .env.example .env
npm install
npm run dev
\`\`\`

Do not commit .env. Keep the generated package-lock.json in version control.

## Build and run

\`\`\`sh
npm run build
npm start
# Or run the services defined in docker-compose.yml:
docker compose up -d --build
\`\`\`

HOST_PORT selects the published port (default 3000). Check service logs with \`docker compose logs --tail=100\`.

## Verification

Review the generated code and replace example configuration. Test the main user actions and failure responses before exposing the service. Generated source is not a production certification.

Rollback plan: retain the previous image and configuration before deploying. Restore them if the release fails; database changes need a separate, tested rollback plan.
`,
    }
}
