# TrackShop DoS Lab — Knowledge Check

Answer all questions before consulting `Solutions.md`.

---

## Section 1 — Network Layer (ICMP)

**Q1.** Which protocol operates at the Network Layer (Layer 3) and is used in a ping flood attack?

- **A) ICMP**
- B) TCP
- C) UDP
- D) HTTP

---

**Q2.** What is the primary resource that an ICMP flood attack targets on the victim?

- A) Disk read/write throughput
- B) TLS certificate validation time
- C) DNS resolution cache size
- **D) Network bandwidth and CPU interrupt handling**

---

**Q3.** Which `hping3` flag sends ICMP Echo Request packets?

- A) `--tcp`
- **B) `--icmp`**
- C) `--udp`
- D) `--syn`

---

**Q4.** An ICMP flood from a single source is most effectively mitigated by:

- A) Disabling TCP SYN cookies
- B) Reducing the HTTP keep-alive timeout
- C) Enabling database connection pooling
- **D) Rate-limiting ICMP on a firewall or upstream router**

---

## Section 2 — Service Layer (DNS)

**Q5.** Which transport protocol do DNS queries primarily use?

- A) TCP
- **B) UDP**
- C) ICMP
- D) TLS

---

**Q6.** When a DNS server is flooded with thousands of queries per second, what happens to legitimate clients?

- A) The DNS server upgrades to TCP automatically
- B) Clients receive incorrect IP addresses
- C) The DNS server restarts and clears its cache
- **D) DNS queries time out and domain names cannot be resolved**

---

**Q7.** Disabling dnsmasq's cache (`cache-size=0`) makes it more vulnerable to a flood attack because:

- **A) Every DNS query must be freshly computed, multiplying CPU and I/O load per request**
- B) The server can no longer forward queries to upstream resolvers
- C) UDP packets become larger, consuming more bandwidth
- D) The DNS server stops listening on port 53

---

## Section 3 — Application Layer (HTTP)

**Q8.** The `/api/search?q=` endpoint is vulnerable to DoS because each request triggers:

- A) A DNS lookup for every character in the query
- B) A full TLS certificate renegotiation
- C) A broadcast ARP request across all network interfaces
- **D) A full PostgreSQL table scan using a leading-wildcard LIKE query**

---

**Q9.** The `wrk` tool is effective for HTTP flood attacks compared to simple `curl` in a loop because:

- A) It uses UDP instead of TCP
- B) It automatically spoofs its source IP
- **C) It opens many concurrent connections across multiple threads simultaneously**
- D) It sends malformed HTTP headers to crash the server

---

**Q10.** Which is the best mitigation for the HTTP flood vulnerability in the `/api/reports` endpoint?

- **A) Implement server-side caching and background report generation with rate limiting**
- B) Increase the number of CPU cores in the container
- C) Switch from PostgreSQL to SQLite
- D) Disable Nginx gzip compression

---

*Answer key and explanations: see `Solutions.md`.*
