# TrackShop DoS Lab — Attack Observation Report

**Lab Host:** Single Docker container (`dos-lab:latest`)  
**Run command:** `docker run -p 80:80 -p 53:53/udp --name dos dos-lab:latest`  
**Test date:** 2026-03-11  
**Attacker tooling:** hping3 · wrk · dig (all run from host machine)

---

## Baseline (Idle State)

All measurements taken before any attack, container freshly started (~30 s uptime).

| Metric | Value |
|--------|-------|
| Container CPU | 0.05% |
| Container RAM | 76 MB |
| `/api/search` response time | 15 ms |
| `/api/reports` response time | 9 ms |
| `/api/orders` response time | 70 ms |
| DNS query (`dig trackshop.local`) | 1 ms |
| HTTP health check | 200 OK |

---

## Part 1 — ICMP Flood

### Attack Command

```bash
sudo hping3 --icmp --flood -V $TARGET
```

### Observations

| Metric | Value |
|--------|-------|
| Packet rate | ~235,000 packets/second |
| Total packets in 10 s | 2,348,474 |
| Traffic volume | ~6.5 MB/s inbound |
| Container CPU (`docker stats`) | 0% |
| Host kernel SoftIRQ (`top %si`) | Spikes to 60–100% |
| HTTP `/api/health` during flood | 200 OK, 7 ms |
| Ping RTT during flood | 0.035–0.419 ms (elevated from 0.016 ms) |

### Why Container CPU Shows Zero

ICMP Echo Requests are handled entirely inside the Linux kernel's SoftIRQ interrupt path — before the packet ever reaches the container's network namespace. `docker stats` only measures the container's cgroup CPU (nginx, node, postgres, dnsmasq processes), so the flood is invisible to it. The real impact shows in:

```bash
top       # %si column (software interrupts) spikes on the host
htop      # IRQ/SoftIRQ bars on CPU cores
```

### Technical Root Cause

No `iptables` rule rate-limits ICMP anywhere in the path between the attacker and the container. The kernel must process every Echo Request and generate every Echo Reply using interrupt handlers, consuming CPU cycles that would otherwise serve application threads.

### What Recovers the Service

Stopping hping3 (`Ctrl-C`) — recovery is **instantaneous**. No restart needed.

---

## Part 2 — DNS Flood

### Attack Command

```bash
sudo hping3 --udp -p 53 --flood $TARGET
```

### Observations

| Metric | Before Flood | During Flood |
|--------|-------------|-------------|
| Container CPU | 0.05% | **61.43%** |
| Container Network RX | < 1 KB/s | **167 MB** (in 7 s) |
| Container Network TX | < 1 KB/s | **99 MB** (in 7 s) |
| `dig @$TARGET trackshop.local` | 1 ms, correct A record | Timeout / no answer |
| HTTP `/api/health` | 200 OK | **Unaffected — 200 OK** |

### Packet-Level View

```
tcpdump -i docker0 -n udp port 53
→ floods terminal instantly with UDP datagrams
→ ~200,000+ packets/second visible
```

### Technical Root Cause

dnsmasq is configured with:
- `cache-size=0` — every packet hitting port 53 is parsed as a fresh query, no cached shortcut
- `dns-forward-max=500` — no per-client rate limit; the resolver accepts the full flood rate

Even though hping3 sends malformed UDP (not valid DNS wire format), dnsmasq still parses each datagram to the point of deciding it is invalid — this parse cost at high packet rate saturates the dnsmasq process.

### Isolation Property

HTTP remains fully operational during the DNS flood. dnsmasq is an independent process inside the container — its CPU consumption does not starve nginx or Node.js because supervisord gives each process its own scheduling context. This is an important observation for students: **different services on the same host can be independently knocked out**.

### What Recovers the Service

Stopping hping3 — recovery is **instantaneous**.

---

## Part 3 — HTTP Flood

All three sub-attacks use `wrk`. Each targets a different vulnerability in the API.

---

### 3a — Search Endpoint Flood

```bash
wrk -t 4 -c 100 -d 15s "http://$TARGET/api/search?q=wireless"
```

#### Results

```
Running 15s test @ http://172.17.0.2/api/search?q=wireless
  4 threads and 100 connections
  Thread Stats   Avg      Stdev     Max
    Latency     17.32ms   3.89ms  63.33ms
    Req/Sec      1.46k   210.85    1.74k
  86,936 requests in 15.02s, 108.94 MB read
  Requests/sec: 5,788
```

#### Observations

| Metric | Value |
|--------|-------|
| Requests delivered | 86,936 in 15 s |
| Throughput | 5,788 req/s |
| Avg latency during flood | 17 ms (vs 15 ms baseline) |
| Post-flood single request | 12 ms — recovered immediately |
| Error rate | 0% |

