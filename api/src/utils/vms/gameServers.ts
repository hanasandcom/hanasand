export type GameServerPort = { port: number; protocol: 'tcp' | 'udp' }

export const gameServerCatalog = [
    { id: 'game-cs2', label: 'Counter-Strike 2', minMemoryGiB: 8, minDiskGiB: 100, imageTag: 'cs2', ports: [{ port: 27015, protocol: 'udp' }, { port: 27015, protocol: 'tcp' }] },
    { id: 'game-terraria', label: 'Terraria', minMemoryGiB: 2, minDiskGiB: 20, imageTag: null, ports: [{ port: 7777, protocol: 'tcp' }] },
    { id: 'game-factorio', label: 'Factorio', minMemoryGiB: 4, minDiskGiB: 20, imageTag: 'fctr', ports: [{ port: 34197, protocol: 'udp' }] },
    { id: 'game-valheim', label: 'Valheim', minMemoryGiB: 4, minDiskGiB: 30, imageTag: 'vh', ports: [{ port: 2456, protocol: 'udp' }, { port: 2457, protocol: 'udp' }] },
    { id: 'game-luanti', label: 'Luanti', minMemoryGiB: 2, minDiskGiB: 20, imageTag: 'luanti', ports: [{ port: 30000, protocol: 'udp' }] },
    { id: 'game-openra', label: 'OpenRA: Red Alert', minMemoryGiB: 2, minDiskGiB: 20, imageTag: 'orar', ports: [{ port: 1234, protocol: 'tcp' }] },
    { id: 'game-xonotic', label: 'Xonotic', minMemoryGiB: 2, minDiskGiB: 20, imageTag: 'xnt', ports: [{ port: 26000, protocol: 'udp' }] },
    { id: 'game-teeworlds', label: 'Teeworlds', minMemoryGiB: 2, minDiskGiB: 20, imageTag: null, ports: [{ port: 8303, protocol: 'udp' }] },
    { id: 'game-warfork', label: 'Warfork', minMemoryGiB: 2, minDiskGiB: 20, imageTag: 'wf', ports: [{ port: 44400, protocol: 'udp' }] },
    { id: 'game-wolfet', label: 'Wolfenstein: Enemy Territory', minMemoryGiB: 2, minDiskGiB: 20, imageTag: null, ports: [{ port: 27960, protocol: 'udp' }] },
] as const satisfies ReadonlyArray<{ id: string; label: string; minMemoryGiB: number; minDiskGiB: number; imageTag: string | null; ports: ReadonlyArray<GameServerPort> }>

export type GameServerService = typeof gameServerCatalog[number]['id']

export function isGameServerService(value: unknown): value is GameServerService {
    return typeof value === 'string' && gameServerCatalog.some(game => game.id === value)
}

export function getGameServerDefinition(id: string) {
    return gameServerCatalog.find(game => game.id === id)
}

