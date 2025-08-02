-- extension ถ้าใช้ UUID ที่อื่น
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- schema + reusable updater
CREATE SCHEMA IF NOT EXISTS thermo;

CREATE OR REPLACE FUNCTION thermo.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Devices
CREATE TABLE IF NOT EXISTS thermo.devices (
  id           SERIAL PRIMARY KEY,
  device_uid   TEXT UNIQUE NOT NULL,
  name         TEXT,
  device_type  TEXT,
  location     TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE TRIGGER trig_update_devices_updated_at
  BEFORE UPDATE ON thermo.devices
  FOR EACH ROW EXECUTE FUNCTION thermo.update_updated_at_column();

-- Status enum for image objects
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'object_status') THEN
    CREATE TYPE thermo.object_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END
$$;

-- Image objects (สั้นแต่มีกลไกสำคัญ)
CREATE TABLE IF NOT EXISTS thermo.image_objects (
  id             BIGSERIAL PRIMARY KEY,
  device_id      INTEGER NOT NULL REFERENCES thermo.devices(id) ON DELETE CASCADE,
  recorded_at    TIMESTAMPTZ NOT NULL,
  minio_bucket   TEXT NOT NULL,
  object_name    TEXT NOT NULL,
  object_version TEXT,
  checksum       TEXT,
  image_type     TEXT NOT NULL CHECK (image_type IN ('raw','processed')),
  status         thermo.object_status NOT NULL DEFAULT 'pending',
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_minio_object UNIQUE (minio_bucket, object_name)
);
-- indexes
CREATE INDEX IF NOT EXISTS idx_image_objects_device_time ON thermo.image_objects(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_objects_status ON thermo.image_objects(status);
CREATE TRIGGER trig_update_image_objects_updated_at
  BEFORE UPDATE ON thermo.image_objects
  FOR EACH ROW EXECUTE FUNCTION thermo.update_updated_at_column();

-- Temperature readings with validation
CREATE TABLE IF NOT EXISTS thermo.temperature_readings (
  id                 BIGSERIAL PRIMARY KEY,
  device_id          INTEGER NOT NULL REFERENCES thermo.devices(id) ON DELETE CASCADE,
  recorded_at        TIMESTAMPTZ NOT NULL,
  temperature        NUMERIC(6,3) NOT NULL CHECK (temperature >= -50 AND temperature <= 150),
  raw_image_id       BIGINT REFERENCES thermo.image_objects(id) ON DELETE SET NULL,
  processed_image_id BIGINT REFERENCES thermo.image_objects(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_device_time UNIQUE (device_id, recorded_at)
);
CREATE TRIGGER trig_update_readings_updated_at
  BEFORE UPDATE ON thermo.temperature_readings
  FOR EACH ROW EXECUTE FUNCTION thermo.update_updated_at_column();

-- Validation trigger for image types
CREATE OR REPLACE FUNCTION thermo.validate_reading_image_types()
RETURNS TRIGGER AS $$
DECLARE
  raw_type TEXT;
  proc_type TEXT;
BEGIN
  IF NEW.raw_image_id IS NOT NULL THEN
    SELECT image_type INTO raw_type FROM thermo.image_objects WHERE id = NEW.raw_image_id;
    IF raw_type IS NULL THEN
      RAISE EXCEPTION 'raw_image_id % does not exist', NEW.raw_image_id;
    ELSIF raw_type IS DISTINCT FROM 'raw' THEN
      RAISE EXCEPTION 'raw_image_id % has image_type %, expected raw', NEW.raw_image_id, raw_type;
    END IF;
  END IF;

  IF NEW.processed_image_id IS NOT NULL THEN
    SELECT image_type INTO proc_type FROM thermo.image_objects WHERE id = NEW.processed_image_id;
    IF proc_type IS NULL THEN
      RAISE EXCEPTION 'processed_image_id % does not exist', NEW.processed_image_id;
    ELSIF proc_type IS DISTINCT FROM 'processed' THEN
      RAISE EXCEPTION 'processed_image_id % has image_type %, expected processed', NEW.processed_image_id, proc_type;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_validate_reading_images
  BEFORE INSERT OR UPDATE ON thermo.temperature_readings
  FOR EACH ROW EXECUTE FUNCTION thermo.validate_reading_image_types();

-- Index for readings
CREATE INDEX IF NOT EXISTS idx_readings_device_time
  ON thermo.temperature_readings(device_id, recorded_at DESC);
