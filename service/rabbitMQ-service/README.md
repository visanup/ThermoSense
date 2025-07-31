# การติดตั้งและตั้งค่า RabbitMQ บน Ubuntu สำหรับโครงการ ThermoSense

ไฟล์นี้อธิบายขั้นตอนการติดตั้งและตั้งค่า RabbitMQ บน Ubuntu 20.04/22.04 แบบไม่ใช้ Docker พร้อมการสร้าง vhosts, users, exchanges, queues และการเชื่อมต่อกับ MinIO Notifications เพื่อรองรับ Workflow ของระบบ ThermoSense

---

## Prerequisites

* ระบบปฏิบัติการ: Ubuntu 20.04 LTS หรือ Ubuntu 22.04 LTS
* ผู้ใช้งานมีสิทธิ์ `sudo`
* การเชื่อมต่ออินเทอร์เน็ตเพื่อดาวน์โหลดแพ็กเกจ

---

## 1. ติดตั้ง Erlang (Dependency ของ RabbitMQ)

```bash
# ติดตั้ง dependencies
sudo apt-get update
sudo apt-get install -y curl gnupg apt-transport-https

# เพิ่ม Erlang Solutions repository
curl -fsSL https://packages.erlang-solutions.com/erlang-solutions_2.0_all.deb | sudo dpkg -i -
sudo apt-get update

# ติดตั้ง Erlang
sudo apt-get install -y erlang
```

---

## 2. ติดตั้ง RabbitMQ Server

```bash
# เพิ่ม RabbitMQ Signing Key
curl -fsSL https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA | sudo apt-key add -

# เพิ่ม RabbitMQ APT repository
sudo tee /etc/apt/sources.list.d/rabbitmq.list <<EOF
# RabbitMQ Stable
deb https://dl.cloudsmith.io/public/rabbitmq/rabbitmq-server/deb/ubuntu $(lsb_release -cs) main
EOF

# ติดตั้ง RabbitMQ
sudo apt-get update
sudo apt-get install -y rabbitmq-server
```

---

## 3. เปิดใช้งาน Management Plugin และบริการ

```bash
# เปิด plugin สำหรับ Web UI
sudo rabbitmq-plugins enable rabbitmq_management

# รีสตาร์ท service
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server
```

* **Management UI**: http\://YOUR\_SERVER\_IP:15672  (Default user/password: guest/guest)
* **AMQP Port**: 5672

---

## 4. ตั้งค่า Firewall (ถ้ามี)

```bash
sudo ufw allow 5672/tcp   # AMQP
sudo ufw allow 15672/tcp  # Management UI
sudo ufw reload
```

---

## 5. สร้าง Virtual Hosts และ Users

ระบบ ThermoSense แนะนำให้ใช้ vhost และ user แยกตาม service:

```bash
# เพิ่ม vhost
sudo rabbitmqctl add_vhost /thermo

# เพิ่ม users
sudo rabbitmqctl add_user ingestion_user strongP@ss1
sudo rabbitmqctl add_user processing_user strongP@ss2
sudo rabbitmqctl add_user ocr_user strongP@ss3

# กำหนด permissions (อ่าน/เขียน/Configure) บน /thermo
sudo rabbitmqctl set_permissions -p /thermo ingestion_user ".*" ".*" ".*"
sudo rabbitmqctl set_permissions -p /thermo processing_user ".*" ".*" ".*"
sudo rabbitmqctl set_permissions -p /thermo ocr_user ".*" ".*" ".*"
```

---

## 6. สร้าง Exchanges, Queues และ Bindings

ใช้ `rabbitmqadmin` (หรือติดตั้งผ่าน `apt install rabbitmqadmin`) หรือใช้ CLI ผ่าน HTTP API:

### 6.1 ตัวอย่างด้วย `rabbitmqadmin`