/** The caller accepts only catalog IDs and a validated VM login name. */
export function gameServerSetupScript(id: string, loginName: string) {
    const game = getGameServerDefinition(id)
    if (!game) throw new Error('Unsupported game server.')
    const image = game.imageTag ? `ghcr.io/gameservermanagers/gameserver:${game.imageTag}` : ''
    const firstPort = game.ports[0]
    const maxReadinessAttempts = id === 'game-cs2' ? 10800 : 900
    const progressStage = id === 'game-cs2' ? `game_progress="$(docker exec hanasand-game tail -n 30 /data/log/script/cs2server-steamcmd.log 2>/dev/null | grep -Eo 'progress: [0-9]+([.][0-9]+)?' | tail -1 | awk '{printf "%d", $2}' || true)"
    if [[ "$game_progress" =~ ^[0-9]{1,3}$ ]] && (( game_progress <= 100 )); then
      set_stage "Downloading Counter-Strike 2 game files ($game_progress%)"
    else
      set_stage 'Preparing Counter-Strike 2 server (first install may take several minutes)'
    fi` : `set_stage 'Preparing ${game.label} server (first install may take several minutes)'`
    const socketFlag = firstPort.protocol === 'tcp' ? '-lntH' : '-lunH'
    const firstPortCheck = `ss ${socketFlag} 'sport = :${firstPort.port}' | grep -q ':${firstPort.port}'`
    const portCheck = id === 'game-valheim'
        ? `${firstPortCheck} && ss -lunH 'sport = :2457' | grep -q ':2457'`
        : firstPortCheck
    // The upstream CS2 image runs LinuxGSM monitor in its health check. During
    // startup that can launch a second server before the first is ready.
    const dockerHealthCheck = id === 'game-cs2'
        ? `--health-cmd='timeout 10 gamedig --type protocol-valve 127.0.0.1:27015 | grep -q "Counter-Strike 2"' --health-interval=30s --health-timeout=15s --health-start-period=120s --health-retries=3`
        : ''
    const valheimSecret = id === 'game-valheim' ? valheimSecretSetupScript(loginName) : ''
    const failureDetail = id === 'game-valheim'
        ? 'printf \'Valheim server did not start; inspect its private logs inside the VM.\\n\' >&2'
        : 'docker logs --tail 40 hanasand-game >&2 || true'
    if (id === 'game-terraria') return terrariaSetupScript(loginName, portCheck)
    if (id === 'game-teeworlds') return teeworldsSetupScript(loginName, portCheck)
    if (id === 'game-wolfet') return wolfetSetupScript(loginName, portCheck)

    return `set_stage 'Downloading ${game.label} server image'
run_bounded 1800 docker pull '${image}'
install -d -m 0750 /opt/hanasand-game/data
game_owner="$(id -u '${loginName}'):$(id -g '${loginName}')"
if [[ "$(stat -c '%u:%g' /opt/hanasand-game/data)" != "$game_owner" ]]; then
  set_stage 'Assigning game files to the VM owner'
  run_bounded 1800 chown -hR "$game_owner" /opt/hanasand-game/data
fi
set_stage 'Starting ${game.label} server'
docker run -d --name hanasand-game --network host --restart unless-stopped ${dockerHealthCheck} \\
  --mount type=bind,src=/opt/hanasand-game/data,dst=/data \\
  -e UID="${'$'}{game_owner%:*}" -e GID="${'$'}{game_owner#*:}" -e UPDATE_CHECK=60 \\
  '${image}' >/dev/null
${valheimSecret}
game_health=''
for attempt in $(seq 1 ${maxReadinessAttempts}); do
  game_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' hanasand-game)"
  if [[ "$game_health" == healthy ]] && ${portCheck}; then break; fi
  if [[ "$(docker inspect --format '{{.State.Status}}' hanasand-game)" != running ]]; then
    ${failureDetail}
    exit 1
  fi
  if (( attempt % 15 == 0 )); then
    ${progressStage}
  fi
  sleep 2
done
if [[ "$game_health" != healthy ]] || ! ${portCheck}; then
  ${failureDetail}
  printf '${game.label} server did not become healthy on port ${firstPort.port}.\\n' >&2
  exit 1
fi
`
}

function wolfetSetupScript(loginName: string, portCheck: string) {
    return `set_stage 'Downloading Wolfenstein: Enemy Territory server image'
run_bounded 1800 docker pull etlegacy/server:v2.86.2
install -d -m 0755 -o '${loginName}' -g '${loginName}' /opt/hanasand-game/etmain /opt/hanasand-game/homepath
set_stage 'Downloading Wolfenstein: Enemy Territory game assets'
for asset in pak0 pak1 pak2; do
  asset_path="/opt/hanasand-game/etmain/$asset.pk3"
  case "$asset" in
    pak0) asset_hash='712966b20e06523fe81419516500e499c86b2b4fec823856ddbd333fcb3d26e5' ;;
    pak1) asset_hash='5610fd749024405b4425a7ce6397e58187b941d22092ef11d4844b427df53e5d' ;;
    pak2) asset_hash='a48ab749a1a12ab4d9137286b1f23d642c29da59845b2bafc8f64e052cf06f3e' ;;
  esac
  if [[ -s "$asset_path" ]] && [[ "$(sha256sum "$asset_path" | cut -d ' ' -f 1)" == "$asset_hash" ]]; then continue; fi
  asset_tmp="$(mktemp "/opt/hanasand-game/etmain/$asset.XXXXXXXX.pk3")"
  if ! run_bounded 1800 curl -fsSL --connect-timeout 20 --max-time 1700 --retry 4 --retry-delay 3 "https://mirror.etlegacy.com/etmain/$asset.pk3" -o "$asset_tmp"; then
    rm -f "$asset_tmp"
    exit 1
  fi
  if [[ "$(sha256sum "$asset_tmp" | cut -d ' ' -f 1)" != "$asset_hash" ]]; then
    rm -f "$asset_tmp"
    printf 'Wolfenstein asset %s failed checksum verification.\\n' "$asset" >&2
    exit 1
  fi
  mv "$asset_tmp" "$asset_path"
done
chown '${loginName}:${loginName}' /opt/hanasand-game/etmain/pak{0,1,2}.pk3
cat > /opt/hanasand-game/etmain/etl_server.cfg <<'CONFIG'
set sv_hostname "Hanasand ET Legacy"
set sv_maxclients "20"
set sv_privateclients "0"
set sv_allowDownload "1"
set sv_dlRate "100"
set sv_pure "1"
map battery
CONFIG
chown '${loginName}:${loginName}' /opt/hanasand-game/etmain/etl_server.cfg
set_stage 'Starting Wolfenstein: Enemy Territory server'
docker run -d --name hanasand-game --network host --restart unless-stopped \\
  -e FS_GAME=legacy \\
  --mount type=bind,src=/opt/hanasand-game/etmain,dst=/legacy/server/etmain \\
  --mount type=bind,src=/opt/hanasand-game/homepath,dst=/legacy/homepath \\
  etlegacy/server:v2.86.2 >/dev/null
for attempt in $(seq 1 120); do
  if ${portCheck} && docker logs hanasand-game 2>&1 | grep -F 'Game Initialization completed' >/dev/null; then break; fi
  if [[ "$(docker inspect --format '{{.State.Status}}' hanasand-game)" != running ]]; then
    docker logs --tail 40 hanasand-game >&2 || true
    exit 1
  fi
  sleep 2
done
${portCheck}
docker logs hanasand-game 2>&1 | grep -F 'Game Initialization completed' >/dev/null
`
}

