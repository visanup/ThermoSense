# service/processing-service/app/services/processor.py

from app.utils.logger import get_logger
from app.utils.retry import retry
from app.services.processing import ImageProcessor  # <-- pulls in your full-featured class

logger = get_logger("processor")


class Processor:
    def __init__(self, roi: tuple[int, int, int, int]):
        """
        Initialize with a region of interest for cropping before OCR.

        :param roi: (x, y, width, height)
        """
        self.logger = logger
        self.roi = roi

    @retry(total_tries=3, initial_delay=0.5, backoff=2.0)
    def process(self, raw_bytes: bytes) -> bytes:
        """
        Full OCR-prep pipeline:
          1) correct_orientation
          2) crop_roi
          3) to_grayscale
          4) denoise
          5) threshold_adaptive
          6) invert_colors
          7) morphology_close
          8) deskew (if skew > max_skew)
          9) encode to PNG bytes
        """
        self.logger.info("Starting image processing pipeline")
        proc = ImageProcessor(raw_bytes)

        # 2) Crop to ROI if provided
        x, y, w, h = self.roi
        if w > 0 and h > 0:
            proc = proc.crop_roi(x, y, w, h)
        # 3-7) Grayscale, denoise, threshold, invert, morphology) Grayscale, denoise, threshold, invert, morphology
        proc = (
            proc
            .correct_orientation()
            # .crop_roi(x, y, w, h)
            # .to_grayscale()
            .denoise(h=5)
            # .threshold_adaptive(block_size=11, C=3)
            # .invert_colors()
            # # .morphology_open(kernel_size=(2,2))
            # .morphology_close(kernel_size=(3,3))
            # .dilate(kernel_size=(2,2), iterations=1)   # <-- เพิ่มตรงนี้
            # .deskew(max_skew=2.0)
        )

        # 9) Encode out as PNG
        result_bytes = proc.get_bytes(ext=".png")
        self.logger.info("Image processing complete")
        return result_bytes

