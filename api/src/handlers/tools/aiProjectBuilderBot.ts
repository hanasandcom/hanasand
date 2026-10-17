import type { GeneratedProject } from './aiProjectBuilderTypes.ts'
import { sharedProjectFiles, packageJson } from './aiProjectBuilderRuntimeFiles.ts'
import { readme } from './aiProjectBuilderDocumentation.ts'
import { escapeTs } from './aiProjectBuilderText.ts'

export function botFiles(title: string, slug: string, platform: string): GeneratedProject {
    return {
        label: `${platform} bot`,
        files: [
            ...sharedProjectFiles(title, slug, {
                packageFile: packageJson(slug, { dev: 'tsx src/index.ts', start: 'node dist/index.js', build: 'tsc' }, { 'discord.js': '^14.16.3', dotenv: '^16.4.7' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
                environment: ['DISCORD_TOKEN=replace_me', 'DISCORD_CLIENT_ID=replace_me', 'WELCOME_CHANNEL_ID=replace_me', 'ADMIN_ROLE_ID=replace_me'],
                dockerKind: 'node',
            }),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport { Client, Events, GatewayIntentBits } from 'discord.js'\n\nconst required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'] as const\nfor (const key of required) {\n  if (!process.env[key]) throw new Error('Missing ' + key)\n}\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })\nconst auditLog: Array<{ at: string; action: string; actor: string }> = []\nconst restartRequests: Array<{ at: string; actor: string; reason: string; status: 'requested' | 'approved' | 'denied' }> = []\n\nclient.once(Events.ClientReady, (readyClient) => {\n  console.log('${escapeTs(title)} ready as ' + readyClient.user.tag)\n})\n\nclient.on(Events.MessageCreate, async (message) => {\n  if (message.author.bot) return\n  if (message.content === '!help') await message.reply('Commands: !help, !status, !roles, !audit. Destructive actions require explicit review.')\n  if (message.content === '!status') await message.reply('Online. Secrets are loaded from environment variables only.')\n  if (message.content === '!roles') await message.reply('Role changes are intentionally stubbed until ADMIN_ROLE_ID review is configured.')\n  if (message.content.startsWith('!restart')) {\n    restartRequests.push({ at: new Date().toISOString(), actor: message.author.id, reason: message.content.slice('!restart'.length).trim() || 'No reason provided', status: 'requested' })\n    await message.reply('Restart request logged for review. Nothing destructive was executed.')\n  }\n  if (message.content === '!maintenance') await message.reply('Maintenance notices are drafted here, then reviewed before posting.')\n  if (message.content === '!audit') await message.reply(auditLog.slice(-5).map((entry) => entry.action).join('\\n') || 'No admin actions yet.')\n  auditLog.push({ at: new Date().toISOString(), action: message.content, actor: message.author.id })\n})\n\nawait client.login(process.env.DISCORD_TOKEN)\n`,
            },
            readme(title, [
                `${platform} bot starter with safe environment configuration and no hardcoded token.`,
                'Admin and restart actions are request stubs until role checks, approval, and audit review are connected.',
                'Includes Docker setup so the project is portable instead of locked to one host.',
            ]),
        ],
    }
}
