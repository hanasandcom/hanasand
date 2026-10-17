import { fs, join } from './runtime';
import { Config, CollectionError, CommandError, TimeoutError, collectionError, iso, seconds } from './core';
import { DockerSource, dockerJsonFiles } from './docker-files';
import { dockerCliStream } from './source-parsers';
import { DockerFileSources } from './docker-file-sources';

export class Sources extends DockerFileSources {
  async docker(config: Config) {
    if (!process.env.PATH?.split(':').some(path => fs.existsSync(join(path, 'docker')))) return;
    const inventory = await this.commands.run(['docker', 'ps', '-a', '--format', '{{.ID}} {{.Names}}']);
    const containers = inventory.trim().split('\n').filter(Boolean).map(row => row.split(/ (.*)/s).slice(0, 2));
    const checkpoints = this.store.load<Record<string, string>>('docker.json', {}), fileSources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}), failures: string[] = [];
    const current = new Set(containers.map(([id]) => id));
    for (const [id, source] of Object.entries(fileSources)) if (!current.has(id) && !dockerJsonFiles(source).length) {
      try { await this.retireDockerFile(config, id, source); delete fileSources[id]; } catch (error) { failures.push(source.name + ' (retirement notice delivery ' + collectionError(error) + ')'); }
    }
    for (const [id, name] of containers) {
      if (fileSources[id]) continue;
      let since = checkpoints[id] || config.start!;
      if (await this.registerDockerFile(id, name, since)) continue;
      const created = await this.dockerCreatedAt(id); if (created && seconds(created) > seconds(since)) since = created;
      const until = iso(Math.min(Date.now() / 1000 - 1, seconds(since) + 60)); if (seconds(until) <= seconds(since)) continue;
      try {
        await this.store.send(dockerCliStream(config, id, name, this.commands.stream(['docker', 'logs', '--timestamps', '--since', since, '--until', until, id], { disk: true, merged: true })));
        checkpoints[id] = until; this.store.save('docker.json', checkpoints);
      } catch (error) {
        const reason = error instanceof TimeoutError ? 'log read timed out after 60s' : error instanceof CommandError ? error.reason || 'log read exited ' + error.code : 'collection ' + collectionError(error);
        failures.push(name + ' (' + reason + ')');
      }
    }
    if (failures.length) throw new CollectionError('Docker log collection failed for ' + failures.join(', '));
  }
  async collect(config: Config) {
    const failures: string[] = [];
    const sources: Record<string, () => Promise<unknown>> = {
      audit: () => this.audit(config),
      journal: () => this.journal(config),
      docker: () => this.docker(config),
      docker_file_history: () => this.dockerFileSource(config),
      docker_file_live: () => this.dockerFileSource(config, true),
    };
    for (const [name, collect] of Object.entries(sources)) {
      try { await collect(); } catch (error) { failures.push(name + ': ' + collectionError(error)); }
    }
    return failures;
  }
}
