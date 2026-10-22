import type { VmProvisionOptions } from './provisionOnHost.ts'
import { validateVmLoginName } from './vmLoginUserData.ts'
import { normalizeUbuntuAptPackages } from './ubuntuAptPackages.ts'

const setupStatePath = '/var/lib/hanasand-vm-setup/status'

export function vmSetupUserData(name: string, options: VmProvisionOptions) {
    validateVmLoginName(name)
    const services = [...new Set(options.services || [])]
    const aptPackages = normalizeUbuntuAptPackages(options.aptPackages)
    if (!aptPackages) {
        throw new Error('Custom Ubuntu package names must be valid Debian package identifiers, with no more than 12 packages.')
    }
    const website = options.websiteHtml ? Buffer.from(options.websiteHtml).toString('base64') : ''
    const memoryGb = Number.parseInt(options.resources?.memory || '2', 10)
    const minecraftMemoryGb = Math.max(1, Math.floor(memoryGb * 0.75))
    const script = createSetupScript(name, services, options.minecraftServerType || 'PAPER', website, minecraftMemoryGb, aptPackages)
    const config = {
        hostname: name,
        manage_etc_hosts: true,
        users: [{ name, shell: '/bin/bash', lock_passwd: true }],
        write_files: [{
            path: '/usr/local/sbin/hanasand-vm-setup',
            permissions: '0755',
            owner: 'root:root',
            content: script,
        }],
        runcmd: [
            ['sh', '-lc', `grep -Eq "^127\\.0\\.1\\.1[[:space:]]+.*[[:space:]]${name}([[:space:]]|$)|^127\\.0\\.1\\.1[[:space:]]+${name}([[:space:]]|$)" /etc/hosts || printf "127.0.1.1 ${name}\\n" >> /etc/hosts`],
            ['/usr/local/sbin/hanasand-vm-setup'],
        ],
    }
    return `#cloud-config\n${yamlObject(config)}`
}

function yamlObject(value: Record<string, unknown>) {
    // JSON objects and strings are valid YAML, which keeps user HTML and shell text escaped.
    return JSON.stringify(value, null, 2)
}

