// src/types/device.ts
export interface Device {
  id: number;
  device_uid: string;
  name: string;
  device_type: string;
  location: string;
  installed_at: string;
  created_at: string;
  updated_at: string;
}

export interface NewDevice {
  device_uid: string;
  name: string;
  device_type: string;
  location: string;
  installed_at: string;
}