#### Technical Root Cause

Every request executes a leading-wildcard `ILIKE '%wireless%'` across the full `products` table — no index can be used, forcing a full sequential scan. At 5,788 req/s PostgreSQL runs this scan thousands of times per second. On a resource-constrained environment (limited CPU cores, small `shared_buffers`) this saturates the DB. The impact is more dramatic with a real remote attacker because this test runs over a local bridge with near-zero network overhead.

---

### 3b — Reports Endpoint Flood

```bash
wrk -t 4 -c 50 -d 10s --latency "http://$TARGET/api/reports"
```

#### Results

```
Running 10s test @ http://172.17.0.2/api/reports
  4 threads and 50 connections
  Thread Stats   Avg      Stdev     Max
    Latency     82.94ms   7.56ms  144.74ms
  Latency Distribution
     50%   81.91ms
     75%   87.08ms
     90%   92.83ms
     99%  103.71ms
  5,771 requests in 10.01s, 23.80 MB read
  Requests/sec: 576
```

#### Observations

| Metric | Before Flood | During Flood |
|--------|-------------|-------------|
| Container CPU | 0.05% | **231.33% (2.3 cores)** |
| `/api/reports` response time | 9 ms | **82 ms (9× slower)** |
| Max response time | 9 ms | 144 ms |
| 99th percentile latency | — | 103 ms |

#### Technical Root Cause

Each `/api/reports` request:
1. Runs three heavy aggregation SQL queries (JOINs across `orders`, `order_items`, `products`)
2. Executes a synchronous JavaScript loop of **200,000 `Math.sqrt` + `Math.log` iterations**

With 50 concurrent connections all hitting this endpoint, Node.js's single-threaded event loop is pinned. New requests pile up in the accept queue waiting for the event loop to free up. CPU exceeds 200% because both the Node.js process and PostgreSQL are simultaneously saturated.

---

### 3c — Orders Endpoint Flood

```bash
wrk -t 8 -c 100 -d 10s --latency "http://$TARGET/api/orders"
```

#### Results

```
Running 10s test @ http://172.17.0.2/api/orders
  8 threads and 100 connections
  Thread Stats   Avg      Stdev     Max
    Latency    202.94ms  396.98ms   1.76s
  Latency Distribution
     50%    1.28ms
     75%  182.19ms
     90%  858.05ms
     99%    1.57s
  329,019 requests in 10.02s, 112.31 MB read
  Non-2xx or 3xx responses: 328,953
  Requests/sec: 32,850
```

#### Observations

| Metric | Value |
|--------|-------|
| Total requests | 329,019 |
| HTTP 500 errors | **328,953 (99.98%)** |
| 99th percentile latency | 1.57 s |
| Max latency | 1.76 s |

#### Technical Root Cause

`GET /api/orders` issues **501 database queries per HTTP request** (1 base query + 1 per order row — the N+1 pattern). The Node.js connection pool has `max: 10`. With 100 concurrent HTTP requests each demanding 501 DB connections, the pool is exhausted in milliseconds. Every subsequent request hits `connectionTimeoutMillis: 5000`, waits 5 seconds, then receives a 500 Internal Server Error. The 50th percentile latency of 1.28 ms reflects requests that fail almost instantly because the pool is already full when they arrive.

---

## Comparative Summary

| Attack | Tool | Duration | Peak Container CPU | End Result |
|--------|------|----------|--------------------|------------|
| ICMP Flood | `hping3 --icmp --flood` | 10 s | 0% (host kernel SoftIRQ) | Ping RTT elevated; HTTP survives |
| DNS Flood | `hping3 --udp -p 53 --flood` | 7 s | **61%** | DNS timeouts; HTTP unaffected |
| HTTP Search | `wrk -t4 -c100` | 15 s | ~50% | 0% errors; throughput 5788 req/s |
| HTTP Reports | `wrk -t4 -c50` | 10 s | **231%** | 0% errors; 9× latency spike |
| HTTP Orders | `wrk -t8 -c100` | 10 s | ~200% | **99.98% HTTP 500 errors** |

**Crash verdict:** No attack crashed the container, killed any process, or required a restart. All services recovered within 1–2 seconds of stopping the attack tool. This is the defining characteristic of a DoS: **availability is denied without destroying the target**.

---

## End-User Experience

The following describes what a real user sitting at a browser would see during each attack, with no knowledge that an attack is happening.

---

### During ICMP Flood

The user opens `http://<lab-ip>/` in their browser.

**What they see at low flood rates:** Everything works normally — the TrackShop dashboard loads, products appear, search works. Nothing visible is wrong.

