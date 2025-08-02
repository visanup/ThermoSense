# MinIO Client Install on window

### 1. ดาวน์โหลด `mc.exe` (MinIO Client) แบบแมนนวล

* ไปที่หน้าโหลดของ MinIO Client (จากเบราว์เซอร์) แล้วเอาไฟล์สำหรับ Windows x64:
  ตัวอย่างชื่อไฟล์ `mc.exe` (ถ้าอยากให้ผมพิมพ์คำสั่ง PowerShell ดาวน์โหลดตรงๆ ก็ใช้ข้างล่าง)

#### PowerShell ดาวน์โหลดโดยตรง:

```powershell
# ดาวน์โหลด mc.exe ลงไปที่โฟลเดอร์ปัจจุบัน
Invoke-WebRequest -Uri "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile .\mc.exe
```

### 2. รันตรวจ version เพื่อยืนยัน

```powershell
.\mc.exe --version
```

(ถ้าอยากใช้จากที่ไหนก็ได้ ให้เอา `mc.exe` ใส่ไว้ในโฟลเดอร์ที่อยู่ใน `%PATH%` หรือเพิ่มโฟลเดอร์นั้นเข้า PATH)

### 3. ตั้ง alias เชื่อมกับ MinIO ที่รันอยู่

```powershell
.\mc.exe alias set local http://localhost:9000 admin admin1234
```

เช็กว่าเชื่อมได้:

```powershell
.\mc.exe ls local
```

### 4. สร้าง buckets และเปิด versioning

```powershell
.\mc.exe mb local/thermo-raw
.\mc.exe mb local/thermo-processed

.\mc.exe version enable local/thermo-raw
.\mc.exe version enable local/thermo-processed

# ตรวจสถานะ versioning
.\mc.exe version info local/thermo-raw
.\mc.exe version info local/thermo-processed
```

### 5. ตั้ง lifecycle rule (ลบเวอร์ชันเก่าหลัง 30 วัน)

สร้างไฟล์ `lifecycle.json` (ใน PowerShell):

```powershell
@'
{
  "Rules": [
    {
      "ID": "expire-old-versions",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 30
      }
    }
  ]
}
'@ | Out-File -Encoding ascii lifecycle.json
```

นำไปใช้:

```powershell
Get-Content .\lifecycle.json | .\mc.exe ilm import local/thermo-raw
Get-Content .\lifecycle.json | .\mc.exe ilm import local/thermo-processed

# ตรวจสอบ rule
.\mc.exe ilm export local/thermo-raw
.\mc.exe ilm export local/thermo-processed

# ยืนยันว่า versioning เปิดอยู่ บนทั้งสอง bucket
# ถ้ายังไม่ได้รัน:
.\mc.exe version enable local/thermo-raw
.\mc.exe version enable local/thermo-processed
# ตรวจสถานะ:
.\mc.exe version info local/thermo-raw
.\mc.exe version info local/thermo-processed

```

### 6. อัปโหลดไฟล์พร้อม server-side encryption (SSE-S3)

```powershell
.\mc.exe cp D:\ThermoSense\mg400-1.jpg local/thermo-raw/ --attr "x-amz-server-side-encryption:AES256"
```



## ถ้าคุณไม่อยากยุ่งกับ CLI ตอนนี้

บอกผมว่าอยากได้:

* ตัวอย่างโค้ด upload จาก service (เช่น Python / JS) ที่ใส่ header SSE-S3 แล้วเขียน metadata
* Policy แบบจำกัดสิทธิ์ให้แต่ละ service เขียน/อ่าน bucket แบบปลอดภัย
* หรือให้ผมสร้างชุดคำสั่งเริ่มต้นให้เป็นไฟล์ `.ps1` ให้เรียกครั้งเดียว

ต้องการแบบไหนต่อ?
