import io
import cv2
import numpy as np
from io import BytesIO
from PIL import Image, ImageOps, ExifTags

class ImageProcessor:
    """
    A class to perform common image processing steps before OCR.

    Usage:
        processor = ImageProcessor(image_bytes)
        processed_bytes = (
            processor
                .correct_orientation()
                .crop_roi(x, y, w, h)
                .to_grayscale()
                .denoise(h=10)
                .threshold_adaptive(block_size=11, C=2)
                .invert_colors()
                .morphology_close(kernel_size=(3,3))
                .deskew(max_skew=2.0)
                .get_bytes(ext='.png')
        )
    """

    def __init__(self, image_bytes: bytes):
        # Store raw bytes
        self.original_bytes = image_bytes
        # Decode initial image as BGR
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image bytes")
        self.processed = img.copy()

    def correct_orientation(self) -> "ImageProcessor":
        """
        Read EXIF orientation and rotate pixel data accordingly (reset tag).
        """
        try:
            pil = Image.open(BytesIO(self.original_bytes))
            pil = ImageOps.exif_transpose(pil)
            self.processed = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        except Exception:
            pass
        return self

    def crop_roi(self, x: int, y: int, w: int, h: int) -> "ImageProcessor":
        """
        Crop region of interest from the processed image.
        """
        self.processed = self.processed[y:y+h, x:x+w]
        return self

    def to_grayscale(self) -> "ImageProcessor":
        self.processed = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY)
        return self

    def denoise(self, h: float = 10.0, templateWindowSize: int = 7, searchWindowSize: int = 21) -> "ImageProcessor":
        if len(self.processed.shape) == 3:
            gray = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY)
        else:
            gray = self.processed
        self.processed = cv2.fastNlMeansDenoising(
            gray, None, h, templateWindowSize, searchWindowSize
        )
        return self

    def threshold_adaptive(self, block_size: int = 11, C: int = 1.5) -> "ImageProcessor":
        if len(self.processed.shape) == 3:
            gray = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY)
        else:
            gray = self.processed
        self.processed = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            block_size, C
        )
        return self

    def invert_colors(self) -> "ImageProcessor":
        """
        Invert binary image colors (white <-> black) for OCR clarity.
        """
        self.processed = cv2.bitwise_not(self.processed)
        return self
    
    def morphology_open(self, kernel_size: tuple = (2,2)) -> "ImageProcessor":
        """
        Remove small white specks (noise) by opening (erosion + dilation).
        """
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, kernel_size)
        self.processed = cv2.morphologyEx(
            self.processed,
            cv2.MORPH_OPEN,
            kernel
        )
        return self

    def morphology_close(self, kernel_size: tuple = (3,3)) -> "ImageProcessor":
        """
        Apply morphological closing to close small holes in text strokes.
        """
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, kernel_size)
        self.processed = cv2.morphologyEx(
            self.processed, cv2.MORPH_CLOSE, kernel
        )
        return self
    
    def dilate(self, kernel_size: tuple = (2,2), iterations: int = 1) -> "ImageProcessor":
        """
        Thicken strokes by dilating the binary image.
        """
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, kernel_size)
        self.processed = cv2.dilate(self.processed, kernel, iterations=iterations)
        return self

    def deskew(self, max_skew: float = 2.0) -> "ImageProcessor":
        """
        Estimate skew and rotate if abs(angle) > max_skew degrees.
        """
        gray = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY) \
            if len(self.processed.shape) == 3 else self.processed
        blur = cv2.GaussianBlur(gray, (9, 9), 0)
        _, bw = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(bw > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        # only rotate if significant skew
        if abs(angle) <= max_skew:
            return self
        (h, w) = self.processed.shape[:2]
        M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
        self.processed = cv2.warpAffine(
            self.processed, M, (w, h),
            flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        return self

    def get_bytes(self, ext: str = '.png', quality: int = 95) -> bytes:
        params = []
        if ext.lower() in ('.jpg', '.jpeg'):
            params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        success, buf = cv2.imencode(ext, self.processed, params)
        if not success:
            raise ValueError("Failed to encode image")
        return buf.tobytes()

    def reset(self) -> "ImageProcessor":
        arr = np.frombuffer(self.original_bytes, np.uint8)
        self.processed = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return self

    def pipeline(self, steps: list) -> "ImageProcessor":
        for name, kwargs in steps:
            fn = getattr(self, name, None)
            if not fn:
                raise AttributeError(f"No such method: {name}")
            fn(**kwargs)
        return self
