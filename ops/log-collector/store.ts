import type { Persistence } from './persistence';
import * as fs from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isQueueBucket, shardedQueuePath } from './queueLayout';
import { BATCH_BYTES, BATCH_COUNT, type Events, type LogEvent, jsonSize, syncDirectory } from './event-data';

export class Store {
  private staged = new Map<string, string>();
  private pendingBatches = 0;
  private nextLiveQueue: 'sharded' | 'legacy' = 'sharded';
  constructor(public root = process.env.HANASAND_LOG_STATE || '/var/lib/hanasand-log-collector', public persistence?: Persistence) { fs.mkdirSync(root, { recursive: true, mode: 0o700 }); }
  path(name: string) { return join(this.root, name); }
  readRaw(name: string): string | null { return this.staged.get(name) ?? (fs.existsSync(this.path(name)) ? fs.readFileSync(this.path(name), 'utf8') : null); }
  load<T>(name: string, fallback: T): T { const raw = this.readRaw(name); return raw === null ? fallback : JSON.parse(raw) as T; }
  save(name: string, value: unknown) { this.saveRaw(name, JSON.stringify(value)); }
  saveRaw(name: string, data: string) {
    const path = this.path(name);
    if (this.persistence) {
      if (this.readRaw(name) === data) return;
      this.persistence.checkpoint(path, data); this.staged.set(name, data); return;
    }
    const pending = path + '.' + randomUUID() + '.tmp', fd = fs.openSync(pending, 'wx', 0o600);
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(pending, path); syncDirectory(dirname(path));
  }
  async durable() { if (this.persistence) { await this.persistence.barrier(); this.pendingBatches = 0; } }
  queueBatch(batch: LogEvent[], lane: string, atomic = false) {
    const current = this.path('queue/sharded/' + lane);
    fs.mkdirSync(current, { recursive: true, mode: 0o700 });
    const identity = (BigInt(Date.now()) * 1000000n).toString().padStart(20, '0') + '-' + randomUUID().replaceAll('-', '');
    const pending = shardedQueuePath(current, identity + '.pending'), path = pending.slice(0, -'.pending'.length) + '.json';
    fs.mkdirSync(dirname(pending), { recursive: true, mode: 0o700 });
    if (!this.persistence) { syncDirectory(current); syncDirectory(dirname(current)); syncDirectory(this.root); }
    const fd = fs.openSync(pending, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify({ events: batch, ...(atomic ? { atomic: true } : {}) })); if (!this.persistence) fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (this.persistence) { this.persistence.queue(pending); this.pendingBatches++; }
    else { fs.renameSync(pending, path); syncDirectory(dirname(pending)); }
  }
  async send(events: Events) {
    const batches: Record<string, LogEvent[]> = { live: [], history: [] }, sizes = { live: 0, history: 0 };
    let flushed = performance.now();
    const flush = () => { for (const lane of ['live', 'history'] as const) if (batches[lane].length) { this.queueBatch(batches[lane], lane); batches[lane] = []; sizes[lane] = 0; } };
    const laneFor = (item: LogEvent) => !Number.isFinite(Date.parse(item.timestamp)) || Date.parse(item.timestamp) >= Date.now() - 60000 ? 'live' : 'history';
    const append = async (item: LogEvent) => {
      if (this.pendingBatches >= 128) await this.durable();
      const lane = laneFor(item), size = jsonSize(item);
      if (batches[lane].length && (sizes[lane] + size > BATCH_BYTES || batches[lane].length >= BATCH_COUNT)) { this.queueBatch(batches[lane], lane); batches[lane] = []; sizes[lane] = 0; }
      batches[lane].push(item); sizes[lane] += size;
      if (performance.now() - flushed >= 100) { flush(); flushed = performance.now(); }
    };
    for await (const item of events) {
      if ('atomic' in item && item.atomic === true) {
        if (!item.events.length) continue;
        if (item.events.length <= BATCH_COUNT && jsonSize({ events: item.events }) <= BATCH_BYTES) {
          if (this.pendingBatches >= 128) await this.durable();
          flush();
          this.queueBatch(item.events, item.events.some(event => laneFor(event) === 'live') ? 'live' : 'history', true);
          flushed = performance.now();
        } else {
          for (const event of item.events) await append(event);
        }
      } else await append(item as LogEvent);
    }
    flush();
  }
  queuedNames(lane: string, limit: number, advanceFairness = true): string[] {
    if (limit <= 0) return [];
    const root = this.path('queue/' + lane);
    const namesIn = (directoryPath: string, pageLimit = limit, includePending = false) => {
      if (pageLimit <= 0 || !fs.existsSync(directoryPath)) return [];
      const names: string[] = [], directory = fs.opendirSync(directoryPath);
      try { for (let entry; (entry = directory.readSync());) {
        if (!entry.isFile() || (!entry.name.endsWith('.json') && !(includePending && entry.name.endsWith('.pending')))) continue;
        names.push(entry.name);
        if (names.length >= pageLimit) break;
      } } finally { directory.closeSync(); }
      names.sort();
      return names.map(name => join(directoryPath, name));
    };
    const current = join(this.root, 'queue', 'sharded', lane);
    const sharded = namesIn(current);
    if (sharded.length < limit && fs.existsSync(current)) {
      const buckets = fs.readdirSync(current).filter(name => isQueueBucket(name)).sort();
      for (const bucket of buckets) {
        sharded.push(...namesIn(join(current, bucket), limit - sharded.length));
        if (sharded.length >= limit) break;
      }
    }
    const legacyCurrent = join(root, 'current');
    const legacy = namesIn(legacyCurrent, limit, true);
    if (lane === 'live' && sharded.length && legacy.length) {
      const selected = this.nextLiveQueue === 'sharded' ? sharded : legacy;
      if (advanceFairness) this.nextLiveQueue = this.nextLiveQueue === 'sharded' ? 'legacy' : 'sharded';
      return selected;
    }
    if (sharded.length) return sharded.sort((a, b) => a.localeCompare(b)).slice(0, limit);
    if (legacy.length) return legacy;
    return namesIn(root);
  }
  private queuedCurrentLiveNames(limit: number) { return this.queuedNames('live', limit, false); }
  private quarantineQueueFile(path: string) {
    const target = shardedQueuePath(this.path('queue/quarantine'), basename(path) + '.interrupted');
    fs.mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    fs.renameSync(path, target);
    if (this.persistence) this.persistence.dirty();
    else { syncDirectory(dirname(path)); syncDirectory(dirname(target)); }
  }
  queuedBatches(lane: string): string[] {
    if (lane === 'history' && this.queuedCurrentLiveNames(1).length) return [];
    const paths: string[] = []; let size = 0, count = 0;
    for (const path of this.queuedNames(lane, BATCH_COUNT)) {
      let raw: Buffer, batch: { events: LogEvent[]; atomic?: boolean };
      try {
        raw = readBounded(path, 512000);
        batch = JSON.parse(raw.toString()) as { events: LogEvent[]; atomic?: boolean };
        if (!Array.isArray(batch.events) || !batch.events.length) throw new Error('Invalid queued batch');
      } catch {
        this.quarantineQueueFile(path);
        continue;
      }
      const entries = batch.events.length;
      if (batch.atomic && paths.length) break;
      if (paths.length && (size + raw.length > BATCH_BYTES || count + entries > BATCH_COUNT)) break;
      paths.push(path); size += raw.length; count += entries;
      if (batch.atomic) break;
    }
    return paths;
  }
}

export function readBounded(path: string, limit: number): Buffer {
  const fd = fs.openSync(path, 'r');
  try { const buffer = Buffer.alloc(limit + 1); const size = fs.readSync(fd, buffer, 0, buffer.length, 0); if (size > limit) throw new Error('Record exceeds size limit'); return buffer.subarray(0, size); }
  finally { fs.closeSync(fd); }
}
