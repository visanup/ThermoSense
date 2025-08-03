# service/processing-service/app/services/processor.py

from app.utils.logger import get_logger
from app.utils.retry import retry

# สมมติว่า processing_model.py อยู่ข้างๆ ไฟล์นี้ (ในเดียวกัน package)
from app.services.processing import ImageProcessor  

logger = get_logger("processor")


class Processor:
    def __init__(self):
        self.logger = logger

    @retry(total_tries=3, initial_delay=0.5, backoff=2.0)
    def process(self, raw_bytes: bytes) -> bytes:
        self.logger.info("Starting image processing pipeline")
        processor = ImageProcessor(raw_bytes)
        # Default pipeline: grayscale -> denoise -> adaptive threshold -> deskew
        processed = (
            processor
                .to_grayscale()
                .denoise()
                .threshold_adaptive()
                .deskew()
        )
        result_bytes = processed.get_bytes(ext=".png")
        self.logger.info("Image processing complete")
        return result_bytes
