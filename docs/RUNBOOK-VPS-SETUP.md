# Runbook — VPS Provisioning & Hardening

Status: written ahead of first provision · Owner: Eddy · Last updated: 2026-07-20
Cross-ref: `docs/HOSTING.md` (topology), `docs/ARD.md` AD-15 (decision),
plan 14 (deploy flow → `RUNBOOK.md`), plan 15 (app-layer security),
plan 17 (database backups/restore).

Scope: everything between "ordered the VPS" and "Coolify is ready for its
first deploy". App-layer security (headers, rate limits, cookies) is plan 15;
deploy/rollback procedure is plan 14; pg_dump backups and the restore drill
are plan 17. This runbook is the layer under all three: the OS, SSH, the
firewall, and Docker/Coolify baseline.

Every step is idempotent or says when it isn't. Run top to bottom on a fresh
VPS; nothing here assumes app code exists yet.

---

## 0. Order configuration (OVHcloud)

| Setting | Value |
|---|---|
| Plan | VPS-2 (4 vCores, 8 GB RAM, 75 GB NVMe) |
| Region | **Beauharnois (BHS)** — Quebec; Law 25 / PIPEDA residency |
| OS | Ubuntu 24.04 LTS |
| Billing | 12-month upfront |
| Automated backup | Yes (~$1.80/mo) — full-VPS daily snapshot, distinct from plan 17's pg_dump |
| Snapshot / extra IP / panels | No |

OVHcloud emails the initial credentials. The default sudo user on their
Ubuntu images is `ubuntu` — root SSH is already disabled on OVHcloud images,
but verify rather than assume (§2).

## 1. First login + system baseline

```bash
ssh ubuntu@<VPS_IP>

sudo apt update && sudo apt full-upgrade -y
sudo reboot   # kernel updates on a fresh image are common; reboot now, not mid-setup
```

Set the hostname and timezone (backups and log timestamps depend on it):

```bash
sudo hostnamectl set-hostname nightlife-prod-1
sudo timedatectl set-timezone America/Toronto
```

> Server timezone is ops convenience only — business-night logic always uses
> the per-venue timezone from venue settings (see AGENTS.md appendix). Never
> let anything in the app read the server clock's zone.

## 2. Users and SSH hardening

Create your admin user (skip if using OVHcloud's `ubuntu` user — one admin
user is enough, two is drift):

```bash
# Only if you want a personal user instead of `ubuntu`:
sudo adduser eddy && sudo usermod -aG sudo eddy
```

Put your public key in place **and confirm key login works in a second
terminal before touching sshd_config** — locking yourself out of a fresh VPS
is recoverable via OVHcloud's KVM console, but tedious.

```bash
# From your local machine (Windows: use ssh-keygen in PowerShell, type ed25519):
ssh-copy-id -i ~/.ssh/id_ed25519.pub ubuntu@<VPS_IP>
```

Then harden. Ubuntu 24.04 reads drop-ins from `/etc/ssh/sshd_config.d/`;
use one rather than editing the main file:

```bash
sudo tee /etc/ssh/sshd_config.d/90-hardening.conf > /dev/null <<'EOF'
Port 2222
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 20
AllowUsers ubuntu
EOF
sudo sshd -t && sudo systemctl restart ssh
```

- `AllowUsers` must list the user(s) you actually created — adjust.
- **Keep the current session open** and verify from a new terminal:
  `ssh -p 2222 ubuntu@<VPS_IP>`. Only close the old session once the new
  port + key login is confirmed.
- Port 2222 is noise reduction, not security — the security is key-only auth.

## 3. Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp comment 'SSH'
sudo ufw allow 80/tcp   comment 'HTTP (Traefik/LE challenge)'
sudo ufw allow 443/tcp  comment 'HTTPS'
sudo ufw enable
sudo ufw status verbose
```

Rules that follow:

- **Never open 5432.** Postgres lives on the Docker internal network only;
  Coolify's own DB too. If you ever need psql from your machine, tunnel:
  `ssh -p 2222 -L 5432:localhost:5432 ubuntu@<VPS_IP>`.
- Coolify's dashboard (port 8000 during install) — do **not** open it.
  Access it through the SSH tunnel until Coolify serves it behind Traefik
  on a domain with TLS (§6).
- **Docker bypasses UFW** for published ports (it writes its own iptables
  rules). UFW showing 5432 closed proves nothing if a container publishes
  it — the real rule is in Coolify: never map a database port to
  `0.0.0.0`. Check with `docker ps` — any `0.0.0.0:5432->5432` mapping is
  a finding.

## 4. Automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # answer Yes
```

Default config applies security patches only — correct. Enable automatic
reboot for kernel patches at a dead hour (nightclub SaaS: dead hour is
mid-morning, not 4 a.m. — Friday 4 a.m. is peak trade):

```bash
sudo tee /etc/apt/apt.conf.d/51-reboot.conf > /dev/null <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "10:30";
EOF
```

