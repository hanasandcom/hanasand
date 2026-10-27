# Isolated VM staging

This Compose stack runs the Hanasand UI and API against a private, synthetic PostgreSQL database and a fixed staging identity. It does not load production credentials or production records. All published ports bind to loopback so access is through an SSH tunnel.

The staging frontend accepts device proofs for its exact `http://127.0.0.1:3388` origin only in images built with `HANASAND_STAGE_BUILD=1`; production images keep the HTTPS-only proof origin.

On Inspur, the API uses the restricted `hns-stage` LXD project and its staging-only network. The existing `hei` container is preserved. Project limits change as staging fixtures are added or removed, so inspect `lxc project show hns-stage` before each test; do not assume an old quota is still current. Check configured disk volumes with `lxc storage volume list default --project hns-stage` and physical headroom with `df -h /` before creating a VM. LXD checks aggregate project disk limits, while those limits do not reserve physical disk space for image downloads, unpacking or package installation. Staging VMs have outbound internet access for package installers, but no public service route. If a disposable test needs a temporary quota change, record the prior value and restore it after deleting the test VM.

From the Hanasand checkout on Inspur, clone the public `articles` repository into a
temporary directory and pass it as a named Docker build context. The frontend
Dockerfile requires this context for its source checks; it must not try to pull an
`articles` image from a registry.

```sh
articles_dir=$(mktemp -d /tmp/hanasand-articles-source.XXXXXX)
trap 'rm -rf "$articles_dir"' EXIT
git clone --quiet --depth 1 --branch main https://github.com/hanasandcom/articles.git "$articles_dir"
ARTICLES_SOURCE_CONTEXT="$articles_dir" HANASAND_RELEASE_COMMIT=$(git rev-parse HEAD) docker compose \
  --project-name vm-stage-rehearsal \
  --env-file /home/hanasand/identity/.env.ai.staging \
  -f docker-compose.vm-stage.yml \
  -f docker-compose.vm-stage.inspur.yml \
  up -d --build vm-stage-api vm-stage-frontend
```

From a workstation, open an SSH tunnel:

```sh
ssh -N -L 3388:127.0.0.1:3388 -L 8388:127.0.0.1:8388 \
  -L 3390:127.0.0.1:3390 -L 8389:172.31.254.6:19182 inspur
```

Then visit `http://127.0.0.1:3390`, choose **Open staging**, and test at `http://127.0.0.1:3388/ai`. The stage user owns the synthetic **Cashflow Staging** organization. The UI sends REST requests to the isolated VM staging API and GPT WebSocket requests to the staging AI service through separate tunnel ports. The API and database are available only through loopback ports.

The production VM project, database, DNS, VM gateway, host credentials, and provider routes are not mounted into this stack.

## Inspur VM lifecycle rehearsal

The Inspur rehearsal uses the separate restricted LXD project `hns-stage`. Before starting it, confirm `lxc project show hns-stage` still reports `restricted: "true"`, `restricted.networks.access: hanai-stage0`, and finite `limits.instances` and `limits.virtual-machines`. The existing `hei` container must remain untouched; the project quota permits one disposable VM alongside it. Add the dedicated `VM_STATUS_INGEST_TOKEN` to `/home/hanasand/identity/.env.ai.staging`; never commit or print the token. This VM-only credential can publish only the lifecycle check and cannot publish container inventory or other monitoring rows. The lifecycle monitor publishes only the aggregate `Virtual Machines` result to the public status ingest URL, and the status service redacts its private diagnostics. Results remain fresh for seven hours to match the six-hour probe interval; older results are rejected and shown as unverified.

Run the rehearsal with the staging-only overlay:

```sh
ARTICLES_SOURCE_CONTEXT="$articles_dir" HANASAND_RELEASE_COMMIT=$(git rev-parse HEAD) docker compose \
  --project-name vm-stage-rehearsal \
  --env-file /home/hanasand/identity/.env.ai.staging \
  -f docker-compose.vm-stage.yml \
  -f docker-compose.vm-stage.inspur.yml \
  up -d --build vm-stage-api vm-stage-frontend
```

The overlay sets `LXD_PROJECT=hns-stage` for API actions, connects only the staging API and frontend to the private staging AI network, and enables the lifecycle monitor against the same project. Its support key comes only from `/home/hanasand/identity/.env.ai.staging`. The monitor checks project restrictions before creating anything and scopes every instance operation and cleanup request to `hns-stage`. It uses the Ubuntu 24.04 desktop VM image. Do not run this overlay against production or remove the project restrictions or quotas.
