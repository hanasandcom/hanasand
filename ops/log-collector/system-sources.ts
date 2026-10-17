import { fs, randomUUID, sleep } from './runtime';
import { Store, Commands } from './core';
import { Config, LogEvent, event, iso, seconds } from './event-data';
import { CommandError, CollectionError } from './delivery';
import { auditEvents, localAuditDate } from './source-parsers';
import { executionReceipts } from './executions';
import { enrichModelProbe } from './model-probes';
import { attestReadinessAudit } from './readinessAttestation';
import { auditdResumeHeadroom } from './configuration';

export class SystemSources {
  constructor(public store: Store, public commands = new Commands(store)) {}
  async auditdHealthProbe() {
    const writeAndFind = async () => {
      const id = randomUUID(), marker = 'hanasand-audit-health-' + id;
      await this.commands.run(['auditctl', '-m', marker], { timeout: 10 });
      const deadline = Date.now() + 5000;
      do {
        const recent = await this.commands.run(['tail', '-c', '1048576', '/var/log/audit/audit.log'], { timeout: 5 });
        if (recent.includes(id)) return true;
        await sleep(250);
      } while (Date.now() < deadline);
      return false;
    };
    if (await writeAndFind()) return;
    if (!auditdResumeHeadroom()) throw new CollectionError('auditd stopped writing and configured disk headroom is not available');
    await this.commands.run(['auditctl', '--signal', 'resume'], { timeout: 10 });
    if (!await writeAndFind()) throw new CollectionError('auditd did not resume writing after a safe resume request');
  }
  async journal(config: Config, live = false) {
    const stateName = live ? 'journal-live.json' : 'journal.json';
    const checkpoint = this.store.load<string | { cursor?: string | null; since?: string } | null>(stateName, null);
    let cursor = typeof checkpoint === 'string' ? checkpoint : checkpoint?.cursor;
    const savedSince = typeof checkpoint === 'object' && checkpoint ? checkpoint.since : undefined;
    let since = savedSince || (live ? iso(Date.now() / 1000 - 60) : config.start!);
    const savedSinceAt = Date.parse(savedSince || '');
    if (live && (!Number.isFinite(savedSinceAt) || Date.now() - savedSinceAt > 60000)) {
      cursor = undefined;
      since = iso(Date.now() / 1000 - 60);
    }
    const args = ['journalctl', '--no-pager', '-o', 'json', '--show-cursor', '--lines=+1000'];
    async function* consume(output: AsyncIterable<string>): AsyncGenerator<LogEvent> {
      for await (const line of output) {
        if (!line.startsWith('{')) continue;
        const row = JSON.parse(line); cursor = row.__CURSOR; since = iso(Number(row.__REALTIME_TIMESTAMP) / 1e6);
        const priority = Number(row.PRIORITY ?? 6), level = priority <= 2 ? 'fatal' : priority === 3 ? 'error' : priority === 4 ? 'warn' : priority === 7 ? 'debug' : 'info';
        const service = String(row.SYSLOG_IDENTIFIER || row._SYSTEMD_UNIT || 'system').replace(/\.service$/, '');
        if (service === 'hanasand-log-collector') continue;
        const log = event(config, 'journal:' + cursor, service, String(row.MESSAGE ?? ''), since, { collector: 'journal', pid: row._PID ?? null, user: { id: row._UID ?? null }, unit: row._SYSTEMD_UNIT ?? null }, level);
        yield typeof cursor === 'string' ? enrichModelProbe(log, cursor) : log;
      }
    }
    try { await this.store.send(consume(this.commands.stream([...args, ...(cursor ? ['--after-cursor', cursor] : ['--since', since])], { timeout: live ? 5 : 60, attestExecution: true }))); }
    catch (error) { if (!(error instanceof CommandError) || !cursor) throw error; await this.store.send(consume(this.commands.stream([...args, '--since', since], { timeout: live ? 5 : 60 }))); }
    if (cursor || live) this.store.save(stateName, { cursor: cursor || null, since });
  }
  async audit(config: Config, live = false) {
    const prefix = live ? 'audit-live' : 'audit', pending = this.store.path(prefix + '.pending');
    const checkpoint = this.store.readRaw(prefix + '.checkpoint');
    const match = checkpoint?.match(/^output=.*?\s(\d+(?:\.\d+)?):\d+/m);
    const timestamp = match ? Number(match[1]) : null, reuse = checkpoint !== null && (!live || timestamp !== null && timestamp >= Date.now() / 1000 - 60);
    if (reuse) fs.writeFileSync(pending, checkpoint!); else fs.rmSync(pending, { force: true });
    const args = ['ausearch', '--input-logs', '--checkpoint', pending, '-k', 'hanasand_exec', '--raw'];
    if (live && !reuse) args.push('--start', ...localAuditDate(Date.now() / 1000 - 60));
    let end: number | undefined;
    if (!live) {
      const beginning = Math.max(timestamp ?? 0, this.store.load<number>('audit-window.json', 0), seconds(config.start || iso(Date.now() / 1000 - 60)));
      end = Math.min(Math.floor(Date.now() / 1000) - 1, Math.floor(beginning) + 60); if (end <= beginning) return;
      args.push('--end', ...localAuditDate(end)); if (checkpoint === null) args.push('--start', ...localAuditDate(beginning));
    }
    const read = (command: string[]) => this.store.send(attestReadinessAudit(auditEvents(this.commands.stream(command, { accepted: [0, 1], timeout: live && reuse ? 5 : 60, disk: true, attestExecution: true }), config, (pid, time) => executionReceipts(this.store.root, pid, time)), this.store.root, config.host));
    try { await read(args); }
    catch (error) { if (!(error instanceof CommandError) || ![10, 11, 12].includes(error.code ?? -1) || !fs.existsSync(pending)) throw error; await read([...args, '--start', 'checkpoint']); }
    if (fs.existsSync(pending)) { this.store.saveRaw(prefix + '.checkpoint', fs.readFileSync(pending, 'utf8')); fs.unlinkSync(pending); }
    if (end !== undefined) this.store.save('audit-window.json', end);
  }
}
