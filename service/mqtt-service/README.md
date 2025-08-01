# MQTT Broker (Mosquitto) สำหรับโครงการ ThermoSense

บริการนี้รับผิดชอบเป็นศูนย์กลางรับ-ส่งภาพจาก ESP32-CAM / sensor ผ่าน MQTT, ให้ ingestion-service ดึงภาพไปประมวลผลต่อใน pipeline แบบ event-driven

---

## สารบัญ

1. [ภาพรวม](#ภาพรวม)  
2. [Prerequisites](#prerequisites)  
3. [การติดตั้งบน Ubuntu (20.04 / 22.04)](#การติดตั้งบน-ubuntu-2004--2204)  
4. [การตั้งค่าเบื้องต้น](#การตั้งค่าเบื้องต้น)  
5. [ระบบยืนยันตัวตน (Authentication) และ ACL](#ระบบยืนยันตัวตน-authentication-และ-acl)  
6. [การอนุญาตให้เครื่องในเครือข่ายเดียวกันเข้าถึง](#การอนุญาตให้เครื่องในเครือข่ายเดียวกันเข้าถึง)  
7. [ทดสอบการทำงาน](#ทดสอบการทำงาน)  
8. [การตั้งค่า TLS (เลือกทำเพื่อความปลอดภัย)](#การตั้งค่า-tls-เลือกทำเพื่อความปลอดภัย)  
9. [การดูแลรักษา / Monitoring / Logging](#การดูแลรักษา--monitoring--logging)  
10. [การแก้ปัญหาทั่วไป](#การแก้ปัญหาทั่วไป)  

---

## ภาพรวม

- ใช้ **Eclipse Mosquitto** เป็น MQTT broker  
- รองรับ client หลายตัว เช่น ESP32-CAM, ingestion-service, processing-service  
- การสื่อสารควรใช้ topic แบบมีโครงสร้าง (ตัวอย่าง: `camera/image`, `sensor/{id}/status`)  
- ปกป้องด้วย username/password และ ACL  
- เปิดให้เครื่องใน LAN เดียวกันเข้าถึงได้  

---

## Prerequisites

- Ubuntu 20.04 หรือ 22.04 (มีสิทธิ์ `sudo`)  
- การเชื่อมต่อเครือข่ายภายใน (LAN)  
- ถ้าต้องการความปลอดภัยเพิ่มเติม: ความสามารถสร้าง TLS certificate  

---

## การติดตั้งบน Ubuntu (20.04 / 22.04)

1. อัพเดตแพ็กเกจ:

   ```bash
   sudo apt update
   sudo apt upgrade -y
    ````

2. ติดตั้ง Mosquitto และ client tools:

   ```bash
   sudo apt install -y mosquitto mosquitto-clients
   ```

3. เปิดใช้งานและให้มันเริ่มอัตโนมัติ:

   ```bash
   sudo systemctl enable mosquitto
   sudo systemctl start mosquitto
   ```

4. ตรวจสอบสถานะ:

   ```bash
   sudo systemctl status mosquitto
   ```

---

## การตั้งค่าเบื้องต้น

ไฟล์ config หลัก: `/etc/mosquitto/mosquitto.conf`
แนะนำแยกไฟล์ custom เช่น `/etc/mosquitto/conf.d/thermosense.conf`

ตัวอย่าง `/etc/mosquitto/conf.d/thermosense.conf`:

```conf
# ฟังทุก interface บนพอร์ต 1883 (MQTT ปกติ)
listener 1883

# ปิด anonymous access เพื่อบังคับ authentication
allow_anonymous false

# ไฟล์เก็บ user/password
password_file /etc/mosquitto/passwd

# ACL file เพื่อจำกัด topic ที่แต่ละ user ใช้ได้
acl_file /etc/mosquitto/acl

# เพิ่ม log detail
log_type all
```

หลังแก้ไฟล์ config ให้รีโหลด service:

```bash
sudo systemctl restart mosquitto
```

---

## ระบบยืนยันตัวตน (Authentication) และ ACL

### 1. สร้างผู้ใช้และรหัสผ่าน

```bash
sudo mosquitto_passwd -c /etc/mosquitto/passwd ingestion_user
# ใส่ password เช่น strongP@ss1
```

ถ้าจะเพิ่ม user ใหม่ (ไม่ลบไฟล์เดิม):

```bash
sudo mosquitto_passwd /etc/mosquitto/passwd camera_user
```

### 2. สร้าง ACL (ไฟล์ `/etc/mosquitto/acl`)

ตัวอย่าง ACL สำหรับ ThermoSense:

```text
# ingestion-service สามารถ publish raw image event
user ingestion_user
topic write camera/image

# processing-service อาจ subscribe กับ topic เฉพาะ
user processing_user
topic read raw.created
topic write processed.created

# ESP32-CAM (ชื่อ user สมมติ) ส่งภาพ
user camera_user
topic write camera/image

# frontend หรืออื่นๆ ดูข้อมูล (อ่าน)
user dashboard_user
topic read temperature/+
```

**หมายเหตุ:** ปรับชื่อ user และ topic ตามที่ระบบใช้จริง เช่น routing key ใน RabbitMQ อาจ map จาก event ที่ publish ผ่าน ingestion-service

หลังแก้ ACL ให้รีโหลด:

```bash
sudo systemctl reload mosquitto
```

---

## การอนุญาตให้เครื่องในเครือข่ายเดียวกันเข้าถึง

โดยดีฟอลต์ Mosquitto ฟังทุก interface หากต้องการจำกัดเฉพาะ LAN:

1. ตรวจสอบ IP เครื่อง server (สมมติ `192.168.1.104`)

   ```bash
   ip a
   ```

2. ถ้าใช้ firewall (UFW) เปิดพอร์ต MQTT:

   ```bash
   sudo ufw allow from 192.168.1.0/24 to any port 1883 proto tcp
   sudo ufw reload
   ```

   หรือเปิดทั่วไปภายใน LAN:

   ```bash
   sudo ufw allow 1883/tcp
   ```

3. (ถ้ามี) ป้องกันการเข้าถึงจากภายนอกโดยไม่ต้องการ:

   ```bash
   sudo ufw deny in on eth0 to any port 1883 proto tcp
   ```

---

## ทดสอบการทำงาน

### 1. ทดสอบ publish (จากเครื่องอื่นใน LAN)

```bash
mosquitto_pub -h 192.168.1.104 -u ingestion_user -P strongP@ss1 -t camera/image -m '{"device_uid":"incu-01","recorded_at":"2025-08-01T10:00:00Z","image_base64":"..."}'
```

### 2. ทดสอบ subscribe

```bash
mosquitto_sub -h 192.168.1.104 -u ingestion_user -P strongP@ss1 -t camera/image
```

หากได้ข้อความแสดงว่า broker รับส่งได้ปกติ

---

## การตั้งค่า TLS (เลือกทำเพื่อความปลอดภัย)

ถ้าต้องการเข้ารหัสการเชื่อมต่อ:

1. สร้าง self-signed cert (หรือใช้ CA จริง):

   ```bash
   sudo mkdir -p /etc/mosquitto/certs
   cd /etc/mosquitto/certs
   sudo openssl genrsa -out mosquitto.key 2048
   sudo openssl req -new -key mosquitto.key -out mosquitto.csr \
     -subj "/CN=thermosense.local"
   sudo openssl x509 -req -in mosquitto.csr -signkey mosquitto.key -out mosquitto.crt -days 365
   ```

2. ปรับ config เพิ่ม listener TLS:

   ```conf
   listener 8883
   cafile /etc/mosquitto/certs/mosquitto.crt
   certfile /etc/mosquitto/certs/mosquitto.crt
   keyfile /etc/mosquitto/certs/mosquitto.key
   ```

3. รีโหลด:

   ```bash
   sudo systemctl restart mosquitto
   ```

4. ทดสอบเชื่อมต่อ TLS:

   ```bash
   mosquitto_pub --tls-version tlsv1.2 -h 192.168.1.104 -p 8883 \
     --cafile /etc/mosquitto/certs/mosquitto.crt \
     -u ingestion_user -P strongP@ss1 -t camera/image -m '{"test":"tls"}'
   ```

---

## การดูแลรักษา / Monitoring / Logging

* 로그ดูได้จาก systemd:

  ```bash
  sudo journalctl -u mosquitto -f
  ```

* ปรับระดับ log ใน config (`log_type all`)

* สามารถต่อกับ external log collector (เช่น filebeat → ELK) ได้โดยส่ง output ของ journal

---

## การแก้ปัญหาทั่วไป

| ปัญหา                            | สาเหตุ                             | แก้ไข                                                           |
| -------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| ไม่สามารถเชื่อมต่อจากเครื่องอื่น | firewall บล็อก / user ผิด          | ตรวจ UFW, ชื่อผู้ใช้-รหัสผ่าน, IP, ACL                          |
| ได้รับ `Connection refused`      | Mosquitto ไม่รันหรือฟังผิดพอร์ต    | `sudo systemctl status mosquitto` / ดู config listener          |
| ไม่ผ่าน authentication           | credentials ผิด หรือ anonymous ปิด | ตรวจ `/etc/mosquitto/passwd` / ใช้ `mosquitto_passwd` สร้างใหม่ |
| ไม่ได้ topic ที่ควรได้           | ACL ปิดกั้น                        | ตรวจ `/etc/mosquitto/acl` และบทบาท user                         |

---

## ตัวอย่าง .env สำหรับ ingestion-service (เชื่อมต่อกับ MQTT)

```env
MQTT_BROKER_URL=mqtt://192.168.1.104:1883
MQTT_USER=ingestion_user
MQTT_PASSWORD=strongP@ss1
```

---

## สรุป

คุณได้ตั้งค่า MQTT Broker (Mosquitto) บน Ubuntu, เปิดใช้งาน authentication + ACL, อนุญาตให้เครื่องใน LAN เข้าถึง, และมีขั้นตอนทดสอบพื้นฐานแล้ว
ขั้นต่อไป: ผสานกับ ESP32-CAM (publish), ingestion-service (subscribe + upload), และ pipeline ต่อเนื่อง (processing / OCR / data-service)

---

## อ้างอิง

* Eclipse Mosquitto Official: [https://mosquitto.org/documentation/](https://mosquitto.org/documentation/)
* MQTT Specification: [http://mqtt.org/](http://mqtt.org/)
