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
2. **Transport-level connection exhaustion** — can the TCP handshake backlog be saturated?
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
                 │  attack traffic → pod IP : 80
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
└─────────────────────────────────────────────┘
```

### Intentional Vulnerabilities

| Layer | Protocol | Weakness |
|-------|----------|----------|
| Network (L3) | ICMP | No ICMP rate limit or firewall rule — ping flood consumes CPU interrupts and bandwidth |
| Transport (L4) | TCP | `tcp_syncookies=0`, backlog=128 — SYN flood exhausts half-open connection queue |
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
- **SYN flood** → `ss -ant | grep SYN_RECV` fills to 128 (backlog limit), legitimate connections time out.
- **HTTP flood** → `wrk` latency climbs from ~50 ms to several seconds; PostgreSQL CPU saturates; backend returns 500 / 502 errors.

---

## Setup (Lab Host Only)

> Students do not need to run these commands. The instructor provisions the lab host.

```bash
# Clone / enter the project directory
cd dos_lab

# Install node modules in both fronted and backend folders
cd dos_lab/frontend
npm i
cd ../backend
npm i

# Build images and start all containers
docker compose up --build -d

# Verify health
docker compose ps
curl http://localhost/api/health
```

The application is immediately available at **http://\<host-ip\>**.

To reset the lab (wipes the database):

```bash
docker compose down -v && docker compose up -d
```

---

*TrackShop DoS Lab — for educational use only. Never run these attacks outside an isolated lab environment.*
