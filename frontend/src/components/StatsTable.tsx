// src/components/StatsTable.tsx
import React, { useEffect, useState } from 'react'

interface DeviceInfo {
  id: number
  device_uid: string
  name: string
}

interface RawStat {
  id: number
  temperature: number | string
  recorded_at: string
  device: DeviceInfo
}

// อ่านจาก .env (ต้องตั้งชื่อว่า REACT_APP_API_URL)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5103'

export const StatsTable: React.FC = () => {
  const [allRows, setAllRows] = useState<RawStat[]>([])
  const [displayRows, setDisplayRows] = useState<RawStat[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [deviceFilter, setDeviceFilter] = useState<number | ''>('')

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = localStorage.getItem('accessToken') || ''
        const res = await fetch(
          `${API_URL}/api/temperature-readings?limit=1000`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        )
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const data: RawStat[] = await res.json()
        const parsed = data
          .map(item => ({
            ...item,
            temperature:
              typeof item.temperature === 'string'
                ? parseFloat(item.temperature)
                : item.temperature,
          }))
          .sort(
            (a, b) =>
              new Date(b.recorded_at).getTime() -
              new Date(a.recorded_at).getTime()
          )

        setAllRows(parsed)
        setDisplayRows(parsed)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  useEffect(() => {
    setDisplayRows(
      deviceFilter === ''
        ? allRows
        : allRows.filter(r => r.device.id === deviceFilter)
    )
  }, [deviceFilter, allRows])

  const exportCsv = () => {
    const headers = ['ID', 'Device ID', 'Temperature (°C)', 'Recorded At']
    const rows = displayRows.map(r => [
      r.id,
      r.device.id,
      typeof r.temperature === 'number'
        ? r.temperature.toFixed(2)
        : r.temperature,
      new Date(r.recorded_at).toLocaleString(),
    ])
    const csvContent = [headers, ...rows]
      .map(e => e.join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stats_table.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        Loading...
      </div>
    )
  if (error)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'red',
        }}
      >
        Error: {error}
      </div>
    )
  if (displayRows.length === 0)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#666',
        }}
      >
        No data available.
      </div>
    )

  const uniqueDevices = Array.from(
    new Set(allRows.map(r => r.device.id))
  ).sort((a, b) => a - b)

  return (
    <div style={{ width: '100%', padding: 16, overflow: 'auto' }}>
      {/* Filter Section */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <label htmlFor="deviceFilter" style={{ fontWeight: 500 }}>
          Device ID:
        </label>
        <select
          id="deviceFilter"
          value={deviceFilter}
          onChange={e =>
            setDeviceFilter(
              e.target.value === '' ? '' : parseInt(e.target.value, 10)
            )
          }
          style={{
            border: '1px solid black',
            padding: '4px 8px',
            borderRadius: 4,
            width: 100,
          }}
        >
          <option value="">All</option>
          {uniqueDevices.map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid black',
          }}
        >
          <thead>
            <tr>
              {[
                'ID',
                'Device ID',
                'Temperature (°C)',
                'Recorded At',
              ].map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    border: '1px solid black',
                    padding: '8px',
                    textAlign: 'center',
                    backgroundColor: '#f0f0f0',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map(row => (
              <tr key={row.id}>
                <td
                  style={{
                    border: '1px solid black',
                    padding: '8px',
                    textAlign: 'center',
                  }}
                >
                  {row.id}
                </td>
                <td
                  style={{
                    border: '1px solid black',
                    padding: '8px',
                    textAlign: 'center',
                  }}
                >
                  {row.device.id}
                </td>
                <td
                  style={{
                    border: '1px solid black',
                    padding: '8px',
                    textAlign: 'center',
                  }}
                >
                  {typeof row.temperature === 'number'
                    ? row.temperature.toFixed(2)
                    : ''}
                </td>
                <td
                  style={{
                    border: '1px solid black',
                    padding: '8px',
                    textAlign: 'center',
                  }}
                >
                  {new Date(row.recorded_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export Button Under Table */}
      <div style={{ marginTop: 16, textAlign: 'left' }}>
        <button
          onClick={exportCsv}
          style={{
            padding: '6px 16px',
            border: '1px solid black',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Export CSV
        </button>
      </div>
    </div>
  )
}
