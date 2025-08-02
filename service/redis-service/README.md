# Redis on Ubuntu: Installation and Configuration Guide

This README walks you through installing Redis on Ubuntu, enabling remote access (from your ingestion-service on 192.168.1.104), securing it, and testing. It assumes you control the machine `192.168.1.104` where Redis will run and that the ingestion-service will connect over the network.

---

## 1. Prerequisites

* Ubuntu (18.04/20.04/22.04 or newer) on `192.168.1.104`.
* Shell access (sudo) to that machine.
* Network connectivity from the ingestion-service host to `192.168.1.104` on the Redis port (default 6379).

---

## 2. Install Redis

```bash
sudo apt update
sudo apt install redis-server -y
```

Verify the service is installed and running:

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server
```

Test basic local connectivity:

```bash
redis-cli ping
# Expected output: PONG
```

---

## 3. Configure Redis for Remote Access (optional, if ingestion-service is on a different host)

By default Redis binds to `127.0.0.1` (loopback). To allow remote connections:

Edit the configuration:

```bash
sudo nano /etc/redis/redis.conf
```

Change the following:

* Find the `bind` line and adjust to allow the desired interface(s):

  ```conf
  # bind 127.0.0.1 ::1
  bind 0.0.0.0
  ```

  (or: `bind 127.0.0.1 192.168.1.104` to restrict to local + that IP)

* (Highly recommended) Require a password: find/comment or add:

  ```conf
  requirepass your_strong_password_here
  ```

After edits, restart Redis:

```bash
sudo systemctl restart redis-server
```

Verify remote access from another machine (e.g., ingestion-service machine):

```bash
redis-cli -h 192.168.1.104 -a your_strong_password_here ping
# Expected: PONG
```

---

## 4. Firewall / Network

Ensure port `6379` is reachable only from trusted hosts.
Example with `ufw` (on the Redis host):

```bash
sudo ufw allow from <INGESTION_SERVICE_IP> to any port 6379 proto tcp
sudo ufw enable
sudo ufw status
```

Replace `<INGESTION_SERVICE_IP>` with the IP of the service connecting (could be same host if local).

To limit to local network only (example for 192.168.1.0/24):

```bash
sudo ufw allow from 192.168.1.0/24 to any port 6379 proto tcp
```

---

## 5. Redis Configuration Best Practices for Production

* **Disable dangerous commands** if clients are untrusted: rename or disable `FLUSHDB`, `FLUSHALL`, `CONFIG`, etc., in `redis.conf`:

  ```conf
  rename-command CONFIG ""    # disables CONFIG
  rename-command FLUSHDB ""  # disables FLUSHDB
  rename-command FLUSHALL "" # disables FLUSHALL
  ```
* **Set a non-default database if needed** via client config.
* **Enable persistence** (optional depending on use case): ensure `appendonly yes` is set if you need durability beyond memory snapshot.

---

## 6. Authentication & Client Configuration

In your ingestion-service, install a Redis client such as `ioredis`.
Example environment variables in `.env`:

```env
REDIS_HOST=192.168.1.104
REDIS_PORT=6379
REDIS_PASSWORD=your_strong_password_here
REDIS_DB=0
```

Example connection in TypeScript using `ioredis`:

```ts
import Redis from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } from '../configs/config';

export const redisClient = new Redis({
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD || undefined,
  db: Number(REDIS_DB || 0),
  retryStrategy: (times) => Math.min(times * 100, 2000),
});
```

Test connectivity from ingestion service container or host:

```bash
redis-cli -h 192.168.1.104 -a your_strong_password_here ping
# PONG expected
```

---

## 7. Persistence & Backup (optional)

Redis by default uses RDB snapshots. For safer durability:

* Enable AOF (Append Only File) in `/etc/redis/redis.conf`:

  ```conf
  appendonly yes
  ```
* Periodically copy backups of the dump file (`/var/lib/redis/dump.rdb`) or AOF file to offline storage.

---

## 8. Security Notes

* Do not expose Redis to the public internet without a VPN or SSH tunnel.
* Use strong passwords and consider client-side IP restriction.
* Monitor authentication failures in logs: `sudo journalctl -u redis-server`.
* Optionally use TLS proxies or stunnel to encrypt traffic if Redis is not built with TLS.

---

## 9. Troubleshooting

* **Can’t connect remotely**: Check `bind` setting, firewall, and confirm Redis is listening:

  ```bash
  ss -tlnp | grep 6379
  ```
* **Authentication error**: Ensure the client is supplying the correct `requirepass` password.
* **High memory usage**: Use `INFO memory` and configure maxmemory/eviction policy.
* **Persistence issues**: Check `redis-cli info persistence` and review logs for snapshot/AOF errors.

---

## 10. Example Quick Test Script

```bash
# From another host
redis-cli -h 192.168.1.104 -a your_strong_password_here set testkey "hello"
redis-cli -h 192.168.1.104 -a your_strong_password_here get testkey
# Expect: "hello"
```

---

## 11. Restart & Status Commands

```bash
sudo systemctl restart redis-server
sudo systemctl status redis-server
sudo journalctl -u redis-server -f
```

---

## 12. Cleanup / Removal

```bash
sudo systemctl stop redis-server
sudo apt remove --purge redis-server -y
sudo rm -rf /var/lib/redis /etc/redis
```
