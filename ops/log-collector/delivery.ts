import type { Persistence } from './persistence';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { basename, dirname } from 'node:path';
import { isQueueBucket } from './queueLayout';
import { BATCH_COUNT, type Config, type LogEvent, syncDirectory } from './event-data';
import { readBounded } from './store';

export class DeliveryError extends Error { override name = 'DeliveryError'; }
export class CollectionError extends Error { override name = 'CollectionError'; }
export class CommandError extends Error {
  override name = 'CommandError';
  constructor(public code: number | null, public reason?: string) { super('Command collection failed'); }
}
export class TimeoutError extends Error { override name = 'TimeoutError'; }
export const collectionError = (error: unknown) => error instanceof CollectionError || error instanceof DeliveryError ? error.message : error instanceof Error ? error.name === 'PersistenceBarrierError' ? error.message : error.name : 'Error';

export class Delivery {
  url: URL; agent: http.Agent | https.Agent;
  eventAgeSeconds = 0;
  private acknowledged = new Map<string, number>();
  constructor(public config: Config, private persistence?: Persistence) {
    this.url = new URL(config.url || '');
    if (!['http:', 'https:'].includes(this.url.protocol) || this.url.username || this.url.password) throw new Error('Invalid ingestion URL');
    if (this.url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(this.url.hostname)) throw new Error('Remote ingestion requires HTTPS');
    this.agent = this.url.protocol === 'https:' ? new https.Agent({ keepAlive: true, maxSockets: 1 }) : new http.Agent({ keepAlive: true, maxSockets: 1 });
  }
  close() { this.agent.destroy(); }
  async deliver(paths: string[]): Promise<number> {
    const batches = paths.map(path => JSON.parse(readBounded(path, 512000).toString()) as { events: LogEvent[]; atomic?: boolean });
    const atomic = batches.some(batch => batch.atomic === true);
    if (atomic && paths.length !== 1) throw new DeliveryError('Atomic evidence group must be delivered separately');
    const queued = batches.flatMap(batch => batch.events);
    if (queued.some(item => typeof item.sourceEventId !== 'string' || !item.sourceEventId)) throw new DeliveryError('Missing stable event identity');
    const now = Date.now();
    for (const [id, at] of this.acknowledged) { if (at > now - 120000) break; this.acknowledged.delete(id); }
    const seen = new Set<string>();
    const events = atomic ? queued : queued.filter(item => { if (this.acknowledged.has(item.sourceEventId) || seen.has(item.sourceEventId)) return false; seen.add(item.sourceEventId); return true; });
    const payload = JSON.stringify({ events });
    if (Buffer.byteLength(payload) > 512000 || events.length > BATCH_COUNT) throw new Error('Delivery batch exceeds ingestion limit');
    if (events.length) try {
      await new Promise<void>((resolve, reject) => {
        const transport = this.url.protocol === 'https:' ? https : http;
        const request = transport.request(this.url, { method: 'POST', agent: this.agent, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), Authorization: 'Bearer ' + this.config.token } }, response => {
          const buffers: Buffer[] = []; let size = 0;
          response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 4096) response.destroy(new DeliveryError('Oversized ingestion acknowledgement')); else buffers.push(chunk); });
          response.on('error', reject);
          response.on('end', () => { try {
            if (response.statusCode !== 201) throw new DeliveryError('Ingestion HTTP ' + response.statusCode);
            const ack = JSON.parse(Buffer.concat(buffers).toString());
            if (ack.ok !== true || ack.accepted !== events.length) throw new DeliveryError('Ingestion acknowledgement mismatch');
            resolve();
          } catch (error) { reject(error); } });
        });
        const timer = setTimeout(() => request.destroy(new TimeoutError()), 8000);
        request.on('close', () => clearTimeout(timer)); request.on('error', reject); request.end(payload);
      });
    } catch (error) { this.close(); throw error; }
    for (const item of events) this.acknowledged.set(item.sourceEventId, Date.now());
    while (this.acknowledged.size > 10000) this.acknowledged.delete(this.acknowledged.keys().next().value!);
    const removedBuckets = new Set<string>();
    for (const path of paths) {
      fs.unlinkSync(path);
      const bucket = dirname(path);
      if (isQueueBucket(basename(bucket))) {
        try { fs.rmdirSync(bucket); removedBuckets.add(bucket); } catch { /* Other queued files can keep a bucket active. */ }
      }
    }
    if (paths.length) {
      if (this.persistence) this.persistence.dirty();
      else {
        const directories = new Set(paths.map(path => dirname(path)));
        for (const bucket of removedBuckets) { directories.delete(bucket); directories.add(dirname(bucket)); }
        for (const directory of directories) syncDirectory(directory);
      }
    }
    this.eventAgeSeconds = Math.max(0, ...events.map(item => Number.isFinite(Date.parse(item.timestamp)) ? (Date.now() - Date.parse(item.timestamp)) / 1000 : 0));
    return queued.length;
  }
}
