# การติดตั้ง MinIO บน Ubuntu (ไม่ใช้ Docker)

ไฟล์นี้อธิบายขั้นตอนการติดตั้ง MinIO บน Ubuntu 20.04/22.04 โดยไม่ต้องใช้ Docker แยกส่วนการตั้งค่าชัดเจนเพื่อให้สามารถใช้งาน MinIO เป็น S3-compatible Object Storage บนเครื่อง Local ได้ทันที

---

## Prerequisites

* ระบบปฏิบัติการ: Ubuntu 20.04 LTS หรือ Ubuntu 22.04 LTS
* ผู้ใช้งานมีสิทธิ์ `sudo`
* การเชื่อมต่ออินเทอร์เน็ตเพื่อดาวน์โหลดไบนารี

---

## 1. สร้างผู้ใช้และกลุ่มสำหรับ MinIO

เพื่อความปลอดภัย แยกการรัน MinIO ให้อยู่ภายใต้ผู้ใช้เฉพาะ:

```bash
sudo useradd -r minio-user -s /sbin/nologin
```

* `-r`: สร้าง system user
* `-s /sbin/nologin`: ป้องกันการ login ผ่าน shell

---

## 2. ดาวน์โหลดไบนารี MinIO

```bash
cd /tmp
wget https://dl.min.io/server/minio/release/linux-amd64/minio
sudo mv minio /usr/local/bin/
sudo chmod +x /usr/local/bin/minio
```

---

## 3. สร้างโฟลเดอร์เก็บข้อมูลและโฟลเดอร์สำหรับ config

```bash
sudo mkdir -p /var/lib/minio/data
sudo mkdir -p /etc/minio
sudo chown -R minio-user:minio-user /var/lib/minio
sudo chown -R minio-user:minio-user /etc/minio
```

---

## 4. กำหนด Environment Variables

สร้างไฟล์ `/etc/default/minio`:

```bash
sudo tee /etc/default/minio <<EOF
MINIO_VOLUMES="/var/lib/minio/data"
MINIO_OPTS="--console-address :9001"
MINIO_ROOT_USER="admin"
MINIO_ROOT_PASSWORD="YOUR-SECURE-PASSWORD"
EOF
```

* **เปลี่ยน** `YOUR-SECURE-PASSWORD` เป็นรหัสผ่านที่แข็งแรง

---

## 5. สร้าง Systemd Service

```bash
sudo tee /etc/systemd/system/minio.service <<EOF
[Unit]
Description=MinIO Object Storage
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target

[Service]
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server \$MINIO_OPTS \$MINIO_VOLUMES
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

รีโหลดและสตาร์ท service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio
```

---

## 6. ตั้งค่า Firewall (ถ้ามี)

```bash
sudo ufw allow 9000/tcp  # MinIO API
sudo ufw allow 9001/tcp  # MinIO Console
sudo ufw reload
```

---

## 7. สร้าง Bucket และนโยบายเบื้องต้น (CLI)

ติดตั้งและตั้งค่า MinIO Client (`mc`):

```bash
cd /tmp
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# ตั้ง alias
mc alias set local http://localhost:9000 admin YOUR-SECURE-PASSWORD

# สร้าง buckets
mc mb local/thermo-raw
mc mb local/thermo-processed

# ตั้ง lifecycle policy (เก็บ raw 30 วัน)
mc ilm add local/thermo-raw --expiry-days 30
```

---

## 8. ตรวจสอบสถานะและการใช้งาน

```bash
sudo systemctl status minio
```

* **API**: http\://YOUR\_SERVER\_IP:9000
* **Console**: http\://YOUR\_SERVER\_IP:9001
* **Login** ด้วย `admin` / `YOUR-SECURE-PASSWORD`

---

## 9. สรุป

คุณได้ติดตั้ง MinIO บน Ubuntu สำเร็จแล้ว พร้อม bucket สำหรับ raw/processed และ lifecycle policy สามารถใช้ S3-compatible API ได้เหมือนบน Cloud

---

*เอกสารอ้างอิง:*

* MinIO Quickstart Guide: [https://docs.min.io/docs/minio-quickstart-guide](https://docs.min.io/docs/minio-quickstart-guide)
