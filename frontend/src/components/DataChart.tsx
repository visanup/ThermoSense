// src/components/DataChart.tsx
import React, { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface DataChartProps {
  containerHeight?: number
  lineColor?: string
}

interface RawPoint {
  id: number
  recorded_at: string
  temperature: string | number
  device: { id: number; device_uid: string; name: string }
}

interface DataPoint {
  time: string
  temperature: number
}

// อ่านตัวแปรจาก .env (ต้องตั้งชื่อว่า REACT_APP_API_URL)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5103'

export const DataChart: React.FC<DataChartProps> = ({
  containerHeight = 200,
  lineColor = '#60A5FA',
}) => {
  const [rawData, setRawData] = useState<RawPoint[]>([])
  const [data, setData] = useState<DataPoint[]>([])
  const [deviceFilter, setDeviceFilter] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch raw readings
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = localStorage.getItem('accessToken') || ''
        const response = await fetch(
          `${API_URL}/api/temperature-readings?limit=1000`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        )
        if (!response.ok) throw new Error(`Status ${response.status}`)
        const json: RawPoint[] = await response.json()
        setRawData(json)
      } catch (e: any) {
        console.error('Error fetching data:', e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const id = setInterval(fetchData, 10000)
    return () => clearInterval(id)
  }, [])

  // Filter and format for chart
  useEffect(() => {
    const filtered =
      deviceFilter === ''
        ? rawData
        : rawData.filter(d => d.device.id === deviceFilter)
    const formatted: DataPoint[] = filtered.map(d => ({
      time: new Date(d.recorded_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      temperature:
        typeof d.temperature === 'string'
          ? parseFloat(d.temperature)
          : d.temperature,
    }))
    setData(formatted)
  }, [rawData, deviceFilter])

  if (loading)
    return (
      <div className="flex items-center justify-center">
        Loading chart…
      </div>
    )
  if (error)
    return <div className="text-red-500">Error: {error}</div>

  // Build device options
  const uniqueDevices = Array.from(
    new Set(rawData.map(d => d.device.id))
  ).sort((a, b) => a - b)

  return (
    <div className="p-4 bg-white rounded-xl shadow">
      <div className="mb-4 flex items-center space-x-2">
        <label htmlFor="chartDeviceFilter" className="font-medium">
          Device ID:
        </label>
        <select
          id="chartDeviceFilter"
          value={deviceFilter}
          onChange={e =>
            setDeviceFilter(
              e.target.value === '' ? '' : parseInt(e.target.value, 10)
            )
          }
          className="border border-gray-300 px-2 py-1 rounded"
        >
          <option value="">All</option>
          {uniqueDevices.map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={containerHeight}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff40" />
          <XAxis dataKey="time" stroke="#000" tick={{ fill: '#000' }} />
          <YAxis
            domain={['auto', 'auto']}
            unit="°C"
            stroke="#000"
            tick={{ fill: '#000' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff' }}
            itemStyle={{ color: lineColor }}
          />
          <Line
            type="monotone"
            dataKey="temperature"
            stroke={lineColor}
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
