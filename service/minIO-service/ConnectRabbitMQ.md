# Connect RabbitMQ

## เวอร์ชันที่แก้ไขแล้ว (แนะนำ)

```json
{
  "version": "36",
  "notify": {
    "amqp": {
      "1": {
        "enable": true,
        "url": "amqp://minio_amqp_user:admin1234@rabbitmq:5672/thermo",
        "exchange": "thermo_exchange",
        "exchange_type": "direct",
        "routing_key": "raw.created",
        "durable": true,
        "delivery_mode": 2,
        "mandatory": false,
        "immediate": false,
        "secure": false,
        "verify": false
      },
      "2": {
        "enable": true,
        "url": "amqp://minio_amqp_user:admin1234@rabbitmq:5672/thermo",
        "exchange": "thermo_exchange",
        "exchange_type": "direct",
        "routing_key": "processed.created",
        "durable": true,
        "delivery_mode": 2,
        "mandatory": false,
        "immediate": false,
        "secure": false,
        "verify": false
      }
    }
  }
}
```

### ทำต่อหลังจากแก้ config.json

1. รีสตาร์ท MinIO เพื่อให้โหลด `config.json` ใหม่:

   ```sh
   docker compose restart minio
   ```

2. ตั้ง AMQP target สองตัว (raw / processed)

   ```powershell
   # สำหรับ raw.created:
   .\mc.exe alias set local http://localhost:9000 admin admin1234
   # สำหรับ raw.created:
   .\mc.exe admin config set local notify_amqp:1 `
      url=amqp://minio_amqp_user:admin1234@rabbitmq:5672/thermo `
      exchange=thermo_exchange `
      exchange_type=direct `
      routing_key=raw.created `
      delivery_mode=2
   # สำหรับ processed.created:
   .\mc.exe admin config set local notify_amqp:2 `
      url=amqp://minio_amqp_user:admin1234@rabbitmq:5672/thermo `
      exchange=thermo_exchange `
      exchange_type=direct `
      routing_key=processed.created `
      delivery_mode=2

   ```
3. รีสตาร์ท MinIO เพื่อให้ config ใหม่โหลด

    ```powershell
        .\mc.exe admin service restart local
    ```
4. ผูก bucket กับ ARN ที่ถูกต้อง
    
    สมมติ identifier ที่ใช้คือ PRIMARY กับ SECONDARY รูปแบบ ARN จะเป็น:
    - arn:minio:sqs::1:amqp
    - arn:minio:sqs::2:amqp

    ```powershell
      .\mc.exe event add local/thermo-raw arn:minio:sqs::1:amqp --event put
      .\mc.exe event add local/thermo-processed arn:minio:sqs::2:amqp --event put
    ```
    ตรวจว่า event ถูกผูก:

   ```powershell
    .\mc.exe event list local/thermo-raw
    .\mc.exe event list local/thermo-processed
   ```

5. ทดสอบ upload แล้วดูใน RabbitMQ

   ```powershell
   #upload
   .\mc.exe cp D:\ThermoSense\mg400-1.jpg local/thermo-raw/
   ```

5. ดู message ใน RabbitMQ queue ที่เกี่ยวข้อง:

   ```sh
   docker exec rabbitmq rabbitmqadmin -u admin -p admin1234 -V /thermo get queue=raw_created requeue=false count=1
   ```

---

## หมายเหตุเพิ่มเติม

* ถ้าต้องการกรอง prefix/suffix (เช่น ให้ trigger แค่ไฟล์ `.jpg`) ทำผ่าน `mc event add` ด้วย flag เพิ่มเติม เช่น `--suffix .jpg` หรือ `--prefix sometext/`
* `minio_amqp_user` ต้องมี permission เขียนเข้า `thermo_exchange` ซึ่งจาก definitions.json คุณตั้งไว้แล้ว (ตรวจใน RabbitMQ UI)
* ถ้ารหัสผ่านมีอักขระพิเศษใน URL แล้ว connection ล้มเหลว อาจต้อง URL-encode (เช่น `@` เป็น `%40`)

---

สรุป: ให้ใช้ไฟล์ config ที่ผมปรับด้านบน, ผูก bucket ด้วย `mc event add` ตามขั้นตอน แล้วทดสอบ end-to-end.
อยากให้ช่วยเขียนสคริปต์ทดสอบหรือ consumer ที่อ่าน event แล้วดึงไฟล์จาก MinIO ต่อเลยไหม?
