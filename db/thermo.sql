-- =================================================================================
-- File: thermo.sql
-- Purpose: Schema definition for temperature-monitoring system (with MinIO image metadata)
-- =================================================================================

-- 1) สร้าง schema thermo ถ้ายังไม่มี
CREATE SCHEMA IF NOT EXISTS thermo;

-- 2) ฟังก์ชันสำหรับอัปเดตคอลัมน์ updated_at อัตโนมัติ
CREATE OR REPLACE FUNCTION thermo.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) ตารางเก็บข้อมูลอุปกรณ์
CREATE TABLE IF NOT EXISTS thermo.devices (
    id             SERIAL PRIMARY KEY,
    device_uid     TEXT    UNIQUE NOT NULL,      -- รหัสอุปกรณ์ (เช่น 'incu-01', 'sensor-xyz')
    name           TEXT,                         -- ชื่อหรือคำอธิบายสั้น ๆ
    device_type    TEXT,                         -- ประเภทอุปกรณ์ (e.g. 'incubator', 'ambient-sensor')
    location       TEXT,                         -- ตำแหน่งติดตั้ง (e.g. 'Lab A', 'Room 101')
    installed_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE TRIGGER trig_update_devices_updated_at
BEFORE UPDATE ON thermo.devices
FOR EACH ROW
EXECUTE FUNCTION thermo.update_updated_at_column();

-- 4) ตารางเก็บเมตาดาต้าของภาพที่เก็บใน MinIO
CREATE TABLE IF NOT EXISTS thermo.image_objects (
    id              BIGSERIAL PRIMARY KEY,
    device_id       INTEGER NOT NULL
                      REFERENCES thermo.devices(id)
                      ON DELETE CASCADE,
    recorded_at     TIMESTAMPTZ NOT NULL,        -- เวลาที่ภาพถูกถ่าย
    minio_bucket    TEXT NOT NULL,               -- bucket เช่น thermo-raw / thermo-processed
    object_name     TEXT NOT NULL,               -- object key/path ใน MinIO
    object_version  TEXT,                        -- ถ้าเปิด versioning
    checksum        TEXT,                        -- hash ตรวจสอบความสมบูรณ์ (optional)
    image_type      TEXT NOT NULL CHECK (image_type IN ('raw','processed')), -- แยกประเภทภาพ
    metadata        JSONB DEFAULT '{}' ,         -- ข้อมูลเสริม เช่น resize, OCR hints, confidence ฯลฯ
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_minio_object UNIQUE (minio_bucket, object_name)
);
CREATE INDEX IF NOT EXISTS idx_image_objects_device_time ON thermo.image_objects(device_id, recorded_at DESC);
CREATE TRIGGER trig_update_image_objects_updated_at
BEFORE UPDATE ON thermo.image_objects
FOR EACH ROW
EXECUTE FUNCTION thermo.update_updated_at_column();

-- 5) ตารางเก็บค่าการอ่านอุณหภูมิ (ผลสุดท้าย)
CREATE TABLE IF NOT EXISTS thermo.temperature_readings (
    id                    BIGSERIAL PRIMARY KEY,
    device_id             INTEGER     NOT NULL
                           REFERENCES thermo.devices(id)
                           ON DELETE CASCADE,
    recorded_at           TIMESTAMPTZ NOT NULL,         -- เวลาที่อ่านค่า (น่าจะใกล้เคียงกับภาพ)
    temperature           NUMERIC(6,3) NOT NULL,        -- ค่าอุณหภูมิ (เช่น 37.500)
    raw_image_id          BIGINT     REFERENCES thermo.image_objects(id) ON DELETE SET NULL,
    processed_image_id    BIGINT     REFERENCES thermo.image_objects(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_device_time UNIQUE (device_id, recorded_at)
);
CREATE TRIGGER trig_update_readings_updated_at
BEFORE UPDATE ON thermo.temperature_readings
FOR EACH ROW
EXECUTE FUNCTION thermo.update_updated_at_column();

-- 6) ฟังก์ชันตรวจสอบความสอดคล้องของ image_type ใน temperature_readings
CREATE OR REPLACE FUNCTION thermo.validate_reading_image_types()
RETURNS TRIGGER AS $$
DECLARE
    raw_type TEXT;
    proc_type TEXT;
BEGIN
    IF NEW.raw_image_id IS NOT NULL THEN
        SELECT image_type INTO raw_type FROM thermo.image_objects WHERE id = NEW.raw_image_id;
        IF raw_type IS DISTINCT FROM 'raw' THEN
            RAISE EXCEPTION 'raw_image_id does not refer to an image_objects with image_type = raw';
        END IF;
    END IF;

    IF NEW.processed_image_id IS NOT NULL THEN
        SELECT image_type INTO proc_type FROM thermo.image_objects WHERE id = NEW.processed_image_id;
        IF proc_type IS DISTINCT FROM 'processed' THEN
            RAISE EXCEPTION 'processed_image_id does not refer to an image_objects with image_type = processed';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_validate_reading_images
BEFORE INSERT OR UPDATE ON thermo.temperature_readings
FOR EACH ROW
EXECUTE FUNCTION thermo.validate_reading_image_types();

-- 7) Index เพื่อเพิ่มความเร็วในการค้นหาตามอุปกรณ์และเวลาที่บันทึก
CREATE INDEX IF NOT EXISTS idx_readings_device_time
ON thermo.temperature_readings(device_id, recorded_at DESC);
