## app/models/predict_result_model.py
from sqlalchemy import (Column, Integer, String, DateTime, Text, ForeignKey)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()
SCHEMA = "microplates"

class PredictionRun(Base):
    __tablename__ = 'prediction_run'
    __table_args__ = {'schema': SCHEMA}

    id = Column(Integer, primary_key=True)
    sample_no = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    predict_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    annotated_image_path = Column(String, nullable=False)
    model_version = Column(String, nullable=True)
    status = Column(String, nullable=False, default='pending')
    error_msg = Column(Text, nullable=True)

    raw_predicts = relationship('RawPredict', back_populates='run', cascade='all, delete-orphan')
    row_counts = relationship('RowCounts', back_populates='run', cascade='all, delete-orphan')
    interface_results = relationship('InterfaceResults', back_populates='run', cascade='all, delete-orphan')
    well_predictions = relationship('WellPrediction', back_populates='run', cascade='all, delete-orphan')
    image_files = relationship('ImageFile', back_populates='run', cascade='all, delete-orphan')

    @staticmethod
    def create(db, sample_no, description, annotated_image_path,
               model_version=None, status='pending', error_msg=None):
        run = PredictionRun(
            sample_no=sample_no,
            description=description,
            annotated_image_path=annotated_image_path,
            model_version=model_version,
            status=status,
            error_msg=error_msg
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

class RawPredict(Base):
    __tablename__ = 'raw_predict'
    __table_args__ = {'schema': SCHEMA}

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey(f"{SCHEMA}.prediction_run.id", ondelete='CASCADE'), nullable=False)
    raw_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship('PredictionRun', back_populates='raw_predicts')

    @staticmethod
    def create(db, run_id, raw_data):
        rp = RawPredict(run_id=run_id, raw_data=raw_data)
        db.add(rp)
        db.commit()
        db.refresh(rp)
        return rp

class RowCounts(Base):
    __tablename__ = 'row_counts'
    __table_args__ = {'schema': SCHEMA}

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey(f"{SCHEMA}.prediction_run.id", ondelete='CASCADE'), nullable=False)
    counts = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship('PredictionRun', back_populates='row_counts')

    @staticmethod
    def create(db, run_id, counts):
        rc = RowCounts(run_id=run_id, counts=counts)
        db.add(rc)
        db.commit()
        db.refresh(rc)
        return rc

class InterfaceResults(Base):
    __tablename__ = 'interface_results'
    __table_args__ = {'schema': SCHEMA}

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey(f"{SCHEMA}.prediction_run.id", ondelete='CASCADE'), nullable=False)
    results = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship('PredictionRun', back_populates='interface_results')

    @staticmethod
    def create(db, run_id, results):
        ir = InterfaceResults(run_id=run_id, results=results)
        db.add(ir)
        db.commit()
        db.refresh(ir)
        return ir

class WellPrediction(Base):
    __tablename__ = 'well_prediction'
    __table_args__ = {'schema': SCHEMA}

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey(f"{SCHEMA}.prediction_run.id", ondelete='CASCADE'), nullable=False)
    label = Column(String, nullable=False)
    class_name = Column('class', String, nullable=False)
    confidence = Column(Integer, nullable=False)
    bbox = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship('PredictionRun', back_populates='well_predictions')

    @staticmethod
    def create(db, run_id, label, class_name, confidence, bbox):
        wp = WellPrediction(
            run_id=run_id,
            label=label,
            class_name=class_name,
            confidence=confidence,
            bbox=bbox
        )
        db.add(wp)
        db.commit()
        db.refresh(wp)
        return wp

class ImageFile(Base):
    __tablename__ = 'image_file'
    __table_args__ = {'schema': SCHEMA}

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey(f"{SCHEMA}.prediction_run.id", ondelete='CASCADE'), nullable=False)
    sample_no = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship('PredictionRun', back_populates='image_files')

    @staticmethod
    def create(db, run_id, sample_no, file_type, path):
        img = ImageFile(
            run_id=run_id,
            sample_no=sample_no,
            file_type=file_type,
            path=path
        )
        db.add(img)
        db.commit()
        db.refresh(img)
        return img