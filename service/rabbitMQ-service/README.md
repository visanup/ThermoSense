# RabbitMQ Installation & Configuration for ThermoSense (Standalone on Ubuntu)

เอกสารนี้สรุปขั้นตอนการ **ติดตั้ง** และ **ตั้งค่า** RabbitMQ บน Ubuntu 20.04/22.04 (ไม่ใช้ Docker) เพื่อให้สามารถใช้ร่วมกับ MinIO Notification (AMQP) ใน pipeline ของ ThermoSense  
โฟลว์ที่ตั้งใจ:  
`raw.created` → processing → `processed.created` → OCR

---

## สารบัญ

1. [Prerequisites](#prerequisites)  
2. [ติดตั้ง Erlang และ RabbitMQ (แบบปลอดภัย/ทันสมัย)](#1-ติดตั้ง-erlang-และ-rabbitmq-แบบปลอดภัย)  
3. [เปิดใช้งาน Management Plugin และสตาร์ทบริการ](#2-เปิดใช้งาน-management-plugin-และสตาร์ทบริการ)  
4. [ตั้งค่า Firewall (ถ้ามี)](#3-ตั้งค่า-firewall-ถ้ามี)  
5. [สร้าง Virtual Host และ Users พร้อมสิทธิ์](#4-สร้าง-virtual-host-และ-users-พร้อมสิทธิ์)  
6. [ประกาศ Exchange / Queue / Binding](#5-ประกาศ-exchange--queue--binding)  
7. [เตรียม `rabbitmq_definitions.json` สำหรับ reuse (export/import)](#6-เตรียม-rabbitmqdefinitionsjson-สำหรับ-reuse-exportimport)  
8. [เชื่อมต่อกับ MinIO Notifications (AMQP)](#7-เชื่อมต่อกับ-minio-notifications-amqp)  
9. [Security & Hardening สั้นๆ](#8-security--hardening-สั้นๆ)  
10. [Monitoring / Logging](#9-monitoring--logging)  
11. [Troubleshooting แบบรวบรัด](#10-troubleshooting-แบบรวบรัด)  
12. [สรุป](#11-สรุป)  

---

## Prerequisites

* Ubuntu 20.04 LTS หรือ 22.04 LTS  
* สิทธิ์ `sudo`  
* การเชื่อมต่อเครือข่ายภายใน (LAN)  
* อินเทอร์เน็ตเพื่อดาวน์โหลดแพ็กเกจ  
* (แนะนำ) มี `jq` ติดตั้งไว้ช่วย parse JSON เวลา debug:  
  ```bash
  sudo apt install -y jq
  ```

## 1. ติดตั้ง Erlang และ RabbitMQ (แบบปลอดภัย)

```bash
# 1. แก้แพ็กเกจค้าง- broken ก่อน
sudo apt --fix-broken install
sudo apt-get update
sudo apt-get upgrade -y

# 2. เพิ่ม PPA ของทีม RabbitMQ เพื่อให้ได้ Erlang ล่าสุด (>=26)
sudo add-apt-repository -y ppa:rabbitmq/rabbitmq-erlang
sudo apt update

# 3. ติดตั้ง Erlang จาก PPA นี้ (จะได้ OTP 26+ ที่ rabbitmq-server ต้องการ) 
sudo apt install -y erlang

# ยืนยันเวอร์ชัน (ควรเห็น OTP 26 หรือ 27 ขึ้นไป)
erl -eval 'erlang:display(erlang:system_info(otp_release)), halt().' -noshell

# 4. (ถ้ายังไม่ได้เพิ่ม RabbitMQ repo แบบ signed-by) เพิ่ม RabbitMQ official repo
sudo mkdir -p /etc/apt/keyrings
wget -O - https://dl.cloudsmith.io/public/rabbitmq/rabbitmq-server/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/rabbitmq-archive-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/rabbitmq-archive-keyring.gpg] https://dl.cloudsmith.io/public/rabbitmq/rabbitmq-server/deb/ubuntu $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/rabbitmq.list
sudo apt update

# 5. ติดตั้ง RabbitMQ Server
sudo apt install -y rabbitmq-server

```

> **หมายเหตุ:** การใช้ `apt-key add` แบบเก่าถูก deprecate แล้ว เลยใช้ `gpg --dearmor` แล้วอ้างอิงด้วย `signed-by` ให้ปลอดภัย

---

## 2. เปิดใช้งาน Management Plugin และสตาร์ทบริการ

```bash
# เปิด Web UI (management)
sudo rabbitmq-plugins enable rabbitmq_management

# ตั้งให้สตาร์ทอัตโนมัติและเริ่ม
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server

# ตรวจสถานะ
sudo systemctl status rabbitmq-server
```

* **Management UI:** `http://<YOUR_SERVER_IP>:15672`

  * ค่าเริ่มต้น `guest`/`guest` **ใช้ได้เฉพาะจาก localhost เท่านั้น** ถ้าเปิดให้ remote ต้องสร้าง user ใหม่และปิด guest จาก remote access

* **AMQP port:** 5672

---

## 3. ตั้งค่า Firewall (ถ้ามี)

```bash
sudo ufw allow 5672/tcp    # AMQP
sudo ufw allow 15672/tcp   # Management UI (ถ้าต้องเข้าจากภายนอก)
sudo ufw reload
```

ถ้าใช้ firewall อื่น (เช่น firewalld) ให้เปิดพอร์ตตามระบบนั้นแทน

---

## 4. สร้าง Virtual Host และ Users พร้อมสิทธิ์

```bash
# สร้าง vhost
sudo rabbitmqctl add_vhost thermo

# สร้าง user แยกตาม service (เปลี่ยนรหัสผ่านให้แข็งแรง)
sudo rabbitmqctl add_user ingestion_user 'admin1234' 
sudo rabbitmqctl add_user processing_user 'admin1234'
sudo rabbitmqctl add_user ocr_user 'admin1234'
sudo rabbitmqctl add_user minio_amqp_user 'admin1234'

# ตั้ง permissions
# ingestion_user: full (publish/declare/etc)
sudo rabbitmqctl set_permissions -p thermo ingestion_user ".*" ".*" ".*"

# processing_user: อ่าน raw.created, เขียน processed.created
sudo rabbitmqctl set_permissions -p thermo processing_user "" "processed.created" "raw.created"

# ocr_user: อ่าน processed.created เท่านั้น
sudo rabbitmqctl set_permissions -p thermo ocr_user "" "" "processed.created"

# minio_amqp_user: ส่ง event (publish) บน raw.created และ processed.created
sudo rabbitmqctl set_permissions -p thermo minio_amqp_user "" "raw.created|processed.created" ""
```

> แนะนำให้ใช้รหัสผ่านที่เกิดจาก password manager และไม่ hardcode ในสคริปต์ production

---

## 5. ประกาศ Exchange / Queue / Binding

### 5.1 ติดตั้ง `rabbitmqadmin` (CLI ตัวช่วย)

```bash
# ดาวน์โหลดจาก management UI endpoint (ปรับ host ถ้าไม่ใช่ localhost)
# ดาวน์โหลด ไปไว้ /tmp
curl -u guest:guest -o /tmp/rabbitmqadmin http://localhost:15672/cli/rabbitmqadmin

# ถ้า curl ยังล้มเหลว ลอง wget
wget --user=guest --password=guest -O /tmp/rabbitmqadmin http://localhost:15672/cli/rabbitmqadmin

# ตรวจสอบว่าได้ไฟล์
ls -l /tmp/rabbitmqadmin

# ทำให้ executable
chmod +x /tmp/rabbitmqadmin

# ย้ายไปที่ที่ global ใช้ได้
sudo mv /tmp/rabbitmqadmin /usr/local/bin/rabbitmqadmin

# ตรวจสอบว่ารันได้
rabbitmqadmin --version
```
### 5.2 ยืนยัน rabbitmq ที่มีอยู่

```bash
# ดู vhosts
rabbitmqadmin list vhosts

# ดู users
rabbitmqadmin list users

# ดู permissions (เฉพาะ /thermo)
rabbitmqadmin -V /thermo list permissions

```

### 5.3 สร้าง exchange, queue, binding

```bash
# สร้าง direct exchange
rabbitmqadmin --host=localhost --port=15672 --username=ingestion_user --password='admin1234' --vhost=/thermo declare exchange name=thermo_exchange type=direct durable=true

# สร้าง queues
rabbitmqadmin --vhost=/thermo --username=processing_user --password='admin1234' declare queue name=raw_created durable=true
rabbitmqadmin --vhost=/thermo --username=ocr_user --password='admin1234' declare queue name=processed_created durable=true

# สร้าง bindings
rabbitmqadmin --vhost=/thermo --username=processing_user --password='admin1234' declare binding source=thermo_exchange destination=raw_created routing_key=raw.created
rabbitmqadmin --vhost=/thermo --username=ocr_user --password='admin1234' declare binding source=thermo_exchange destination=processed_created routing_key=processed.created
```

### 5.3 ตัวอย่างผ่าน HTTP API (curl)

```bash
# Exchange
curl -u ingestion_user:'StrongP@ss1!' -XPUT \
  -H "content-type:application/json" \
  -d '{"type":"direct","durable":true}' \
  http://localhost:15672/api/exchanges/%2Fthermo/thermo_exchange

# Queue raw_created
curl -u processing_user:'StrongP@ss2!' -XPUT \
  -H "content-type:application/json" \
  -d '{"durable":true}' \
  http://localhost:15672/api/queues/%2Fthermo/raw_created

# Queue processed_created
curl -u ocr_user:'StrongP@ss3!' -XPUT \
  -H "content-type:application/json" \
  -d '{"durable":true}' \
  http://localhost:15672/api/queues/%2Fthermo/processed_created

# Binding raw.created → raw_created
curl -u processing_user:'StrongP@ss2!' -XPOST \
  -H "content-type:application/json" \
  -d '{"routing_key":"raw.created","arguments":{}}' \
  http://localhost:15672/api/bindings/%2Fthermo/e/thermo_exchange/q/raw_created

# Binding processed.created → processed_created
curl -u ocr_user:'StrongP@ss3!' -XPOST \
  -H "content-type:application/json" \
  -d '{"routing_key":"processed.created","arguments":{}}' \
  http://localhost:15672/api/bindings/%2Fthermo/e/thermo_exchange/q/processed_created
```

---

## 6. เตรียม `rabbitmq_definitions.json` สำหรับ reuse (export/import)

### 6.1 Export (จาก UI)

เข้าไปที่ Management UI → **"Admin" → "Export definitions"** จะได้ไฟล์ JSON ที่มี `password_hash` จริง

### 6.2 ตัวอย่างโครงสร้าง (ใช้เฉพาะถ้า export มาแล้วแล้วแก้ไข / สร้าง template ด้วย hash จริงจาก export)

> **สำคัญ:** ต้องเอา `password_hash` ที่ได้จากการ export จริงมาใช้งาน ห้ามใส่ placeholder

```json
{
  "rabbit_version": "3.11.28",
  "rabbitmq_version": "3.11.28",
  "product_name": "RabbitMQ",
  "product_version": "3.11.28",
  "rabbitmq_definition_format": "cluster",
  "original_cluster_name": "rabbit@temporary",
  "explanation": "Bootstrap with thermo vhost/exchange/queues and role-based permissions",
  "vhosts": [
    { "name": "/" },
    { "name": "thermo" }
  ],
  "users": [
    {
      "name": "admin",
      "password_hash": "nWAgZEnQ5VSZ14A6W8zSx0q3un0K6nhJDMqh7xTc+3lvEK7D",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": ["administrator"],
      "limits": {}
    },
    {
      "name": "ingestion_user",
      "password_hash": "nWAgZEnQ5VSZ14A6W8zSx0q3un0K6nhJDMqh7xTc+3lvEK7D",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": [],
      "limits": {}
    },
    {
      "name": "minio_amqp_user",
      "password_hash": "nWAgZEnQ5VSZ14A6W8zSx0q3un0K6nhJDMqh7xTc+3lvEK7D",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": [],
      "limits": {}
    },
    {
      "name": "processing_user",
      "password_hash": "nWAgZEnQ5VSZ14A6W8zSx0q3un0K6nhJDMqh7xTc+3lvEK7D",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": [],
      "limits": {}
    },
    {
      "name": "ocr_user",
      "password_hash": "nWAgZEnQ5VSZ14A6W8zSx0q3un0K6nhJDMqh7xTc+3lvEK7D",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": [],
      "limits": {}
    }
  ],
  "permissions": [
    {
      "user": "admin",
      "vhost": "/",
      "configure": ".*",
      "write": ".*",
      "read": ".*"
    },
    {
      "user": "admin",
      "vhost": "thermo",
      "configure": ".*",
      "write": ".*",
      "read": ".*"
    },
    {
      "user": "ingestion_user",
      "vhost": "thermo",
      "configure": ".*",
      "write": ".*",
      "read": ".*"
    },
    {
      "user": "minio_amqp_user",
      "vhost": "thermo",
      "configure": ".*",
      "write": ".*",
      "read": ".*"
    },
    {
      "user": "processing_user",
      "vhost": "thermo",
      "configure": "",
      "write": "processed_created",
      "read": "raw_created"
    },
    {
      "user": "ocr_user",
      "vhost": "thermo",
      "configure": "",
      "write": "",
      "read": "processed_created"
    }
  ],
  "topic_permissions": [],
  "parameters": [],
  "global_parameters": [
    { "name": "cluster_tags", "value": [] },
    { "name": "internal_cluster_id", "value": "rabbitmq-cluster-id-UWQcAdunnmpIJ8O6gm1gLA" }
  ],
  "policies": [],
  "queues": [
    {
      "name": "raw_created",
      "vhost": "thermo",
      "durable": true,
      "auto_delete": false,
      "arguments": {}
    },
    {
      "name": "processed_created",
      "vhost": "thermo",
      "durable": true,
      "auto_delete": false,
      "arguments": {}
    }
  ],
  "exchanges": [
    {
      "name": "thermo_exchange",
      "vhost": "thermo",
      "type": "direct",
      "durable": true,
      "auto_delete": false,
      "internal": false,
      "arguments": {}
    }
  ],
  "bindings": [
    {
      "source": "thermo_exchange",
      "vhost": "thermo",
      "destination": "raw_created",
      "destination_type": "queue",
      "routing_key": "raw.created",
      "arguments": {}
    },
    {
      "source": "thermo_exchange",
      "vhost": "thermo",
      "destination": "processed_created",
      "destination_type": "queue",
      "routing_key": "processed.created",
      "arguments": {}
    }
  ]
}



```

### 6.3 Import

ใน UI: ไปที่ Management UI → **"Admin" → "Import definitions"** อัพโหลดไฟล์ JSON ที่เตรียมไว้

---

## 7. เชื่อมต่อกับ MinIO Notifications (AMQP)

แนะนำให้ใช้ user แยกสำหรับ MinIO (เช่น `minio_amqp_user`) และจำกัด permission ให้ตรงงาน

```bash
# ตัวอย่างเพิ่ม event (raw bucket)
mc admin config set local/ notify_amqp:raw enable=on
mc admin config set local/ notify_amqp:raw url="amqp://minio_amqp_user:admin1234@localhost:5672/thermo"
mc admin config set local/ notify_amqp:raw exchange=thermo_exchange
mc admin config set local/ notify_amqp:raw exchange_type=direct
mc admin config set local/ notify_amqp:raw routing_key=raw.created
mc admin config set local/ notify_amqp:raw durable=true
mc admin config set local/ notify_amqp:raw ack_level=broker
mc admin config set local/ notify_amqp:raw delivery_mode=2
mc admin config set local/ notify_amqp:raw publisher_confirms=on

# ตัวอย่างเพิ่ม event (processed bucket)
mc admin config set local/ notify_amqp:processed enable=on
mc admin config set local/ notify_amqp:processed url="amqp://minio_amqp_user:admin1234@localhost:5672/thermo"
mc admin config set local/ notify_amqp:processed exchange=thermo_exchange
mc admin config set local/ notify_amqp:processed exchange_type=direct
mc admin config set local/ notify_amqp:processed routing_key=processed.created
mc admin config set local/ notify_amqp:processed durable=true
mc admin config set local/ notify_amqp:processed ack_level=broker
mc admin config set local/ notify_amqp:processed delivery_mode=2
mc admin config set local/ notify_amqp:processed publisher_confirms=on

# รีสตาร์ท MinIO:
mc admin service restart local

# ตรวจผล
mc admin config get local notify_amqp

```
หากพบปัญหาให้ทำการหยุดการทำงาน
```bash
# รีเซ็ตให้ clean ก่อน
mc admin config set local/ notify_amqp:raw enable=off
mc admin config set local/ notify_amqp:processed enable=off
mc admin service restart local
```

> ถ้าใช้ `ingestion_user` เป็นผู้ส่ง event ก็ปรับชื่อ user และ permission ให้เหมาะสม แต่แยกก็ช่วยเรื่อง audit และ principle of least privilege

---

## 8. ผูก bucket กับ AMQP ARN
```bash
# ดู log ของ MinIO บน startup เพื่อหา ARN ที่แท้จริง
journalctl -u minio -f | head -n 100
## ตัวอย่าง Aug 01 13:31:42 qiadmin-server minio[16138]: SQS ARNs: arn:minio:sqs::processed:amqp arn:minio:sqs::raw:amqp

# ให้ bucket raw ส่ง event เมื่อมีการ put .jpg ผ่าน AMQP endpoint "raw"
mc event add local/thermo-raw arn:minio:sqs::raw:amqp --event put --suffix .jpg

# ให้ bucket processed ส่ง event เมื่อมีการ put .jpg ผ่าน AMQP endpoint "processed"
mc event add local/thermo-processed arn:minio:sqs::processed:amqp --event put --suffix .jpg

```
## 9. ทดสอบการ upload
```bash
# สร้าง dummy JPEG (แค่ไฟล์ไบต์สุ่มมี .jpg extension)
dd if=/dev/urandom bs=1024 count=1 of=/tmp/test.jpg
# หรือแค่สร้างไฟล์เปล่า (ไม่สำคัญว่ามันจะไม่ใช่ภาพจริง)
touch /tmp/test.jpg
# เอาไฟล์ไปใส่ใน bucket เพื่อ trigger event
mc cp /tmp/test.jpg local/thermo-raw/
#ตรวจว่า notification ถูกติดตั้ง (เช็คว่า event binding อยู่)
mc event ls local/thermo-raw arn:minio:sqs::raw:amqp
#ดูว่า message ไปถึง queue หรือยัง
rabbitmqadmin --vhost=thermo --username=processing_user --password='admin1234' get queue=raw_created requeue=false

```

## 10. กำหนดสิทธิ์ในการเข้าดู
```bash
sudo rabbitmqctl set_user_tags ingestion_user administrator
rabbitmqctl list_users
```

## 10. Security & Hardening (สั้นๆ)

* **ปิด `guest` จากการเข้าจาก network ภายนอก** (ค่า default ใช้ได้เฉพาะ localhost)

  ```bash
  # ถ้าอยากลบ guest เลย (ระวัง dependencies)
  sudo rabbitmqctl delete_user guest
  ```
* **ใช้ user แยกตาม service** (ทำแล้ว)
* **เปิด TLS สำหรับ production** (ไม่รวมใน README นี้ แต่ควรทำ)
* **จำกัดการเข้าถึง Management UI ผ่าน firewall หรือ reverse-proxy ที่มี auth ชั้นเพิ่ม**
* **เปลี่ยน default password ทันทีหลังติดตั้ง**
* **ตั้งค่า password policy / rotate เป็นระยะ**

---

## 11. Monitoring / Logging

* ดู log แบบ realtime:

  ```bash
  journalctl -u rabbitmq-server -f
  ```
* ไฟล์ log เพิ่มเติมอยู่ที่: `/var/log/rabbitmq/`
* Metrics:

  * ใช้ `rabbitmq_exporter` ร่วมกับ Prometheus แล้วดึงไป Grafana (ถ้าต้องการ dashboard)
* Health check อย่างง่าย:

  ```bash
  rabbitmqctl status
  ```

---

## 12. Troubleshooting แบบรวบรัด

| ปัญหา                          | สาเหตุที่เป็นไปได้                               | แก้ไข                                                                                    |
| ------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| ไม่สามารถ authenticate ได้     | รหัสผ่าน/username ผิด, permission ไม่พอ          | `rabbitmqctl list_users`; `rabbitmqctl list_permissions -p /thermo`                      |
| ไม่เห็น exchange/queue         | ยังไม่ได้ประกาศ หรือตัวสะกดผิด                   | เช็คผ่าน Management UI หรือ `rabbitmqadmin list exchanges` / `rabbitmqadmin list queues` |
| Message ไม่ไหลเข้า queue       | binding, routing key ผิด                         | ตรวจ binding ผ่าน API หรือ UI; เปรียบเทียบ routing\_key                                  |
| Definition import แล้วไม่ทำงาน | `password_hash` ไม่ถูกต้อง                       | export ใหม่จาก UI แล้วใช้ hash จริง                                                      |
| MinIO ไม่ส่ง event             | การตั้งค่า AMQP ของ MinIO ผิด / user ไม่มีสิทธิ์ | ตรวจ log ของ MinIO, ตรวจว่า `minio_amqp_user` มี permission ใน RabbitMQ                  |

---

## 13. สรุป

คุณจะได้ระบบ RabbitMQ แบบ standalone ที่:

* ติดตั้ง Erlang + RabbitMQ ในวิธีที่ปลอดภัยทันสมัย
* มี vhost `/thermo` แยกความรับผิดชอบ
* มี user แยกตาม service และแยกสำหรับ MinIO
* ประกาศ `exchange`, `queue`, `binding` ตามฟลูว์ `raw.created` → `processed.created`
* สามารถ export/import definition เพื่อ reuse/replicate
* เชื่อมต่อกับ MinIO ผ่าน AMQP notification เพื่อขับเคลื่อน pipeline ของ ThermoSense
* มีแนวทาง security ขั้นต้นและ monitoring

---

## อ้างอิง

* RabbitMQ Official Docs
* RabbitMQ Management HTTP API
* MinIO AMQP Notification Guide
