import cv2
import numpy as np
from io import BytesIO

class ImageProcessor:
    """
    A class to perform common image processing steps before OCR.

    Usage:
        processor = ImageProcessor(image_bytes)
        processed_bytes = (
            processor
                .to_grayscale()
                .resize(width=1024)
                .denoise(h=10)
                .threshold_adaptive(block_size=11, C=2)
                .deskew()
                .get_bytes(ext='.png')
        )
    """

    def __init__(self, image_bytes: bytes):
        # Load the image from raw bytes
        self.original_bytes = image_bytes
        self.image = self._load_image(image_bytes)
        # Use processed to chain operations
        self.processed = self.image.copy()

    def _load_image(self, image_bytes: bytes) -> np.ndarray:
        """
        Decode image bytes into an OpenCV BGR image.
        """
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image bytes")
        return img

    def to_grayscale(self) -> "ImageProcessor":
        """
        Convert image to grayscale.
        """
        self.processed = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY)
        return self

    def resize(self, width: int = None, height: int = None, keep_aspect: bool = True) -> "ImageProcessor":
        """
        Resize image to specified width or height. Maintains aspect ratio by default.
        """
        h, w = self.processed.shape[:2]
        if width is None and height is None:
            return self
        if keep_aspect:
            if width is not None:
                ratio = width / float(w)
                dim = (width, int(h * ratio))
            else:
                ratio = height / float(h)
                dim = (int(w * ratio), height)
        else:
            dim = (width or w, height or h)
        self.processed = cv2.resize(self.processed, dim, interpolation=cv2.INTER_AREA)
        return self

    def adjust_contrast_brightness(self, alpha: float = 1.2, beta: int = 0) -> "ImageProcessor":
        """
        Adjust contrast (alpha) and brightness (beta).
        alpha: contrast multiplier (>1 to increase, <1 to decrease)
        beta: brightness offset (positive to brighten)
        """
        self.processed = cv2.convertScaleAbs(self.processed, alpha=alpha, beta=beta)
        return self

    def denoise(self, h: float = 10.0, templateWindowSize: int = 7, searchWindowSize: int = 21) -> "ImageProcessor":
        """
        Apply Non-Local Means Denoising. Only works on grayscale.
        """
        if len(self.processed.shape) == 3:
            gray = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY)
        else:
            gray = self.processed
        self.processed = cv2.fastNlMeansDenoising(
            gray, None, h, templateWindowSize, searchWindowSize
        )
        return self

    def threshold_otsu(self) -> "ImageProcessor":
        """
        Apply Otsu's thresholding to binarize the image.
        """
        if len(self.processed.shape) == 3:
            gray = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY)
        else:
            gray = self.processed
        _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        self.processed = th
        return self

    def threshold_adaptive(self, block_size: int = 11, C: int = 2) -> "ImageProcessor":
        """
        Apply adaptive Gaussian thresholding.
        block_size: size of pixel neighborhood
        C: constant subtracted from mean
        """
        if len(self.processed.shape) == 3:
            gray = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY)
        else:
            gray = self.processed
        th = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, block_size, C
        )
        self.processed = th
        return self

    def deskew(self) -> "ImageProcessor":
        """
        Estimate skew angle and rotate image to correct it.
        Uses binary projection profile.
        """
        # Convert to binary
        gray = cv2.cvtColor(self.processed, cv2.COLOR_BGR2GRAY) if len(self.processed.shape) == 3 else self.processed
        blur = cv2.GaussianBlur(gray, (9, 9), 0)
        _, bw = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(bw > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        # Rotate
        (h, w) = self.processed.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        self.processed = cv2.warpAffine(
            self.processed, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        return self

    def get_bytes(self, ext: str = '.jpg', quality: int = 95) -> bytes:
        """
        Encode processed image to bytes (JPEG/PNG).
        ext: file extension (".jpg" or ".png").
        quality: JPEG quality if applicable.
        """
        params = []
        if ext.lower() in ('.jpg', '.jpeg'):
            params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        encode_param = params
        success, buf = cv2.imencode(ext, self.processed, encode_param)
        if not success:
            raise ValueError("Failed to encode image")
        return buf.tobytes()

    def reset(self) -> "ImageProcessor":
        """
        Reset processed image to the original.
        """
        self.processed = self._load_image(self.original_bytes).copy()
        return self

    def pipeline(self, steps: list) -> "ImageProcessor":
        """
        Apply a custom pipeline of methods by name with args.
        steps: list of tuples: (method_name, args_dict)
        Example:
            steps = [
                ("to_grayscale", {}),
                ("resize", {"width": 800}),
                ("threshold_otsu", {}),
            ]
        """
        for name, kwargs in steps:
            fn = getattr(self, name, None)
            if not fn:
                raise AttributeError(f"No such method: {name}")
            fn(**kwargs)
        return self