```bash
# ดาวน์โหลด rabbitmqadmin
curl -O https://raw.githubusercontent.com/rabbitmq/rabbitmq-management/v3.8.9/bin/rabbitmqadmin
chmod +x rabbitmqadmin
sudo mv rabbitmqadmin /usr/local/bin/

# กำหนด alias สำหรับใช้งาน
rabbitmqadmin --host=localhost --port=15672 --username=ingestion_user --password=strongP@ss1 \
  --vhost=/thermo \
  declare exchange name=thermo_exchange type=direct durable=true

# สร้าง queues
rabbitmqadmin --vhost=/thermo --username=processing_user --password=strongP@ss2 declare queue name=raw_created durable=true
rabbitmqadmin --vhost=/thermo --username=ocr_user --password=strongP@ss3 declare queue name=processed_created durable=true

# สร้าง bindings
rabbitmqadmin --vhost=/thermo --username=processing_user --password=strongP@ss2 \
  declare binding source=thermo_exchange destination=raw_created routing_key=raw.created

rabbitmqadmin --vhost=/thermo --username=ocr_user --password=strongP@ss3 \
  declare binding source=thermo_exchange destination=processed_created routing_key=processed.created
```

### 6.2 ตัวอย่างผ่าน HTTP API (curl)

```bash
# สร้าง exchange
curl -u ingestion_user:strongP@ss1 -XPUT \
  -H "content-type:application/json" \
  -d '{"type":"direct","durable":true}' \
  http://localhost:15672/api/exchanges/%2Fthermo/thermo_exchange

# สร้าง queue raw_created
curl -u processing_user:strongP@ss2 -XPUT \
  http://localhost:15672/api/queues/%2Fthermo/raw_created \
  -H "content-type:application/json" -d '{"durable":true}'

# สร้าง queue processed_created
curl -u ocr_user:strongP@ss3 -XPUT \
  http://localhost:15672/api/queues/%2Fthermo/processed_created \
  -H "content-type:application/json" -d '{"durable":true}'

# สร้าง binding raw.created
curl -u processing_user:strongP@ss2 -XPOST \
  -H "content-type:application/json" \
  -d '{"routing_key":"raw.created","arguments":{}}' \
  http://localhost:15672/api/bindings/%2Fthermo/e/thermo_exchange/q/raw_created

# สร้าง binding processed.created
curl -u ocr_user:strongP@ss3 -XPOST \
  -H "content-type:application/json" \
  -d '{"routing_key":"processed.created","arguments":{}}' \
  http://localhost:15672/api/bindings/%2Fthermo/e/thermo_exchange/q/processed_created
```

---

## 7. การใช้งานร่วมกับ MinIO Notifications (AMQP)

ตั้งค่า MinIO ให้ส่ง S3 event ไปยัง RabbitMQ:

```bash
mc event add local/thermo-raw \
  arn:minio:sqs::1:amqp --event put --suffix .jpg \
  --amqp-exchange thermo_exchange \
  --amqp-queue raw_created \
  --amqp-routing-key raw.created \
  --amqp-username ingestion_user \
  --amqp-password strongP@ss1 \
  --amqp-vhost /thermo \
  --amqp-uri "amqp://localhost:5672/"

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

> หมายเหตุ: ใช้ `ingestion_user` สำหรับการเชื่อมต่อ AMQP จาก MinIO¹

---

## 8. Monitoring และ Management

* **Management UI**: http\://YOUR\_SERVER\_IP:15672
* **Prometheus Exporter**: [rabbitmq\_exporter](https://github.com/kbudde/rabbitmq_exporter)
* **Logs**: `/var/log/rabbitmq/`

---

## 9. สรุป

คุณได้ติดตั้ง RabbitMQ และตั้งค่า vhosts, users, exchanges, queues, bindings พร้อมเชื่อมต่อกับ MinIO Notifications เสร็จเรียบร้อย สามารถใช้งาน Event-driven Workflow ในโครงการ ThermoSense ได้ทันที

---

¹ ปรับชื่อ user/credentials ตาม policy ขององค์กร
