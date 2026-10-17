import * as fs from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { recordExecution } from './executions';
import { MAX_RECORD_BYTES } from './event-data';
import { Store } from './store';
import { CommandError, TimeoutError } from './delivery';

export async function* recordLines(input: AsyncIterable<Buffer | string>): AsyncGenerator<string> {
  let chunks: Buffer[] = [], size = 0;
  for await (const value of input) {
    const chunk = typeof value === 'string' ? Buffer.from(value) : value;
    let begin = 0;
    for (let end; (end = chunk.indexOf(10, begin)) >= 0;) {
      const part = chunk.subarray(begin, end + 1); size += part.length;
      if (size > MAX_RECORD_BYTES) throw new Error('Source record exceeds 8MB; cursor retained');
      chunks.push(part); yield Buffer.concat(chunks, size).toString('utf8'); chunks = []; size = 0; begin = end + 1;
    }
    if (begin < chunk.length) { chunks.push(chunk.subarray(begin)); size += chunk.length - begin; }
    if (size > MAX_RECORD_BYTES) throw new Error('Source record exceeds 8MB; cursor retained');
  }
  if (size) yield Buffer.concat(chunks, size).toString('utf8');
}

export interface CommandOptions { accepted?: number[]; timeout?: number; merged?: boolean; disk?: boolean; raw?: boolean; attestExecution?: boolean }
export class Commands {
  constructor(public store: Store) {}
  async *stream(args: string[], options: CommandOptions = {}): AsyncGenerator<string> {
    const root = this.store.path('capture'); fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const base = join(root, randomUUID()), errorPath = base + '.err', outputPath = base + '.out';
    const errorFd = fs.openSync(errorPath, 'wx', 0o600);
    const outputFd = options.disk ? fs.openSync(outputPath, 'wx', 0o600) : undefined;
    const started = Date.now();
    const child = spawn(args[0], args.slice(1), { env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', outputFd ?? 'pipe', options.merged && outputFd !== undefined ? outputFd : errorFd] });
    let expired = false;
    const timer = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, (options.timeout ?? 60) * 1000);
    const completion = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    void completion.catch(() => {});
    try {
      if (!options.disk) yield* recordLines(child.stdout!);
      const code = await completion;
      if (expired) throw new TimeoutError();
      const detail = readBoundedPrefix(options.merged ? outputPath : errorPath, 4096).toString().trim();
      if (!(options.accepted || [0]).includes(code ?? -1) || (code === 1 && !['', '<no matches>'].includes(detail))) {
        const reason = [['No such container', 'removed during collection'], ['does not support reading', 'logging driver does not support reading'], ['invalid character', 'invalid log data']].find(([fragment]) => detail.includes(fragment))?.[1];
        throw new CommandError(code, reason);
      }
      if (options.attestExecution && code === 0 && fs.statSync(errorPath).size === 0 && child.pid) recordExecution(this.store.root, child.pid, args, started);
      if (options.disk) {
        if (options.raw) { for await (const chunk of fs.createReadStream(outputPath, { encoding: 'utf8' })) yield chunk as string; }
        else yield* recordLines(fs.createReadStream(outputPath));
      }
    } finally {
      clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); await completion.catch(() => {});
      fs.closeSync(errorFd); if (outputFd !== undefined) fs.closeSync(outputFd);
      fs.rmSync(errorPath, { force: true }); if (outputFd !== undefined) fs.rmSync(outputPath, { force: true });
    }
  }
  async run(args: string[], options: CommandOptions = {}): Promise<string> {
    let result = '';
    for await (const line of this.stream(args, options)) { result += line; if (Buffer.byteLength(result) > MAX_RECORD_BYTES) throw new Error('Command output exceeds 8MB'); }
    return result;
  }
}

export function readBoundedPrefix(path: string, limit: number): Buffer {
  const fd = fs.openSync(path, 'r'); try { const buffer = Buffer.alloc(limit); return buffer.subarray(0, fs.readSync(fd, buffer, 0, limit, 0)); } finally { fs.closeSync(fd); }
}
