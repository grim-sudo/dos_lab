# ─────────────────────────────────────────────────────────────────────────────
# DNS Service — intentionally vulnerable dnsmasq for the DoS training lab
# ─────────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        dnsmasq \
    && rm -rf /var/lib/apt/lists/*

# Intentionally vulnerable config — no rate limiting, cache disabled
COPY dnsmasq.conf /etc/dnsmasq.d/lab.conf

# Remove default config that would override ours
RUN rm -f /etc/dnsmasq.conf && echo "" > /etc/dnsmasq.conf

EXPOSE 53/udp

CMD ["dnsmasq", "--no-daemon", \
     "--conf-file=/etc/dnsmasq.d/lab.conf", \
     "--log-queries", \
     "--log-facility=-"]