function createSetupScript(name: string, services: string[], minecraftType: string, websiteBase64: string, minecraftMemoryGb: number, customAptPackages: string[]) {
    const selected = JSON.stringify(services)
    const selectedBase64 = Buffer.from(selected).toString('base64')
    const minecraft = services.includes('minecraft-java')
        ? minecraftSetup(name, minecraftType, minecraftMemoryGb)
        : ''
    const website = websiteBase64
        ? `install -d -m 0755 /var/www/html\nprintf '%s' '${websiteBase64}' | base64 -d > /var/www/html/index.html\nchown www-data:www-data /var/www/html/index.html\n`
        : ''
    const installCustomPackages = customAptPackages.length ? `apt_packages+=( ${customAptPackages.map(packageName => `'${packageName}'`).join(' ')} )` : ''
    return `#!/usr/bin/env bash
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
state_file='${setupStatePath}'
install -d -m 0755 /var/lib/hanasand-vm-setup
setup_stage='Starting setup'
write_state() {
  if [[ "$1" == Provisioning ]]; then setup_stage=$2; fi
  printf '%s\\t%s\\n' "$1" "$2" > "$state_file"
}
set_stage() { setup_stage=$1; write_state Provisioning "$1"; }
report_setup_error() { write_state Error "Service setup failed during \${setup_stage}. Check VM logs for details (line $1)."; }
trap 'report_setup_error "$LINENO"' ERR
set_stage 'Preparing selected services'
services="$(printf '%s' '${selectedBase64}' | base64 -d)"
apt_packages=()
if printf '%s' "$services" | grep -Eq '"(nodejs|bun|docker|minecraft-java)"'; then
  set_stage 'Preparing secure downloads'
  apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq
  apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 install -y --no-install-recommends ca-certificates curl gnupg unzip
fi
if (( ${customAptPackages.length} > 0 )) && ! printf '%s' "$services" | grep -Eq '"(nodejs|bun|docker|minecraft-java)"'; then
  set_stage 'Refreshing package index'
  apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq
fi
if printf '%s' "$services" | grep -q '"postgresql"'; then apt_packages+=(postgresql postgresql-contrib); fi
if printf '%s' "$services" | grep -q '"mysql"'; then apt_packages+=(mysql-server); fi
if printf '%s' "$services" | grep -q '"redis"'; then apt_packages+=(redis-server); fi
if printf '%s' "$services" | grep -q '"sqlite"'; then apt_packages+=(sqlite3); fi
if printf '%s' "$services" | grep -q '"python"'; then apt_packages+=(python3 python3-pip python3-venv); fi
if printf '%s' "$services" | grep -q '"rust"'; then apt_packages+=(rustc cargo); fi
if printf '%s' "$services" | grep -q '"ruby"'; then apt_packages+=(ruby ruby-dev); fi
if printf '%s' "$services" | grep -q '"cpp"'; then apt_packages+=(build-essential); fi
if printf '%s' "$services" | grep -q '"java"' && ! printf '%s' "$services" | grep -q '"minecraft-java"'; then apt_packages+=(default-jdk-headless); fi
if printf '%s' "$services" | grep -q '"go"'; then apt_packages+=(golang-go); fi
if printf '%s' "$services" | grep -q '"php"'; then apt_packages+=(php-cli php-curl php-mbstring php-xml composer); fi
if printf '%s' "$services" | grep -q '"nginx"' || printf '%s' "$services" | grep -q '"website"'; then apt_packages+=(nginx curl); fi
if printf '%s' "$services" | grep -q '"minecraft-java"'; then apt_packages+=(curl jq tar iproute2); fi
${installCustomPackages}
if printf '%s' "$services" | grep -q '"nodejs"'; then
  curl -fsSL --retry 3 --retry-delay 2 https://deb.nodesource.com/setup_24.x -o /tmp/hanasand-nodesource.sh
  bash /tmp/hanasand-nodesource.sh
  apt_packages+=(nodejs)
fi
if printf '%s' "$services" | grep -q '"docker"'; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL --retry 3 --retry-delay 2 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  apt_packages+=(docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin)
fi
if (( \${#apt_packages[@]} > 0 )); then
  set_stage 'Installing selected packages'
  if ! printf '%s' "$services" | grep -q '"nodejs"' || printf '%s' "$services" | grep -q '"docker"'; then
    apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq
  fi
  apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 install -y --no-install-recommends "\${apt_packages[@]}"
fi
if printf '%s' "$services" | grep -q '"bun"'; then
  set_stage 'Installing Bun'
  curl -fsSL --retry 3 --retry-delay 2 https://bun.sh/install | bash
  install -m 0755 /root/.bun/bin/bun /usr/local/bin/bun
fi
if printf '%s' "$services" | grep -q '"minecraft-java"'; then
  java_version=25
  java_image_type=jre
  if printf '%s' "$services" | grep -q '"java"'; then java_image_type=jdk; fi
  set_stage "Installing Java $java_version"
  java_arch="$(uname -m)"
  case "$java_arch" in x86_64) java_arch=x64 ;; aarch64) java_arch=aarch64 ;; *) write_state Error 'Java is not supported on this host architecture.'; exit 1 ;; esac
  install -d -m 0755 "/opt/hanasand/java$java_version"
  curl -fsSL --retry 3 --retry-delay 2 "https://api.adoptium.net/v3/binary/latest/$java_version/ga/linux/$java_arch/$java_image_type/hotspot/normal/eclipse" -o "/tmp/hanasand-java$java_version.tar.gz"
  tar -xzf "/tmp/hanasand-java$java_version.tar.gz" -C "/opt/hanasand/java$java_version" --strip-components=1
  ln -sfn "/opt/hanasand/java$java_version/bin/java" /usr/local/bin/java
  ln -sfn "/opt/hanasand/java$java_version/bin/javac" /usr/local/bin/javac
fi
if printf '%s' "$services" | grep -q '"docker"'; then
  set_stage 'Starting Docker'
  systemctl enable --now docker
  systemctl is-active --quiet docker
  docker version --format '{{.Server.Version}}' >/dev/null
  docker compose version >/dev/null
  usermod -aG docker '${name}'
fi
set_stage 'Checking selected services'
if printf '%s' "$services" | grep -q '"nodejs"'; then node --version; npm --version; fi
if printf '%s' "$services" | grep -q '"bun"'; then bun --version; fi
if printf '%s' "$services" | grep -q '"python"'; then python3 --version; python3 -m pip --version; fi
if printf '%s' "$services" | grep -q '"rust"'; then rustc --version; cargo --version; fi
if printf '%s' "$services" | grep -q '"ruby"'; then ruby --version; gem --version; fi
if printf '%s' "$services" | grep -q '"cpp"'; then gcc --version >/dev/null; g++ --version >/dev/null; make --version >/dev/null; fi
if printf '%s' "$services" | grep -q '"java"' || printf '%s' "$services" | grep -q '"minecraft-java"'; then java -version; fi
if printf '%s' "$services" | grep -q '"go"'; then go version; fi
if printf '%s' "$services" | grep -q '"php"'; then php --version >/dev/null; composer --version >/dev/null; fi
if printf '%s' "$services" | grep -q '"sqlite"'; then sqlite3 --version; fi
if printf '%s' "$services" | grep -q '"postgresql"'; then set_stage 'Starting PostgreSQL'; systemctl enable --now postgresql; systemctl is-active --quiet postgresql; fi
if printf '%s' "$services" | grep -q '"mysql"'; then set_stage 'Starting MySQL'; systemctl enable --now mysql; systemctl is-active --quiet mysql; fi
if printf '%s' "$services" | grep -q '"redis"'; then set_stage 'Starting Redis'; systemctl enable --now redis-server; systemctl is-active --quiet redis-server; fi
if printf '%s' "$services" | grep -q '"nginx"'; then set_stage 'Starting Nginx'; systemctl enable --now nginx; systemctl is-active --quiet nginx; nginx -t; fi
if printf '%s' "$services" | grep -q '"postgresql"'; then set_stage 'Checking PostgreSQL'; pg_isready; fi
if printf '%s' "$services" | grep -q '"mysql"'; then set_stage 'Checking MySQL'; mysqladmin ping --silent; fi
if printf '%s' "$services" | grep -q '"redis"'; then set_stage 'Checking Redis'; redis-cli ping | grep -qx PONG; fi
if printf '%s' "$services" | grep -q '"website"'; then
  set_stage 'Publishing website'
  ${website}
  nginx -t
  curl -fsS http://127.0.0.1/ >/dev/null
fi
${minecraft}
write_state Running 'Setup complete'
`
}

