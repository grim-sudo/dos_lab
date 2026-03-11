# TrackShop — DoS Training Lab

> A fully dockerised Denial-of-Service training environment for cybersecurity learners.

---

## Lab Overview

**TrackShop** is a simulated e-commerce order-management web application running inside Docker containers on a dedicated lab host. The application is intentionally built with weaknesses that make it vulnerable to Denial-of-Service attacks at three different protocol layers.

Students are assigned the **IP address of the lab host** by their instructor. No Docker installation or setup is required on the attacker machine — just connect to the given IP and start the exercises.

The target IP is displayed prominently on the TrackShop dashboard (`http://<your-pod-ip>/`) as soon as the browser connects.

| Component  | Technology                | Role                          |
|------------|---------------------------|-------------------------------|
| Frontend   | React + TypeScript + Vite | SPA dashboard served by Nginx |
| Backend    | Node.js + Express         | REST API (`/api/*`)           |
| Database   | PostgreSQL 15 (Debian)    | Persistent data, heavy queries|
| Web Server | Nginx (Debian slim)       | Reverse proxy + static files  |

---

## Lab Scenario

You are a junior security analyst at a fictional company. The DevOps team has deployed **TrackShop**, an internal order-management portal, to a new server. Your task is to perform a security assessment of the service before it goes into production.

Your assessment must cover three threat categories:

1. **Network-level volumetric attack** — can the server be overwhelmed at the ICMP layer?
2. **Service-level DNS flood** — can the DNS resolver be overwhelmed by query flooding?
3. **Application-level resource exhaustion** — can specific API endpoints be flooded to degrade or crash the service?

For each attack you must:
- Execute the attack using the designated tool.
- Observe measurable degradation.
- Document your findings and recommend a mitigation.

Your assigned target IP will be shown on the TrackShop dashboard when you open the application in a browser.

---

## How the Lab Works

### Network Architecture

```
┌─────────────────────────────────────────────┐
│ Attacker Machine (Kali Linux)               │
│  Tools: hping3 · Metasploit · wrk           │
└────────────────┬────────────────────────────┘
                 │  attack traffic → pod IP : 80 / 53
┌────────────────▼────────────────────────────┐
│              Lab Host (Docker)              │
│  ┌──────────────────────────────────────┐   │
│  │  Nginx  172.28.0.30 : 80             │   │
│  │  (reverse proxy + Vite frontend)     │   │
│  └──────────────┬───────────────────────┘   │
│                 │ proxy /api/*              │
│  ┌──────────────▼───────────────────────┐   │
│  │  Node.js Backend  172.28.0.20 : 3000 │   │
│  └──────────────┬───────────────────────┘   │
│                 │ postgres://               │
│  ┌──────────────▼───────────────────────┐   │
│  │  PostgreSQL DB    172.28.0.10        │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │  dnsmasq DNS  172.28.0.40 : 53/udp   │   │
│  │  (intentionally misconfigured)       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Intentional Vulnerabilities

| Layer | Protocol | Weakness |
|-------|----------|----------|
| Network (L3) | ICMP | No ICMP rate limit or firewall rule — ping flood consumes CPU interrupts and bandwidth |
| Service (DNS/UDP) | UDP | dnsmasq has `cache-size=0`, `dns-forward-max=500`, and large TXT records — every query is freshly computed with no rate limiting |
| Application (L7) | HTTP | No rate limiting; endpoints run full table scans, 3-query report generation with CPU spin, and N+1 DB queries |

### Vulnerable Endpoints

| Endpoint | Why It's Vulnerable |
|----------|---------------------|
| `GET /api/search?q=` | Leading-wildcard `ILIKE '%term%'` forces a full PostgreSQL table scan on every request — no index, no cache |
| `GET /api/reports` | Runs three heavy aggregation queries sequentially, then executes 200 000 CPU iterations per request to simulate report rendering |
| `GET /api/orders` | Returns all 500+ orders with no pagination; issues one extra DB query per order row (N+1 pattern), multiplying DB load |
| `POST /api/login` | No rate limiting or lockout — floods exhaust the database connection pool |

### What Students Observe

- **ICMP flood** → CPU spikes in `docker stats`, increased ping RTT.
- **DNS flood** → `dig @<target> trackshop.local` times out; dnsmasq CPU saturates; DNS resolution unavailable.
- **HTTP flood** → `wrk` latency climbs from ~50 ms to several seconds; PostgreSQL CPU saturates; backend returns 500 / 502 errors.

---

## Setup (Lab Host Only)

> Students do not need to run these commands. The instructor provisions the lab host.

### Option A — Single container (recommended)

```bash
# Build once
docker build -t dos-lab .

# Run
docker run -p 80:80 --name dos dos-lab:latest

# Verify web
curl http://localhost/api/health
# Verify DNS (use the container IP shown on the TrackShop dashboard)
dig @<container-ip> trackshop.local
```

The application is immediately available at **http://\<host-ip\>**. The dnsmasq DNS service runs on port 53 inside the container and is reachable at the container IP displayed on the TrackShop dashboard — no separate port mapping required.

To reset the lab (wipes the database and starts fresh):

```bash
docker rm -f dos && docker run -p 80:80 --name dos dos-lab:latest
```

> `start.sh` is also provided as a convenience wrapper that handles build
> detection and removes any existing container automatically.

### Option B — Docker Compose (multi-container)

```bash
# Install node modules in both frontend and backend
cd frontend && npm i && cd ../backend && npm i && cd ..

# Build images and start all containers
docker compose up --build -d

# Verify health
docker compose ps
curl http://localhost/api/health
```

To reset:

```bash
docker compose down -v && docker compose up -d
```

---

*TrackShop DoS Lab — for educational use only. Never run these attacks outside an isolated lab environment.*