## 5. Fail2Ban

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[sshd]
enabled = true
port    = 2222
maxretry = 3
bantime  = 1h
findtime = 15m
EOF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd   # verify the jail is up
```

App-layer brute force (login, PIN attempts) is rate-limited in the app
itself — plan 15. Fail2Ban here covers SSH only.

## 6. Coolify install

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Immediately after install:

1. Reach the dashboard through an SSH tunnel
   (`ssh -p 2222 -L 8000:localhost:8000 ubuntu@<VPS_IP>` →
   `http://localhost:8000`), create the admin account **right away** — until
   the first account exists, anyone who can reach the port can register it.
2. In Coolify settings, set the instance domain (e.g.
   `coolify.<yourdomain>`) so the dashboard moves behind Traefik with TLS,
   then keep 8000 firewalled.
3. **Disable public registration** in Coolify settings.
4. Point DNS: `A` records for staging + prod domains → VPS IP. If using
   Cloudflare (§8), proxy status on, SSL mode "Full (strict)".
5. Create two Coolify projects per HOSTING.md: staging (deploys `dev`) and
   production (deploys `master`), each with its own Postgres service and
   env set. Env vars per `.env.example`; secrets generated fresh —
   staging and prod never share `AUTH_SECRET`/`QR_TOKEN_SECRET`.

Deploy wiring, notifications, and rollback rehearsal are plan 14 — stop
here on the infra side.

## 7. Docker/host hygiene

- Log rotation for containers (unbounded json logs will eat the 75 GB):

  ```bash
  sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
  {
    "log-driver": "json-file",
    "log-opts": { "max-size": "20m", "max-file": "3" }
  }
  EOF
  sudo systemctl restart docker   # NOT idempotent-safe mid-deploy: restarts all containers
  ```

  Do this before the first deploy, not after.
- Coolify manages image updates for its own stack; app images rebuild per
  deploy. Run `docker system prune -f` monthly or enable Coolify's
  scheduled cleanup — old build layers are the usual disk filler.
- Disk watch: `df -h /` weekly (or via plan 16 monitoring when it lands).
  Above 80%, prune images and check Postgres/log growth.

## 8. Cloudflare (recommended, free tier)

- Proxy the staging + prod DNS records (orange cloud). Hides the VPS IP,
  adds application-layer DDoS/WAF on top of OVHcloud's network-layer
  anti-DDoS.
- SSL mode **Full (strict)** — Traefik still holds a Let's Encrypt cert, so
  the CF→origin hop is verified TLS. ("Flexible" would silently serve the
  origin over HTTP — never.)
- Once proxied, the app sees Cloudflare's IPs — plan 15's rate limiting
  must key on the forwarded client IP (`CF-Connecting-IP`), and Coolify's
  Traefik must be told to trust Cloudflare's ranges as proxies. Note this
  in the plan 15 PR if Cloudflare is in front by then.
- Optional tightening: UFW-allow 80/443 from
  [Cloudflare's published ranges](https://www.cloudflare.com/ips/) only, so
  the origin can't be hit directly by IP. Do this only after everything
  works through the proxy — it makes direct debugging impossible.

## 9. Verification checklist

Run after setup; every line should hold before the first real deploy:

```bash
# From your machine:
ssh -p 2222 ubuntu@<VPS_IP> 'echo ok'        # key login on custom port
ssh -p 22 ubuntu@<VPS_IP>                    # must fail/timeout
ssh -p 2222 root@<VPS_IP>                    # must be refused

# On the VPS:
sudo ufw status verbose                      # deny incoming; only 2222/80/443
sudo fail2ban-client status sshd             # jail active
sudo unattended-upgrade --dry-run --debug | tail -5   # updates armed
docker ps --format '{{.Names}} {{.Ports}}'   # NO 0.0.0.0 mapping on 5432/8000
sudo ss -tlnp | grep -v 127.0.0.1            # nothing listening publicly except sshd/traefik

# From any browser:
# - staging + prod domains serve over HTTPS with valid certs
# - http:// redirects to https://
# - Coolify dashboard NOT reachable on http://<VPS_IP>:8000
```

Paste the output of this checklist into the PR/commit that records the
provision — evidence, not assertion (§5 house rule).

## 10. What this runbook deliberately leaves out

- **App-layer security** (headers, HSTS, rate limits, cookie flags) —
  plan 15, in code, testable.
- **Deploy/rollback/notifications** — plan 14, `RUNBOOK.md`.
- **Database backups + restore drill** — plan 17. The OVHcloud automated
  backup (§0) is a convenience snapshot of the whole VPS, not a substitute:
  it lives in the same account and can't do point-in-time or per-DB restore.
- **WireGuard/Tailscale admin VPN** — worth doing when there's real payment
  data or a second operator; overkill for one person pre-launch. Revisit at
  first paying customer.
- **Intrusion detection (Wazuh/OSSEC), SELinux tuning** — not at this
  scale. AppArmor ships enabled on Ubuntu; leave it.

## Recovery notes

- Locked out of SSH: OVHcloud control panel → KVM console → fix
  `sshd_config` drop-in, or boot rescue mode and mount the disk.
- Lost the VPS entirely: re-run this runbook on a fresh VPS (≈30 min),
  restore DB per plan 17's drill, repoint DNS. The VPS is cattle; the
  database is the pet — which is why plan 17's off-VPS backups are the one
  thing this runbook cannot replace.
