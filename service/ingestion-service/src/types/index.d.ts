// services/ingestion-service/src/types/index.d.ts

/** Payload ที่รับมาจาก ESP32-CAM via MQTT */
export interface MqttImagePayload {
  device_uid: string;                 // รหัสอุปกรณ์ เช่น incu-01
  recorded_at: string;               // ISO timestamp ของเวลาที่ถ่ายภาพ
  image_base64?: string;             // ถ้า payload มาเป็น base64 string
  image_format?: 'jpeg' | 'jpg' | 'png'; // ฟอร์แมตของภาพ (optional)
  sequence?: number;                 // ลำดับถ้ามี (เช่น ภาพต่อเนื่อง)
  extra_metadata?: Record<string, any>; // ข้อมูลเสริมจาก edge (เช่น sensor status)
}

/** รูปร่างของเหตุการณ์ที่ส่งไปเมื่ออัปโหลด raw image เสร็จ (raw.created) */
export interface RawCreatedEvent {
  object_name: string;
  bucket: string;
  device_uid: string;
  recorded_at: string; // ISO timestamp
  checksum?: string;   // ถ้ามีการคำนวณ hash
  image_type: 'raw';
  metadata?: Record<string, any>;
}

/** เหตุการณ์หลัง processing เสร็จ (processed.created) */
export interface ProcessedCreatedEvent {
  object_name: string;
  bucket: string;
  device_uid: string;
  recorded_at: string; // ISO timestamp
  checksum?: string;
  image_type: 'processed';
  ocr_text?: string;               // ถ้า OCR ถูกทำแล้ว
  parsed_temperature?: string;     // ถ้าแยกค่าอุณหภูมิได้
  metadata?: Record<string, any>;  // เช่น confidence, crop info
}

/** ห่อหุ้มข้อความ (optional) สำหรับ routing/generic envelope */
export interface RabbitMessageEnvelope<T> {
  event: string;      // เช่น 'raw.created' หรือ 'processed.created'
  data: T;
  trace_id?: string;  // ถ้าทำ tracing
  timestamp?: string; // เวลาส่ง
}

/** ผลลัพธ์จากการอัปโหลดไป MinIO */
export interface MinioUploadResult {
  bucket: string;
  objectName: string;
  etag?: string;
  versionId?: string;
}

/** สถานะ health / observability ของ ingestion service */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  uptime_seconds: number;
  last_ingested_at?: string;  // ISO timestamp
  total_ingested?: number;
  error_count?: number;
}

/** ประเภทภาพ */
export type ImageType = 'raw' | 'processed';

/** รูปร่างของ configuration ที่ ingestion-service ควรโหลดจาก env */
export interface IngestionConfig {
  mqttBrokerUrl: string;
  mqttUser?: string;
  mqttPassword?: string;

  minioEndpoint: string;
  minioAccessKey: string;
  minioSecretKey: string;
  minioRawBucket: string;

  rabbitmqHost: string;
  rabbitmqPort: number;
  rabbitmqVhost: string;
  rabbitmqUser: string;
  rabbitmqPassword: string;
  rabbitmqExchange: string;

  // Optional extras
  mqttTopic?: string; // ตัวอย่าง: 'camera/image'
  rawRoutingKey?: string; // e.g. 'raw.created'
}
