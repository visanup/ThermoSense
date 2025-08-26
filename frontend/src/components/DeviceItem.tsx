// src/components/DeviceItem.tsx
import React from 'react';
import { Device } from '../types/device';

interface Props { device: Device; }
const DeviceItem: React.FC<Props> = ({ device }) => (
  <div className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition">
    <h3 className="text-lg font-medium mb-2 truncate">{device.name}</h3>
    <ul className="text-sm text-gray-600 space-y-1">
      <li><span className="font-semibold">UID:</span> {device.device_uid}</li>
      <li><span className="font-semibold">Type:</span> {device.device_type}</li>
      <li><span className="font-semibold">Location:</span> {device.location}</li>
      <li><span className="font-semibold">Installed:</span> {new Date(device.installed_at).toLocaleString()}</li>
      <li><span className="font-semibold">Created:</span> {new Date(device.created_at).toLocaleString()}</li>
      <li><span className="font-semibold">Updated:</span> {new Date(device.updated_at).toLocaleString()}</li>
    </ul>
  </div>
);

export default DeviceItem;