function valheimSecretSetupScript(loginName: string) {
    // LinuxGSM's current default forces -crossplay, which prevents direct-IP
    // Steam connections. Keep its other parameters while omitting that flag.
    const directIpParameters = 'startparameters="-name \'${servername}\' -password ${serverpassword} -port ${port} -world ${worldname} -public ${public} -savedir \'${savedir}\' -saveinterval ${saveinterval} -backups ${backups} -backupshort ${backupshort} -backuplong ${backuplong} -instanceid ${instanceid} ${logFile:+ -logFile \'${logFile}\'} ${worldmodifiers:+ ${worldmodifiers}}"'
    return `set_stage 'Configuring Valheim server password'
valheim_config_dir='/opt/hanasand-game/data/config-lgsm/vhserver'
valheim_binary='/opt/hanasand-game/data/serverfiles/valheim_server.x86_64'
for attempt in $(seq 1 900); do
  if [[ -d "$valheim_config_dir" && -x "$valheim_binary" ]]; then break; fi
  if [[ "$(docker inspect --format '{{.State.Status}}' hanasand-game)" != running ]]; then
    printf 'Valheim container stopped; inspect its private logs inside the VM.\\n' >&2
    exit 1
  fi
  sleep 2
done
test -d "$valheim_config_dir"
test -x "$valheim_binary"
valheim_secret_file="$valheim_config_dir/secrets-vhserver.cfg"
valheim_config_changed=false
if ! grep -Eq '^serverpassword=' "$valheim_secret_file" 2>/dev/null; then
  valheim_password_file='/opt/hanasand-game/valheim-password'
  if [[ ! -s "$valheim_password_file" ]]; then
    valheim_password="$(openssl rand -hex 8)"
    install -m 0600 -o '${loginName}' -g '${loginName}' /dev/null "$valheim_password_file"
    printf '%s\\n' "$valheim_password" > "$valheim_password_file"
  else
    valheim_password="$(cat "$valheim_password_file")"
  fi
  if [[ ! "$valheim_password" =~ ^[0-9a-f]{16}$ ]]; then
    printf 'Valheim password file has an invalid format.\\n' >&2
    exit 1
  fi
  chown '${loginName}:${loginName}' "$valheim_password_file"
  chmod 0600 "$valheim_password_file"
  install -m 0600 -o '${loginName}' -g '${loginName}' /dev/null "$valheim_secret_file"
  printf 'serverpassword="%s"\\n' "$valheim_password" > "$valheim_secret_file"
  valheim_config_changed=true
fi
if ! grep -Eq '^startparameters=' "$valheim_secret_file" 2>/dev/null; then
  cat >> "$valheim_secret_file" <<'CONFIG'
${directIpParameters}
CONFIG
  valheim_config_changed=true
fi
if [[ "$valheim_config_changed" == true ]]; then
  chown '${loginName}:${loginName}' "$valheim_secret_file"
  chmod 0600 "$valheim_secret_file"
  docker restart hanasand-game >/dev/null
fi
`
}

