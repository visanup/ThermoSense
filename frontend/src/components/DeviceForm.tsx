// src/components/DeviceForm.tsx
import React, { useState, ChangeEvent, FormEvent } from 'react';
import { NewDevice } from '../types/device';

interface Props { onSubmit: (device: NewDevice) => void; }

const DeviceForm: React.FC<Props> = ({ onSubmit }) => {
  const [form, setForm] = useState<NewDevice>({ device_uid: '', name: '', device_type: '', location: '', installed_at: new Date().toISOString() });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(form);
    setForm({ device_uid: '', name: '', device_type: '', location: '', installed_at: new Date().toISOString() });
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <input
        name="device_uid"
        placeholder="UID"
        value={form.device_uid}
        onChange={handleChange}
        className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        name="name"
        placeholder="ชื่ออุปกรณ์"
        value={form.name}
        onChange={handleChange}
        className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        name="device_type"
        placeholder="ประเภท (e.g. temperature)"
        value={form.device_type}
        onChange={handleChange}
        className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        name="location"
        placeholder="ตำแหน่ง"
        value={form.location}
        onChange={handleChange}
        className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        type="datetime-local"
        name="installed_at"
        value={form.installed_at.slice(0,16)}
        onChange={e => setForm({ ...form, installed_at: new Date(e.target.value).toISOString() })}
        className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <button type="submit" className="col-span-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded transition">เพิ่มอุปกรณ์</button>
    </form>
  );
};

export default DeviceForm;