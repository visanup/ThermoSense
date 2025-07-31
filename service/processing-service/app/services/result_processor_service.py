## /app/services/result_processor_service.py
import os
import warnings
from ultralytics import YOLO
from collections import defaultdict
import pandas as pd

import logging

# ตั้งค่า logging
logger = logging.getLogger(__name__)

warnings.filterwarnings('ignore')
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

# กำหนดสีสำหรับแต่ละคลาส
COLORS = {0: (255, 0, 0), 1: (0, 255, 0), 2: (0, 0, 255)}

class ResultProcessor:
    """
    ประมวลผลผลลัพธ์จาก predictions
    """
    def __init__(self, target_class="Flowing"):
        self.target = target_class

    def count_by_row(self, wells):
        counts = defaultdict(lambda: [0] * 12)
        for well in wells:
            for pred in well.get('predictions', []):
                if pred['class'] == self.target:
                    row = well['label'][0]
                    col = int(well['label'][1:]) - 1
                    counts[row][col] += 1
        final = {r: c[:max(i for i, v in enumerate(c) if v > 0) + 1]
                 for r, c in counts.items() if any(c)}
        logger.info(f"Final row counts: {final}")
        return final

    def last_positions(self, row_counts):
        return {r: max(i for i, v in enumerate(vs) if v > 0) + 1
                for r, vs in row_counts.items()}

    def to_dataframe(self, last_positions):
        cols = list(range(1, 13))
        df = pd.DataFrame(0, index=list("ABCDEFGH"), columns=cols)
        for r, c in last_positions.items():
            df.at[r, c] = 1
        df.loc['Total'] = df.sum()
        df['total'] = df.sum(axis=1)
        df = df[['total'] + cols]
        total = df.loc['Total'].to_dict()
        logger.info(f"Result JSON: {total}")
        return total