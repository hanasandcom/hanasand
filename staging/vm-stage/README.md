# Local VM staging

This Compose stack runs the Hanasand UI and API against a private, synthetic PostgreSQL database and a fixed staging identity. It does not load production credentials or production records. All published ports bind to loopback so access is through an SSH tunnel.

The API receives `LXD_PROJECT=hanasand-vm-stage-candidate`; provisioning, status, console, metrics and disk-usage requests are scoped to that LXD project. The isolated host project limit is two instances, four CPUs and 4 GiB RAM. One 1-vCPU, 2-GiB container is already present, leaving capacity for one small 1-vCPU, 2-GiB test VM. Staging VMs have outbound internet access for package installers, but no public service route. Check the host's free storage and load before creating a VM; the project quota does not guarantee host capacity.

From the Hanasand checkout on the OVH host, start it with:

```sh
docker compose -f docker-compose.vm-stage.yml up -d --build
```

From a workstation, open an SSH tunnel:

```sh
ssh -N -L 3388:127.0.0.1:3388 -L 8388:127.0.0.1:8388 -L 3390:127.0.0.1:3390 ovh
```

Then visit `http://127.0.0.1:3390`, choose **Open staging**, and test at `http://127.0.0.1:3388/vms`. The stage user owns the synthetic **Cashflow Staging** organization. The API and database are available only through their loopback tunnel ports.

The production VM project, database, DNS, VM gateway, host credentials, and provider routes are not mounted into this stack.

## Inspur VM lifecycle rehearsal

The Inspur rehearsal uses the separate restricted LXD project `hns-stage`. Before starting it, confirm `lxc project show hns-stage` still reports `restricted: "true"`, a non-empty `restricted.networks.access`, and finite `limits.instances` and `limits.virtual-machines`. The existing `hei` container is expected to remain untouched; the project quota permits one disposable VM alongside it.

Run the rehearsal with the staging-only overlay:

```sh
docker compose -p vm-stage-rehearsal -f docker-compose.vm-stage.yml -f docker-compose.vm-stage.inspur.yml up -d --build vm-stage-api
```

The overlay sets `LXD_PROJECT=hns-stage` for API actions and enables the lifecycle monitor with the same explicit project. The monitor checks the project restrictions before creating anything, scopes every instance operation and cleanup request to `hns-stage`, and uses the public Ubuntu 24.04 desktop VM image. Do not run this overlay against production or remove the project restrictions/quotas.
