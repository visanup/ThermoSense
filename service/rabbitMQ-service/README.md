# การติดตั้งและตั้งค่า RabbitMQ บน Ubuntu สำหรับโครงการ ThermoSense

ไฟล์นี้อธิบายขั้นตอนการติดตั้งและตั้งค่า RabbitMQ บน Ubuntu 20.04/22.04 แบบไม่ใช้ Docker พร้อมการสร้าง vhosts, users, exchanges, queues, bindings, การเตรียมไฟล์ definitions สำหรับ import, และการเชื่อมต่อกับ MinIO Notifications เพื่อรองรับ Workflow ของระบบ ThermoSense

---

## สารบัญ

1. [Prerequisites](#prerequisites)  
2. [ติดตั้ง Erlang และ RabbitMQ](#1-ติดตั้ง-erlang-และ-rabbitmq)  
3. [เปิดใช้งาน Management Plugin และสตาร์ทบริการ](#2-เปิดใช้งาน-management-plugin-และสตาร์ทบริการ)  
4. [ตั้งค่า Firewall (ถ้ามี)](#3-ตั้งค่า-firewall-ถ้ามี)  
5. [สร้าง Virtual Host และ Users พร้อมสิทธิ์](#4-สร้าง-virtual-host-และ-users-พร้อมสิทธิ์)  
6. [สร้าง Exchange / Queues / Bindings](#5-สร้าง-exchange--queues--bindings)  
7. [เตรียม rabbitmq_definitions.json ที่ import ได้](#6-เตรียม-rabbitmqdefinitionsjson-ที่-import-ได้)  
8. [เชื่อมต่อกับ MinIO Notifications (AMQP)](#7-เชื่อมต่อกับ-minio-notifications-amqp)  
9. [Monitoring / Management / Logging](#8-monitoring--management--logging)  
10. [Troubleshooting](#9-troubleshooting)  
11. [สรุป](#10-สรุป)  

---

## Prerequisites

* Ubuntu 20.04 LTS หรือ 22.04 LTS  
* สิทธิ์ `sudo`  
* การเชื่อมต่อเครือข่ายภายใน (LAN)  
* อินเทอร์เน็ตเพื่อดาวน์โหลดแพ็กเกจ  
* (ถ้าจะ import definition พร้อม hash) เข้าถึง RabbitMQ Management UI เพื่อ export definitions  

---

## 1. ติดตั้ง Erlang และ RabbitMQ

```bash
# อัพเดตระบบ
sudo apt update
sudo apt upgrade -y

# ติดตั้ง dependencies
sudo apt-get install -y curl gnupg apt-transport-https

# เพิ่ม Erlang Solutions repository
curl -fsSL https://packages.erlang-solutions.com/erlang-solutions_2.0_all.deb | sudo dpkg -i -
sudo apt-get update
sudo apt-get install -y erlang

# เพิ่ม RabbitMQ repository และ key
curl -fsSL https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA | sudo apt-key add -
sudo tee /etc/apt/sources.list.d/rabbitmq.list <<EOF
# RabbitMQ Stable
deb https://dl.cloudsmith.io/public/rabbitmq/rabbitmq-server/deb/ubuntu $(lsb_release -cs) main
EOF

sudo apt-get update
sudo apt-get install -y rabbitmq-server
````

---

## 2. เปิดใช้งาน Management Plugin และสตาร์ทบริการ

```bash
# เปิด Web UI (management)
sudo rabbitmq-plugins enable rabbitmq_management

# ให้สตาร์ทอัตโนมัติและเริ่ม
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server
```

* **Management UI:** `http://YOUR_SERVER_IP:15672` (default user/password: `guest`/`guest` ถ้าใช้ localhost เท่านั้น)
* **AMQP Port:** 5672

> *หมายเหตุ:* ถ้าวางระบบจริงควรสร้าง user ใหม่และปิด `guest` access จาก network ภายนอก

---

## 3. ตั้งค่า Firewall (ถ้ามี)

```bash
sudo ufw allow 5672/tcp    # AMQP
sudo ufw allow 15672/tcp   # Management UI
sudo ufw reload
```

---

## 4. สร้าง Virtual Host และ Users พร้อมสิทธิ์

แยก user ตามบทบาทเพื่อจำกัดสิทธิ์:

```bash
# สร้าง vhost
sudo rabbitmqctl add_vhost /thermo

# สร้าง user สำหรับแต่ละ service
sudo rabbitmqctl add_user ingestion_user strongP@ss1
sudo rabbitmqctl add_user processing_user strongP@ss2
sudo rabbitmqctl add_user ocr_user strongP@ss3

# กำหนด permissions บน vhost /thermo
sudo rabbitmqctl set_permissions -p /thermo ingestion_user ".*" ".*" ".*"
sudo rabbitmqctl set_permissions -p /thermo processing_user "" "processed.created" "raw.created"
sudo rabbitmqctl set_permissions -p /thermo ocr_user "" "processed.created" "raw.created"
```

> ปรับ `strongP@ss1` ฯลฯ ให้เป็นรหัสผ่านที่ปลอดภัยตามนโยบายองค์กร

---

## 5. สร้าง Exchange / Queues / Bindings

### 5.1 ติดตั้ง `rabbitmqadmin` (ถ้ายังไม่มี)

```bash
curl -O http://localhost:15672/cli/rabbitmqadmin
chmod +x rabbitmqadmin
sudo mv rabbitmqadmin /usr/local/bin/
```

### 5.2 สร้าง exchange, queue, binding

```bash
# สร้าง direct exchange
rabbitmqadmin --host=localhost --port=15672 --username=ingestion_user --password=strongP@ss1 --vhost=/thermo declare exchange name=thermo_exchange type=direct durable=true

# สร้าง queues
rabbitmqadmin --vhost=/thermo --username=processing_user --password=strongP@ss2 declare queue name=raw_created durable=true
rabbitmqadmin --vhost=/thermo --username=ocr_user --password=strongP@ss3 declare queue name=processed_created durable=true

# สร้าง bindings
rabbitmqadmin --vhost=/thermo --username=processing_user --password=strongP@ss2 declare binding source=thermo_exchange destination=raw_created routing_key=raw.created
rabbitmqadmin --vhost=/thermo --username=ocr_user --password=strongP@ss3 declare binding source=thermo_exchange destination=processed_created routing_key=processed.created
```

### 5.3 (สำรอง) สร้างผ่าน HTTP API ด้วย curl

```bash
# Exchange
curl -u ingestion_user:strongP@ss1 -XPUT \
  -H "content-type:application/json" \
  -d '{"type":"direct","durable":true}' \
  http://localhost:15672/api/exchanges/%2Fthermo/thermo_exchange

# Queue raw_created
curl -u processing_user:strongP@ss2 -XPUT \
  http://localhost:15672/api/queues/%2Fthermo/raw_created \
  -H "content-type:application/json" -d '{"durable":true}'

# Queue processed_created
curl -u ocr_user:strongP@ss3 -XPUT \
  http://localhost:15672/api/queues/%2Fthermo/processed_created \
  -H "content-type:application/json" -d '{"durable":true}'

# Binding raw.created -> raw_created
curl -u processing_user:strongP@ss2 -XPOST \
  -H "content-type:application/json" \
  -d '{"routing_key":"raw.created","arguments":{}}' \
  http://localhost:15672/api/bindings/%2Fthermo/e/thermo_exchange/q/raw_created

# Binding processed.created -> processed_created
curl -u ocr_user:strongP@ss3 -XPOST \
  -H "content-type:application/json" \
  -d '{"routing_key":"processed.created","arguments":{}}' \
  http://localhost:15672/api/bindings/%2Fthermo/e/thermo_exchange/q/processed_created
```

---

## 6. เตรียม `rabbitmq_definitions.json` ที่ import ได้

เพื่อให้นำการตั้งค่าทั้งหมดมาใช้ซ้ำได้ (ผ่าน Management UI → Import Definitions):

1. ก่อนอื่นให้ **export definitions** จากระบบที่ตั้งค่าสำเร็จ (เมนู Export Definitions) จะได้ไฟล์ที่มี `password_hash` จริงสำหรับ user
2. ถ้าอยากสร้าง template แล้วนำมาเติมเอง ให้ใช้โครงสร้างตัวอย่างด้านล่าง **แต่ต้องแทนค่า `password_hash` ด้วย hash จริง** ที่ได้จาก export:

```json
{
  "rabbit_version": "3.10.0",
  "users": [
    {
      "name": "ingestion_user",
      "password_hash": "ACTUAL_HASH_FROM_EXPORT",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": ""
    },
    {
      "name": "processing_user",
      "password_hash": "ACTUAL_HASH_FROM_EXPORT",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": ""
    },
    {
      "name": "ocr_user",
      "password_hash": "ACTUAL_HASH_FROM_EXPORT",
      "hashing_algorithm": "rabbit_password_hashing_sha256",
      "tags": ""
    }
  ],
  "vhosts": [
    { "name": "/thermo" }
  ],
  "permissions": [
    {
      "user": "ingestion_user",
      "vhost": "/thermo",
      "configure": ".*",
      "write": ".*",
      "read": ".*"
    },
    {
      "user": "processing_user",
      "vhost": "/thermo",
      "configure": "",
      "write": "processed.created",
      "read": "raw.created"
    },
    {
      "user": "ocr_user",
      "vhost": "/thermo",
      "configure": "",
      "write": "processed.created",
      "read": "raw.created"
    }
  ],
  "exchanges": [
    {
      "name": "thermo_exchange",
      "vhost": "/thermo",
      "type": "direct",
      "durable": true,
      "auto_delete": false,
      "internal": false,
      "arguments": {}
    }
  ],
  "queues": [
    {
      "name": "raw_created",
      "vhost": "/thermo",
      "durable": true,
      "auto_delete": false,
      "arguments": {}
    },
    {
      "name": "processed_created",
      "vhost": "/thermo",
      "durable": true,
      "auto_delete": false,
      "arguments": {}
    }
  ],
  "bindings": [
    {
      "source": "thermo_exchange",
      "vhost": "/thermo",
      "destination": "raw_created",
      "destination_type": "queue",
      "routing_key": "raw.created",
      "arguments": {}
    },
    {
      "source": "thermo_exchange",
      "vhost": "/thermo",
      "destination": "processed_created",
      "destination_type": "queue",
      "routing_key": "processed.created",
      "arguments": {}
    }
  ]
}
```

> **ห้ามใช้คำว่า `"PLACEHOLDER"` ใน `password_hash`** — ต้องได้ค่าจากการ export จริงเท่านั้น

---

## 7. เชื่อมต่อกับ MinIO Notifications (AMQP)

ตั้งค่าให้ MinIO ส่ง event เข้า RabbitMQ ตาม workflow:

```bash
# raw bucket -> raw_created
mc event add local/thermo-raw \
  arn:minio:sqs::1:amqp --event put --suffix .jpg \
  --amqp-exchange thermo_exchange \
  --amqp-queue raw_created \
  --amqp-routing-key raw.created \
  --amqp-username ingestion_user \
  --amqp-password strongP@ss1 \
  --amqp-vhost /thermo \
  --amqp-uri "amqp://localhost:5672/"

# processed bucket -> processed_created
mc event add local/thermo-processed \
  arn:minio:sqs::1:amqp --event put --suffix .jpg \
  --amqp-exchange thermo_exchange \
  --amqp-queue processed_created \
  --amqp-routing-key processed.created \
  --amqp-username ingestion_user \
  --amqp-password strongP@ss1 \
  --amqp-vhost /thermo \
  --amqp-uri "amqp://localhost:5672/"
```

> แนะนำให้สร้าง user แยกสำหรับ MinIO ถ้าต้องการแยกสิทธิ์ (เช่น `minio_amqp_user`) แล้วให้ permissions เหมาะสม

---

## 8. Monitoring / Management / Logging

* **Management UI:** `http://YOUR_SERVER_IP:15672`
* **Logs:** ดูได้จาก `journalctl -u rabbitmq-server -f` หรือที่ `/var/log/rabbitmq/`
* **Metrics (optional):** ใช้ `rabbitmq_exporter` ร่วมกับ Prometheus

---

## 9. Troubleshooting

| ปัญหา                          | สาเหตุที่เป็นไปได้               | วิธีแก้                                                                    |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------------- |
| เชื่อมต่อ AMQP ไม่ได้          | ผู้ใช้/รหัสผ่านผิด, vhost ไม่ตรง | ตรวจ `rabbitmqctl list_users`, `rabbitmqctl list_vhosts`, ตรวจ permissions |
| ไม่เห็น exchange/queue         | ยังไม่ได้ประกาศ หรือชื่อผิด      | ตรวจผ่าน Management UI หรือ `rabbitmqadmin list exchanges`                 |
| message ไม่ไปที่ queue         | binding หรือ routing key ผิด     | ตรวจ binding กับ routing\_key ว่าตรงกัน                                    |
| authentication ล้มเหลว         | user ไม่มีสิทธิ์บน vhost         | รัน `rabbitmqctl list_permissions -p /thermo`                              |
| definition import แล้วไม่ทำงาน | `password_hash` ไม่ใช่ hash จริง | export ใหม่จาก UI แล้วใช้ไฟล์ที่ได้                                        |

---

## 10. สรุป

คุณได้ติดตั้ง RabbitMQ, สร้าง vhost `/thermo`, users แยกตาม service, กำหนด permissions, ประกาศ exchange/queue/bindings, เตรียม definition สำหรับ reuse, และเชื่อมต่อกับ MinIO เพื่อให้ event-driven pipeline (raw\.created → processing → processed.created → OCR) ทำงานตามที่ออกแบบไว้ในโครงการ ThermoSense ได้ครบถ้วน

---

## อ้างอิง

* RabbitMQ Documentation: [https://www.rabbitmq.com](https://www.rabbitmq.com)
* RabbitMQ Management HTTP API: [https://rawcdn.githack.com/rabbitmq/rabbitmq-management/v3.10.0/priv/www/api/index.html](https://rawcdn.githack.com/rabbitmq/rabbitmq-management/v3.10.0/priv/www/api/index.html)
* MinIO AMQP Notification: [https://docs.min.io/docs/minio-legacy-amqp-notification-guide.html](https://docs.min.io/docs/minio-legacy-amqp-notification-guide.html)

