import type { Pool } from 'pg'
import type { MongoClient } from 'mongodb'

export type BrowseInput = { instance: string, database: string, mode: 'contents' | 'rows' | 'count', schema?: string, table?: string, cursor?: string }
export type Cursor = { target: string, values?: unknown[], scan?: string, index?: number, offset?: number }
export type RedisConnection = { sendCommand(args: string[]): Promise<unknown>, type(key: string): Promise<string>, getRange(key: string, start: number, end: number): Promise<string | null>, destroy(): void }
export type Connection = { pg?: Pool, mongo?: MongoClient, redis?: RedisConnection, used: number }
