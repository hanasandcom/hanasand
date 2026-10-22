# Local VM staging

This Compose stack runs the Hanasand UI and API against a private, synthetic PostgreSQL database and a fixed staging identity. It does not load production credentials or production records. All published ports bind to loopback so access is through an SSH tunnel.

The API receives `LXD_PROJECT=vms-staging-20261022`; provisioning, status, console, metrics and disk-usage requests are scoped to that LXD project. The current host project limit is four instances, eight CPUs and 16 GiB RAM, with network access restricted to `lxdbr0`. Staging VMs have outbound internet access for package installers, but no public service route. Check the host's free storage and load before creating a VM; the project quota does not guarantee host capacity.

From the Hanasand checkout on the OVH host, start it with:

```sh
docker compose -f docker-compose.vm-stage.yml up -d --build
```

From a workstation, open an SSH tunnel:

```sh
ssh -N -L 3188:127.0.0.1:3188 -L 8188:127.0.0.1:8188 -L 3190:127.0.0.1:3190 ovh
```

Then visit `http://127.0.0.1:3190`, choose **Open staging**, and test at `http://127.0.0.1:3188/vms`. The stage user owns the synthetic **Cashflow Staging** organization. The API and database are available only through their loopback tunnel ports.

The production VM project, database, DNS, VM gateway, host credentials, and provider routes are not mounted into this stack.
