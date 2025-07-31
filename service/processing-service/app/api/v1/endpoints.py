## Updated: app/api/v1/endpoints.py
import os
import uuid
import shutil
import cv2
import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.predict_result_model import (PredictionRun,RawPredict,RowCounts,InterfaceResults,WellPrediction,ImageFile)
from app.services.grid_builder_service import GridBuilder
from app.services.predictor_service import Predictor
from app.services.result_processor_service import ResultProcessor
from app.config import Config

# Initialize logger for this module
logger = logging.getLogger(__name__)
# Optionally configure logging level if needed
# logging.basicConfig(level=logging.INFO)

# Security setup: verify JWT from auth-service using HS256
bearer_scheme = HTTPBearer()

def verify_token(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = creds.credentials
    try:
        payload = jwt.decode(
            token,
            Config.JWT_SECRET_KEY,
            algorithms=[Config.ALGORITHM],
            options={"verify_aud": False}
        )
        logger.debug("Token verified: %s", payload.get("sub"))
    except JWTError as err:
        logger.warning("JWT verification failed: %s", err)
        raise HTTPException(status_code=401, detail=f"Invalid token: {err}")
    return payload

# APIRouter with global dependency for security
router = APIRouter(dependencies=[Depends(verify_token)])

# define model path from config
model_path = getattr(Config, 'MODEL_PATH', None)
if not model_path:
    logger.error("MODEL_PATH not configured in Config")
    raise RuntimeError("MODEL_PATH not configured in Config")

# initialize services
grid_builder = GridBuilder()
predictor = Predictor(model_path)
processor = ResultProcessor()

@router.post("/predict")
async def predict_endpoint(
    sample_no: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    logger.info("Starting prediction for sample_no=%s", sample_no)

    # 1. Save uploaded file to disk
    upload_dir = getattr(Config, 'UPLOAD_DIR', '/tmp')
    os.makedirs(upload_dir, exist_ok=True)
    image_id = uuid.uuid4().hex
    filename = f"{image_id}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)
    logger.info("Uploaded file saved to %s", file_path)

    # 2. Create a new PredictionRun record (initial status 'running')
    run = PredictionRun.create(
        db,
        sample_no=sample_no,
        description=None,
        annotated_image_path=file_path,
        model_version=Config.MODEL_VERSION if hasattr(Config, 'MODEL_VERSION') else None,
        status='running',
        error_msg=None
    )
    logger.info("Created PredictionRun id=%s", run.id)

    # record original image in ImageFile
    ImageFile.create(db, run.id, sample_no, 'original', file_path)
    logger.debug("Original image logged in ImageFile for run_id=%s", run.id)

    try:
        # 3. Load image and draw grid
        img = cv2.imread(file_path)
        grid_img, wells = grid_builder.draw(img)
        logger.info("Grid drawn: %d wells detected", len(wells))
        # 4. Run prediction and annotate
        annotated_img, wells = predictor.predict(grid_img, wells)
        logger.info("Prediction completed, saving raw results")
        for well in wells:
            for pred in well.get('predictions', []):
                WellPrediction.create(
                    db,
                    run_id=run.id,
                    label=well['label'],
                    class_name=pred['class'],
                    confidence=int(pred['confidence'] * 100),
                    bbox=pred['bbox']
                )
        logger.debug("Well predictions saved for run_id=%s", run.id)

        # 5. Save annotated image to disk and update run
        annotated_path = os.path.join(upload_dir, f"{image_id}_annotated.jpg")
        cv2.imwrite(annotated_path, annotated_img)
        ImageFile.create(db, run.id, sample_no, 'annotated', annotated_path)
        logger.info("Annotated image saved to %s and logged", annotated_path)

        run.annotated_image_path = annotated_path
        db.commit()

        # 6. Process results: count by row and last positions
        counts = processor.count_by_row(wells)
        last_positions = processor.last_positions(counts)
        RowCounts.create(db, run.id, {'raw_count': counts,'last_positions': last_positions})
        distribution = processor.to_dataframe(last_positions)
        InterfaceResults.create(db, run.id, {'distribution': distribution})
        logger.info("Results processed: row_counts and interface_results saved")

        # 7. Prepare response
        response = {
            'run_id': run.id,
            'counts': counts,
            'last_positions': last_positions,
            'distribution': distribution,
            'annotated_image': annotated_path
        }
        logger.info("Prediction endpoint completed successfully for run_id=%s", run.id)
        return JSONResponse(status_code=200, content=response)

    except Exception as e:
        logger.exception("Error during prediction for run_id=%s: %s", run.id, e)
        run.status = 'error'
        run.error_msg = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))