export interface WatcherEvent {
  bucket: string;
  objectKey: string;
  eventTime: string; // ISO
  status?: string; // optional, e.g., "pending"
  metadata?: Record<string, any>;
}
