# การติดตั้ง MinIO บน Ubuntu (ไม่ใช้ Docker)

คู่มือนี้อธิบายการติดตั้ง MinIO แบบ standalone บน Ubuntu 20.04 / 22.04 พร้อมตั้งค่าเป็น systemd service, สร้าง bucket, และ lifecycle policy

## Prerequisites

- Ubuntu 20.04 LTS หรือ Ubuntu 22.04 LTS  
- ผู้ใช้ที่มีสิทธิ์ `sudo`  
- การเชื่อมต่ออินเทอร์เน็ตเพื่อดาวน์โหลดไบนารี  
- (แนะนำ) ชื่อโดเมนหรือวิธีตั้งค่า TLS ถ้าจะใช้งาน production / ปลอดภัย  

## 1. สร้างกลุ่มและผู้ใช้สำหรับรัน MinIO (แยกสิทธิ์)

```bash
sudo groupadd -r minio-user
sudo useradd -M -r -g minio-user -s /sbin/nologin minio-user
````

> ใช้ system user ไม่มี shell และไม่สร้าง home directory เพื่อความปลอดภัย. ([Atlantic.Net][1])

## 2. ดาวน์โหลดไบนารี MinIO และติดตั้ง

```bash
cd /tmp
wget https://dl.min.io/server/minio/release/linux-amd64/minio
sudo mv minio /usr/local/bin/
sudo chmod +x /usr/local/bin/minio
```

ตรวจสอบเวอร์ชัน:

```bash
minio --version
```

## 3. สร้างไดเรกทอรีสำหรับข้อมูลและ config และเซ็ตสิทธิ์

```bash
sudo mkdir -p /var/lib/minio/data
sudo mkdir -p /etc/minio
sudo chown -R minio-user:minio-user /var/lib/minio
sudo chown -R minio-user:minio-user /etc/minio
```

## 4. กำหนด Environment Variables

สร้างไฟล์ `/etc/default/minio`:

```bash
sudo tee /etc/default/minio <<EOF
MINIO_VOLUMES="/var/lib/minio/data"
MINIO_OPTS="--console-address :9001"
MINIO_ROOT_USER="admin"
MINIO_ROOT_PASSWORD="REPLACE_WITH_STRONG_PASSWORD"
EOF
```

**ข้อแนะนำความปลอดภัย:**

* เปลี่ยน `REPLACE_WITH_STRONG_PASSWORD` เป็นรหัสผ่านความยาวอย่างน้อย 16 ตัวอักษร, ผสมตัวพิมพ์ใหญ่/เล็ก, ตัวเลข และสัญลักษณ์
* จำกัดสิทธิ์อ่านไฟล์:

  ```bash
  sudo chmod 600 /etc/default/minio
  sudo chown minio-user:minio-user /etc/default/minio
  ```

  เพื่อไม่ให้ผู้ไม่เกี่ยวข้องอ่าน credentials. ([GitHub][3])

## 5. สร้าง systemd service

สร้างไฟล์ `/etc/systemd/system/minio.service`:

```ini
[Unit]
Description=MinIO Object Storage
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target

[Service]
User=minio-user
Group=minio-user
EnvironmentFile=-/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

> จุดสำคัญ: เครื่องหมาย `-` หน้า `EnvironmentFile` ทำให้ไม่ล้มเหลวถ้าฟайлหาย และใช้ตัวแปรจาก `/etc/default/minio` ตามที่ systemd template ของ MinIO คาดหวัง. ([MinIO Blog][4], [GitHub][3])

รีโหลด systemd แล้วเริ่ม service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio
```

ตรวจสอบสถานะ:

```bash
sudo systemctl status minio
```

## 6. ตั้งค่า Firewall (ถ้ามี)

```bash
sudo ufw allow 9000/tcp   # MinIO API
sudo ufw allow 9001/tcp   # MinIO Console
sudo ufw reload
```

## 7. ติดตั้งและตั้งค่า MinIO Client (`mc`)

ดาวน์โหลดและติดตั้ง:

```bash
cd /tmp
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

ตั้ง alias ไปที่เซิร์ฟเวอร์ local:

```bash
mc alias set local http://localhost:9000 admin REPLACE_WITH_STRONG_PASSWORD
```

ตรวจสอบว่าตั้ง alias ได้:

```bash
mc ls local
```

## 8. สร้าง buckets และ lifecycle policy

สร้าง buckets:

```bash
mc mb local/thermo-raw
mc mb local/thermo-processed
```

