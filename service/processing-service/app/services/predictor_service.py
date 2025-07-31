## app/services/predictor_service.py
import os
import cv2
import tempfile
from ultralytics import YOLO
import logging

# ตั้งค่า logging
logger = logging.getLogger(__name__)

# กำหนดสีสำหรับแต่ละคลาส
COLORS = {0: (255, 0, 0), 1: (0, 255, 0), 2: (0, 0, 255)}

class Predictor:
    """
    รัน YOLO prediction และ annotate บนภาพ
    """
    def __init__(self, model_path):
        self.model = YOLO(model_path)
        self.model.to('cpu')  # บังคับใช้ CPU

    def predict(self, image, wells):
        # บันทึกเป็นไฟล์ชั่วคราว
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            cv2.imwrite(tmp.name, image)
            results = self.model.predict(source=tmp.name, conf=0.4, device='cpu')
        os.remove(tmp.name)

        for res in results:
            for box in res.boxes:
                cid     = int(box.cls[0])
                cls_name= res.names[cid]
                conf    = float(box.conf[0])
                bbox    = box.xyxy[0].cpu().numpy().astype(int).tolist()
                label   = self._find_well(bbox, wells)
                if label:
                    for well in wells:
                        if well['label'] == label:
                            well['predictions'].append({
                                'class':      cls_name,
                                'confidence': conf,
                                'bbox':       bbox
                            })
                            cv2.rectangle(image, tuple(bbox[:2]), tuple(bbox[2:]), COLORS[cid], 2)
                            cv2.putText(image, f"{cls_name} {conf:.2f}",
                                        (bbox[0], bbox[1]-10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLORS[cid], 2)
                            logger.debug(f"Detected {cls_name} in {label}: {conf:.2f}")
        return image, wells

    @staticmethod
    def _find_well(bbox, wells):
        """
        หาว่า bbox นี้อยู่ในกรอบของ well ไหน
        """
        x1, y1, x2, y2 = bbox
        for well in wells:
            tl, br = well['top_left'], well['bottom_right']
            if x1 >= tl[0] and y1 >= tl[1] and x2 <= br[0] and y2 <= br[1]:
                return well['label']
        return None
