// src/components/DeviceList.tsx
import React from 'react';
import { Device } from '../types/device';
import DeviceItem from './DeviceItem';

interface Props { devices: Device[]; }
const DeviceList: React.FC<Props> = ({ devices }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {devices.map(d => <DeviceItem key={d.id} device={d} />)}
    </div>
  );
};

export default DeviceList;