ตั้ง expiration policy (เก็บ raw 30 วัน):

```bash
mc ilm rule add local/thermo-raw --expiry-days 30
```

ตรวจสอบ rule ที่ตั้งไว้:

```bash
mc ilm rule ls local/thermo-raw
```

> ใช้คำสั่งปัจจุบันคือ `mc ilm rule add` เพื่อเพิ่ม lifecycle rule. ([min.io][5])

## 9. (เพิ่มเติม) การเปิดใช้งาน HTTPS / Production Hardening

* **แนะนำให้วางหน้า MinIO ด้วย reverse proxy** เช่น NGINX หรือ Caddy เพื่อ:

  * ใส่ TLS/HTTPS (Let's Encrypt หรือ self-signed สำหรับทดสอบ). ([digitalocean.com][6], [digitalocean.com][7])
  * ทำ authentication layer เพิ่มเติม (ถ้าต้องการ)
* **ตัวอย่างเบื้องต้น:** ใช้ NGINX reverse proxy แล้วตั้ง certificate เพื่อป้องกันการส่งข้อมูล credentials แบบ plaintext

## 10. Troubleshooting (ปัญหาที่พบบ่อย)

* `minio.service` สตาร์ทไม่ขึ้น:

  * ตรวจสอบว่าไฟล์ `/etc/default/minio` ถูกอ่าน (ชื่อ/permissions ถูกต้อง). ([Stack Overflow][8])
  * ลองสตาร์ทด้วยคำสั่ง manual เพื่อดู error:

    ```bash
    sudo -u minio-user /usr/local/bin/minio server --console-address :9001 /var/lib/minio/data
    ```
* สิทธิ์ของโฟลเดอร์ไม่ถูกต้อง: ตรวจสอบ `chown` ให้เป็น `minio-user:minio-user` ทั้ง data และ config
* Credential login ไม่ได้: ตรวจสอบว่า `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` ตรงกับที่ใช้ login และมีการรีสตาร์ท service หลังแก้ไข

## 11. เข้าถึง

* **API endpoint:** `http://<SERVER_IP>:9000`
* **Console (Web UI):** `http://<SERVER_IP>:9001`
  Login ด้วย `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`

## 12. ตั้งค่า AMQP targets (RabbitMQ)
สมมติ alias ของ MinIO คือ local และ RabbitMQ รันที่ localhost:5672 ด้วย user/password guest:guest:

สร้าง Target สำหรับ raw.created
```ini
# ตัวอย่างเพิ่ม event (raw bucket)
mc admin config set local/ notify_amqp:raw enable=on url="amqp://minio_amqp_user:admin1234@localhost:5672/thermo" exchange=thermo_exchange exchange_type=direct routing_key=raw.created durable=on ack_level=broker delivery_mode=2 publisher_confirms=on
```
Target สำหรับ processed.created
```ini
# ตัวอย่างเพิ่ม event (processed bucket)
mc admin config set local/ notify_amqp:processed enable=on url="amqp://minio_amqp_user:admin1234@localhost:5672/thermo" exchange=thermo_exchange exchange_type=direct routing_key=processed.created durable=on ack_level=broker delivery_mode=2 publisher_confirms=on
```
จากนั้นรีสตาร์ท MinIO เพื่อให้ config ใหม่โหลด:

    mc admin service restart local

ตรวจสอบว่าค่าติดแล้ว:

    mc event add local/thermo-raw arn:minio:sqs::amqp:1 --event put
    mc event add local/thermo-processed arn:minio:sqs::amqp:2 --event put


## 13. สรุป

คุณจะได้:

* MinIO ติดตั้งแบบ standalone บน Ubuntu
* รันภายใต้ user จำกัดสิทธิ์
* systemd service เพื่อให้รีสตาร์ทอัตโนมัติ
* Bucket แยก `thermo-raw` / `thermo-processed`
* Lifecycle policy กำหนดให้ลบ `raw` หลัง 30 วัน
* Client (`mc`) ตั้ง alias สำหรับ CLI interaction/

## อ้างอิง

* MinIO single-node deployment and systemd configuration. ([min.io][2], [MinIO Blog][4])
* Lifecycle management with `mc ilm rule add`. ([min.io][5])
* Alias and client usage. ([min.io][9])
* Ubuntu standalone setup tutorials (DigitalOcean / Atlantic.Net) for TLS recommendations and initial hardening. ([digitalocean.com][6], [digitalocean.com][7])


```
