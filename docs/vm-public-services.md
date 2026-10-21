# VM public services

Open a VM detail page and add a service under **Public services**. Choose a short name, service type and guest port. Hanasand gives it the address `port-<name>.hanasand.com:443`; copy that address into the client people will use. The gateway refreshes route changes within a few seconds.

Each VM can have up to 1,000 public service mappings.

VMs currently sit behind a private network and do not have individual public IPv6 addresses. This shared 443 gateway is the supported way to publish the service.

## Supported services

- **Minecraft Java** reads the server hostname from the Minecraft handshake and sends the connection to the VM's guest port. Give players the full address, including `:443`.
- **TLS over TCP** reads the hostname from TLS SNI and sends the encrypted connection to the guest port without terminating TLS. The service on the VM must have a certificate that matches the public hostname.
- **SSH** already uses the shared gateway. Copy the `ssh -p 443 …` command from the VM's Access panel.

Subdomains cannot identify arbitrary plain TCP or UDP traffic by themselves. The TLS option needs a client that sends SNI; Minecraft Java has its own hostname field. UDP services such as Bedrock need a public UDP route, which this feature does not create.

For a Minecraft Java server, install and start the server on the VM, allow its guest port in the VM firewall, then add a **Minecraft Java** service using that port (usually `25565`). Share the generated hostname with `:443`, for example `port-survival.hanasand.com:443`.

## Gateway setup

The Hanasand API and OpenResty gateway must have the same randomly generated `VM_PORT_ROUTE_TOKEN` value in their private environment files. The API only returns route data when that token matches. Keep it out of source control and browser responses.

OpenResty reads the route list from the API over the host loopback connection every five seconds. It sends TLS routes through a local listener that removes the gateway's PROXY header before forwarding the original TLS stream to the VM. Minecraft routes are written to the watched mc-router config. Create the shared runtime directory and seed the existing game routes before first start:

```sh
mkdir -p minecraft/runtime
cp minecraft/routes-seed.json minecraft/runtime/minecraft.json
```

The gateway can reach VMs on the Inspur LXD bridge. Other VM hosts are not advertised by the internal route endpoint. Stopping or deleting a VM makes its route unavailable or removes it from the next refresh; deleting a service removes the route within five seconds.