function teeworldsSetupScript(loginName: string, portCheck: string) {
    return `set_stage 'Starting Teeworlds server'
systemctl disable --now teeworlds-server.service >/dev/null 2>&1 || true
install -d -m 0755 -o '${loginName}' -g '${loginName}' /opt/hanasand-game
cat > /opt/hanasand-game/server.cfg <<'CONFIG'
sv_name Hanasand Teeworlds
sv_port 8303
sv_max_clients 16
sv_register 1
CONFIG
chown '${loginName}:${loginName}' /opt/hanasand-game/server.cfg
cat > /etc/systemd/system/hanasand-game.service <<'SERVICE'
[Unit]
Description=Teeworlds dedicated server
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=${loginName}
WorkingDirectory=/opt/hanasand-game
ExecStart=/usr/games/teeworlds-server -f server.cfg
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable --now hanasand-game.service
for attempt in $(seq 1 120); do
  if ${portCheck}; then break; fi
  if ! systemctl is-active --quiet hanasand-game.service; then
    journalctl -u hanasand-game.service -n 40 --no-pager >&2 || true
    exit 1
  fi
  sleep 1
done
${portCheck}
`
}

function terrariaSetupScript(loginName: string, portCheck: string) {
    return `set_stage 'Downloading official Terraria dedicated server'
terraria_release_list="$(mktemp /tmp/hanasand-terraria-releases.XXXXXX)"
curl -fsSL --max-time 30 https://terraria.org/api/get/dedicated-servers-names -o "$terraria_release_list"
terraria_archive_name="$(python3 - "$terraria_release_list" <<'PY'
import json, re, sys
with open(sys.argv[1], encoding='utf-8') as source:
    names = json.load(source)
if not isinstance(names, list):
    raise SystemExit('Terraria did not return a server release list.')
name = next((item for item in names if isinstance(item, str) and re.fullmatch(r'terraria-server-[0-9]+\\.zip', item)), None)
if not name:
    raise SystemExit('Terraria did not publish a PC dedicated server archive.')
print(name)
PY
)"
rm -f "$terraria_release_list"
install -d -m 0755 /opt/hanasand-game
terraria_archive="/tmp/$terraria_archive_name"
curl -fsSL --max-time 180 "https://terraria.org/api/download/pc-dedicated-server/$terraria_archive_name" -o "$terraria_archive"
run_bounded 180 python3 - "$terraria_archive" /opt/hanasand-game <<'PY'
import pathlib, sys, zipfile
archive, target = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
if archive.stat().st_size > 150_000_000:
    raise SystemExit('Terraria dedicated server archive exceeded 150 MB.')
with zipfile.ZipFile(archive) as source:
    linux = [item for item in source.infolist() if len(pathlib.PurePosixPath(item.filename).parts) >= 3 and pathlib.PurePosixPath(item.filename).parts[1] == 'Linux']
    if not linux or len(linux) > 200:
        raise SystemExit('Terraria archive did not contain a bounded Linux server.')
    for item in linux:
        parts = pathlib.PurePosixPath(item.filename).parts
        relative = pathlib.PurePosixPath(*parts[2:])
        if not relative.parts or relative.is_absolute() or '..' in relative.parts or (item.external_attr >> 16) & 0o170000 == 0o120000:
            continue
        destination = target.joinpath(*relative.parts)
        if item.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        with source.open(item) as raw, destination.open('wb') as output:
            while chunk := raw.read(1024 * 1024):
                output.write(chunk)
server = target / 'TerrariaServer.bin.x86_64'
if not server.is_file():
    raise SystemExit('Terraria archive did not contain the Linux x86_64 server.')
server.chmod(0o755)
PY
rm -f "$terraria_archive"
install -d -m 0755 /opt/hanasand-game/worlds
cat > /opt/hanasand-game/serverconfig.txt <<'CONFIG'
world=/opt/hanasand-game/worlds/world.wld
autocreate=1
worldname=Hanasand
maxplayers=8
port=7777
secure=1
noupnp=1
CONFIG
chown -R '${loginName}:${loginName}' /opt/hanasand-game
cat > /etc/systemd/system/hanasand-game.service <<'SERVICE'
[Unit]
Description=Terraria dedicated server
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=${loginName}
WorkingDirectory=/opt/hanasand-game
ExecStart=/opt/hanasand-game/TerrariaServer.bin.x86_64 -config /opt/hanasand-game/serverconfig.txt
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
SERVICE
set_stage 'Creating Terraria world and starting server'
systemctl daemon-reload
systemctl enable --now hanasand-game.service
for attempt in $(seq 1 300); do
  if ${portCheck}; then break; fi
  if ! systemctl is-active --quiet hanasand-game.service; then
    journalctl -u hanasand-game.service -n 40 --no-pager >&2 || true
    exit 1
  fi
  sleep 1
done
${portCheck}
`
}
