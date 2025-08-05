# app/services/processor.py

import requests
import base64
import re
from PIL import Image
from io import BytesIO
from app.config import Config
from app.utils.logger import get_logger

logger = get_logger("processor")

class OCRLLMProcessor:
    """
    ใช้ Qwen 2.5 multimodal ผ่าน endpoint เดียวเพื่ออ่านอุณหภูมิจากภาพ
    ไม่ใช้ Tesseract หรือ OpenCV อีกต่อไป
    """
    def __init__(self):
        # endpoint สำหรับ multimodal chat-completions
        self.url = Config.LMSTUDIO_URL  # เช่น "http://localhost:4000/v1/chat/completions"
        # โมเดล multimodal instruction
        self.model = "qwen2.5-vl-3b-instruct"

    def extract_temperature(self, image_path: str) -> float:
        """
        ส่งภาพในรูปแบบ base64 พร้อม prompt ไปยัง Qwen 2.5 เพื่อสกัดอุณหภูมิ (°C)
        """
        # อ่านภาพและ encode เป็น base64
        with open(image_path, "rb") as f:
            img_bytes = f.read()
        img_b64 = base64.b64encode(img_bytes).decode('utf-8')

        # สร้างข้อความ prompt multimodal
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": "กรุณาอ่านอุณหภูมิบนภาพนี้และตอบเป็นตัวเลข (°C) เท่านั้น"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
            ]
        }]

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 10,
            "top_p": 0.9,
            "stop": ["\n"]
        }

        resp = requests.post(self.url, json=payload)
        resp.raise_for_status()
        data = resp.json()

        try:
            # ดึงข้อความจาก response
            choice = data["choices"][0]
            content = choice.get("message", {}).get("content") or choice.get("text") or ""
            text_out = content.strip()
            # ใช้ regex หา pattern ตัวเลขลอย
            match = re.search(r"[-+]?\d*\.\d+|\d+", text_out)
            if not match:
                raise ValueError(f"No numeric value found in LLM response: '{text_out}'")
            return float(match.group())
        except Exception as e:
            logger.error("Failed parse LLM response: %s", data)
            raise ValueError(f"Failed to parse temperature from response: {e}")

    def process(self, image_path: str) -> float:
        """
        รัน pipeline multimodal: ส่งภาพขึ้น LM Studio แล้วรับค่าอุณหภูมิ
        """
        logger.info("Starting processing for image %s", image_path)
        temp = self.extract_temperature(image_path)
        logger.info("Processing complete: %.2f°C", temp)
        return temp
