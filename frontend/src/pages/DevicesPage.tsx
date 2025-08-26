// src/pages/DevicesPage.tsx
import React, { useEffect, useState } from 'react'
import { Device, NewDevice } from '../types/device'
import DeviceForm from '../components/DeviceForm'
import DeviceList from '../components/DeviceList'

// อ่านจาก .env (ต้องตั้งชื่อว่า REACT_APP_API_URL)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5103'

const DevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  const fetchDevices = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('accessToken') || ''
      const res = await fetch(`${API_URL}/api/devices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        }
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data: Device[] = await res.json()
      setDevices(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const handleAdd = async (newDevice: NewDevice) => {
    try {
      const token = localStorage.getItem('accessToken') || ''
      const res = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(newDevice)
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      await fetchDevices()
    } catch (err: any) {
      alert('เพิ่มอุปกรณ์ไม่สำเร็จ: ' + err.message)
    }
  }

  return (
    <div className="container mx-auto pt-24 px-6">
      <h1 className="text-3xl font-bold mb-6">จัดการอุปกรณ์</h1>

      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">เพิ่มอุปกรณ์ใหม่</h2>
        <DeviceForm onSubmit={handleAdd} />
      </div>

      {loading && <p className="text-center py-10">กำลังโหลดข้อมูล...</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}
      {!loading && !error && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">อุปกรณ์ทั้งหมด</h2>
          <DeviceList devices={devices} />
        </div>
      )}
    </div>
  )
}

export default DevicesPage
