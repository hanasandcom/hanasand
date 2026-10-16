import { Pool } from 'pg'
import { MongoClient } from 'mongodb'
import { createClient } from 'redis'
import { getRuntimeContainer } from '#utils/docker/engine.ts'
import type { BrowseInput, Connection } from './browseTypes.ts'

const connections = new Map<string, Promise<Connection>>()

const expiry = setInterval(() => {
    for (const [key, pending] of connections) void pending.then(async connection => {
        if (Date.now() - connection.used < 60_000) return
        connections.delete(key)
        await connection.pg?.end()
        await connection.mongo?.close()
        connection.redis?.destroy()
    }).catch(() => connections.delete(key))
}, 30_000)

expiry.unref()

export async function connect(input: BrowseInput, engine: string) {
    const key = JSON.stringify([input.instance, input.database])
    if (!connections.has(key)) {
        const pending = (async (): Promise<Connection> => {
            const inspect = await getRuntimeContainer(input.instance)
            const env = Object.fromEntries((inspect.Config?.Env || []).map(item => { const at = item.indexOf('='); return [item.slice(0, at), item.slice(at + 1)] }))
            const args = inspect.Config?.Cmd || inspect.Args || []
            const portFlag = args.indexOf('-p')
            const port = Number(env.PGPORT || (portFlag >= 0 ? args[portFlag + 1] : '') || (engine === 'PostgreSQL' ? 5432 : engine === 'MongoDB' ? 27017 : 6379))
            const published = inspect.NetworkSettings?.Ports?.[`${port}/tcp`]?.[0]
            const network = Object.values(inspect.NetworkSettings?.Networks || {}).find(network => network.IPAddress)
            const hostNetwork = inspect.HostConfig?.NetworkMode === 'host'
            // API and database containers share Docker networks. Use the
            // database's internal address and port instead of its published
            // host port, which would resolve to the API container's loopback.
            const host = hostNetwork ? '127.0.0.1' : network?.IPAddress || (published ? '127.0.0.1' : undefined)
            if (!host) throw new Error('Database address unavailable')
            const actualPort = hostNetwork || network?.IPAddress ? port : published ? Number(published.HostPort) : port
            if (engine === 'PostgreSQL') {
                const standby = input.instance === 'hanasand-db-standby'
                const pg = new Pool({ host, port: actualPort, database: input.database, user: env.POSTGRES_USER || (standby ? process.env.DB_USER : undefined) || 'hanasand', password: env.POSTGRES_PASSWORD || (standby ? process.env.DB_PASSWORD : undefined),
                    max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 2000,
                    options: '-c default_transaction_read_only=on -c statement_timeout=2000 -c lock_timeout=300', application_name: 'database-preview' })
                pg.on('error', () => { connections.delete(key); void pg.end().catch(() => {}) })
                return { pg, used: Date.now() }
            }
            if (engine === 'MongoDB') {
                const mongo = new MongoClient(`mongodb://${host}:${actualPort}`, { maxPoolSize: 2, maxIdleTimeMS: 30_000, serverSelectionTimeoutMS: 2000,
                    ...(env.MONGO_INITDB_ROOT_USERNAME ? { auth: { username: env.MONGO_INITDB_ROOT_USERNAME, password: env.MONGO_INITDB_ROOT_PASSWORD }, authSource: 'admin' } : {}) })
                await mongo.connect()
                return { mongo, used: Date.now() }
            }
            const passwordAt = args.indexOf('--requirepass')
            const redis = createClient({ socket: { host, port: actualPort, connectTimeout: 2000, reconnectStrategy: false },
                password: env.REDIS_PASSWORD || (passwordAt >= 0 ? args[passwordAt + 1] : undefined), database: Number(input.database.slice(2)) })
            redis.on('error', () => {})
            await redis.connect()
            return { redis, used: Date.now() }
        })()
        connections.set(key, pending)
        void pending.catch(() => connections.delete(key))
    }
    const connection = await connections.get(key)!
    connection.used = Date.now()
    return connection
}