/* eslint-disable @stylistic/quotes -- generated bash keeps its shell quoting inside template literals. */
function minecraftSetup(name: string, type: string, memoryGb: number) {
    const safeType = ['PAPER', 'VANILLA', 'FABRIC', 'QUILT', 'NEOFORGE', 'PURPUR', 'FOLIA'].includes(type) ? type : 'PAPER'
    let download: string
    if (safeType === 'PAPER' || safeType === 'FOLIA') {
        const project = safeType.toLowerCase()
        download = `project='${project}'\nuser_agent='Hanasand VM Provisioner/1.0 (https://hanasand.com)'\nversion="$(curl -fsSL --retry 3 -H "User-Agent: $user_agent" "https://fill.papermc.io/v3/projects/$project" | jq -r '.versions | to_entries[0] | .value[0]')"\nbuilds="$(curl -fsSL --retry 3 -H "User-Agent: $user_agent" "https://fill.papermc.io/v3/projects/$project/versions/$version/builds")"\nserver_url="$(printf '%s' "$builds" | jq -r 'map(select(.channel == "STABLE")) | .[0].downloads["server:default"].url // empty')"\ntest -n "$server_url"\ncurl -fsSL --retry 3 "$server_url" -o /opt/minecraft/server.jar\n`
    } else if (safeType === 'PURPUR') {
        download = `version="$(curl -fsSL --retry 3 https://api.purpurmc.org/v2/purpur | jq -r '.versions[-1]')"\ncurl -fsSL --retry 3 "https://api.purpurmc.org/v2/purpur/$version/latest/download" -o /opt/minecraft/server.jar\n`
    } else if (safeType === 'VANILLA') {
        download = `version_url="$(curl -fsSL --retry 3 https://launchermeta.mojang.com/mc/game/version_manifest_v2.json | jq -r '.latest.release as $v | .versions[] | select(.id == $v) | .url')"\nserver_url="$(curl -fsSL --retry 3 "$version_url" | jq -r '.downloads.server.url')"\ncurl -fsSL --retry 3 "$server_url" -o /opt/minecraft/server.jar\n`
    } else if (safeType === 'FABRIC' || safeType === 'QUILT') {
        const domain = safeType === 'FABRIC' ? 'meta.fabricmc.net' : 'meta.quiltmc.org'
        const endpoint = safeType === 'FABRIC' ? 'v2/versions/loader' : 'v3/versions/loader'
        download = `game_version="$(curl -fsSL --retry 3 https://launchermeta.mojang.com/mc/game/version_manifest_v2.json | jq -r '.latest.release')"\nloader_version="$(curl -fsSL --retry 3 https://${domain}/${endpoint} | jq -r '.[0].loader.version')"\ninstaller_version="$(curl -fsSL --retry 3 https://${domain}/v${safeType === 'FABRIC' ? '2' : '3'}/versions/installer | jq -r '.[0].version')"\ncurl -fsSL --retry 3 "https://${domain}/${endpoint}/$game_version/$loader_version/$installer_version/server/jar" -o /opt/minecraft/server.jar\n`
    } else {
        download = `installer="$(curl -fsSL --retry 3 https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml | sed -n 's:.*<latest>\\([^<]*\\)</latest>.*:\\1:p')"\ntest -n "$installer"\ncurl -fsSL --retry 3 "https://maven.neoforged.net/releases/net/neoforged/neoforge/$installer/neoforge-$installer-installer.jar" -o /opt/minecraft/installer.jar\n(cd /opt/minecraft && java -jar installer.jar --installServer)\nif [[ -f /opt/minecraft/run.sh ]]; then install -m 0755 /opt/minecraft/run.sh /opt/minecraft/start.sh; else exit 1; fi\n`
    }
    const startCommand = safeType === 'NEOFORGE' ? './start.sh nogui' : `java -Xms1G -Xmx${memoryGb}G -jar /opt/minecraft/server.jar --nogui`
    return `write_state Provisioning 'Installing Minecraft ${safeType}'\ninstall -d -o '${name}' -g '${name}' /opt/minecraft\ncd /opt/minecraft\n${download}printf 'eula=true\\n' > eula.txt\nchown -R '${name}:${name}' /opt/minecraft\ncat > /etc/systemd/system/hanasand-minecraft.service <<'SERVICE'\n[Unit]\nDescription=Minecraft ${safeType} server\nAfter=network-online.target\nWants=network-online.target\n[Service]\nUser=${name}\nWorkingDirectory=/opt/minecraft\nExecStart=/bin/bash -lc '${startCommand}'\nRestart=on-failure\nRestartSec=5\n[Install]\nWantedBy=multi-user.target\nSERVICE\nsystemctl daemon-reload\nsystemctl enable --now hanasand-minecraft.service\nfor attempt in {1..120}; do\n  if ss -lntH 'sport = :25565' | grep -q LISTEN; then break; fi\n  sleep 1\ndone\nss -lntH 'sport = :25565' | grep -q LISTEN\n`
}
/* eslint-enable @stylistic/quotes */
