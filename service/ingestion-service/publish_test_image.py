import paho.mqtt.client as mqtt
import base64
import json
import time
import sys
from pathlib import Path

# ปรับค่าตามจริง
MQTT_BROKER = "192.168.1.104"  # broker ภายนอกที่คุณใช้
MQTT_PORT = 1883
MQTT_USER = "admin"            # ถ้ามี
MQTT_PASSWORD = "admin1234"    # ถ้ามี
TOPIC_TEMPLATE = "camera/{device_uid}/image_json"
DEVICE_UID = "2"
IMAGE_PATH = "small.jpg"  # สร้างไฟล์ทดสอบไว้ข้างล่าง
CHUNK_SIZE = 1024 * 8  # base64 size per chunk before splitting (tweak ifอยากลองหลายชิ้น)

def load_image_bytes(path):
    return Path(path).read_bytes()

def chunk_and_publish(client, image_bytes, image_id):
    b64 = base64.b64encode(image_bytes).decode()
    # แบ่งเป็น chunk เล็ก
    total = (len(b64) + CHUNK_SIZE - 1) // CHUNK_SIZE
    for i in range(total):
        part = b64[i * CHUNK_SIZE : (i + 1) * CHUNK_SIZE]
        payload = {
            "id": image_id,
            "index": i,
            "total": total,
            "data": part,
        }
        topic = TOPIC_TEMPLATE.format(device_uid=DEVICE_UID)
        client.publish(topic, json.dumps(payload))
        print(f"Published chunk {i+1}/{total} to {topic}")
        time.sleep(0.1)  # ค่าเล็กๆ ช่วยให้ไม่อัดเร็วเกินไป

def main():
    # สร้างไฟล์ภาพเล็กๆ ถ้าไม่มี (1x1 pixel JPEG)
    if not Path(IMAGE_PATH).exists():
        from PIL import Image
        img = Image.new("RGB", (10, 10), color="blue")
        img.save(IMAGE_PATH, format="JPEG")
        print(f"Created test image {IMAGE_PATH}")

    image_bytes = load_image_bytes(IMAGE_PATH)
    image_id = f"test-{int(time.time())}"

    client = mqtt.Client()
    client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.connect(MQTT_BROKER, MQTT_PORT)
    client.loop_start()
    chunk_and_publish(client, image_bytes, image_id)
    time.sleep(2)  # รอให้ ingestion ประมวลผล
    client.loop_stop()
    client.disconnect()
    print("Done publishing. Image ID:", image_id)

if __name__ == "__main__":
    main()