**What they see at sustained high rate (real remote attacker, saturated NIC):** The page starts loading slowly. Images and static assets time out. Eventually the browser shows:

> `ERR_CONNECTION_TIMED_OUT`

or the page partially loads with broken assets and the API calls spin indefinitely. The user assumes the site is down or their connection is bad. Refreshing makes no difference. The moment the attack stops, a refresh instantly loads the page perfectly — which is confusing and makes it appear intermittent.

---

### During DNS Flood

The user is already on the page (which loaded fine — the web server is up).

They search for a product. The search works. They click on an order. It loads. Everything HTTP-based is completely normal.

**However:** If the user's machine is configured to use this server as a DNS resolver (e.g. in a classroom environment where `nameserver <lab-ip>` is set), then:

- Typing any new URL in the address bar hangs at the DNS lookup phase
- The browser shows the "Resolving host..." spinner indefinitely
- New tabs can't load any page
- The TrackShop page they already have open continues to work (it's cached / already connected)

The user has no idea why new sites won't load while the tab they already have is fine. This is a realistic simulation of a DNS service outage.

---

### During HTTP Reports Flood (CPU exhaustion)

The user is browsing TrackShop. During the flood, they click the **Reports** tab.

**What they see:**
- The loading spinner appears
- Normally it resolves in under a second
- During the flood it takes **2–8 seconds** to load
- Other parts of the UI (navigation, search bar) also feel sluggish because Node.js's event loop is saturated
- The page eventually loads with correct data — it's slow, not broken
- Each click anywhere in the app feels "laggy"

A real user would file a support ticket saying "the reports page is really slow today." They would not know an attack is happening. If they opened the browser's DevTools → Network tab, they would see the `/api/reports` request sitting in a pending state for several seconds before returning a response.

---

### During HTTP Orders Flood (DB pool exhaustion — most impactful)

The user opens the **Orders** tab.

**What they see:**

A red error toast appears in the corner of the screen (or the entire tab shows an error state):

> `Failed to load orders`  
> or  
> `Something went wrong. Please try again.`

They refresh. Same error. They try again. Same error. They try a different browser. Same error. They call a colleague — same error on their machine too.

The search tab might still work (different endpoint). The login page works. But any page that calls `/api/orders` returns a 500 error with a JSON body:

```json
{ "error": "timeout expired" }
```

This continues for as long as the attack runs. **From the user's perspective the application is broken** — not slow, not laggy, but actively returning errors and refusing to show their data. This is the most impactful attack in the lab because it produces a visible, unambiguous failure in the browser UI, not just slowness.

The moment the attack stops, a single page refresh brings everything back perfectly. The suddenness of recovery is itself a strong indicator of a DoS attack rather than a software bug.

---

## Monitoring Commands Reference

These are the commands a student should run in a second terminal during each attack to observe what is happening at a technical level.

### Universal — watch container state in real time
```bash
# CPU, memory, and network I/O updated every second
docker stats dos

# Same but formatted for a tidy view
watch -n 1 'docker stats dos --no-stream --format \
  "CPU: {{.CPUPerc}}  RAM: {{.MemUsage}}  NET: {{.NetIO}}"'
```

### ICMP Flood observation
```bash
# See ICMP packets arriving at the container's network interface
sudo tcpdump -i docker0 -n icmp

# Count packets per second
sudo tcpdump -i docker0 -n icmp -q 2>/dev/null | pv -l -i 1 > /dev/null

# Watch host kernel softirq load (look at %si column)
top

# Measure ping RTT degradation
ping -i 0.5 $TARGET
```

### DNS Flood observation
```bash
# Watch UDP port 53 traffic
sudo tcpdump -i docker0 -n udp port 53

# Poll DNS every second to see resolution fail
while true; do
  dig @$TARGET trackshop.local +short +time=2 2>&1 \
    | grep -E "127|timed out|no servers" \
    | sed "s/^/$(date +%H:%M:%S) /"
  sleep 1
done

# Watch container CPU spike
watch -n 1 'docker stats dos --no-stream --format "CPU: {{.CPUPerc}}  NET: {{.NetIO}}"'
```

### HTTP Flood observation
```bash
# Poll a single request to watch latency and status codes
while true; do
  curl -s -o /dev/null \
    -w "$(date +%H:%M:%S)  orders: %{http_code}  %{time_total}s\n" \
    "http://$TARGET/api/orders"
  sleep 1
done

# Count active TCP connections to port 80
watch -n 1 "ss -ant | grep ':80' | awk '{print \$1}' | sort | uniq -c"

# Watch HTTP traffic on the wire
sudo tcpdump -i docker0 -n tcp port 80 -q | head -20
```

---

*TrackShop DoS Lab — for educational use only.*
