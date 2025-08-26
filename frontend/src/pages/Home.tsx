// src/pages/Home.tsx
import React from 'react'
import { StatsTable } from '../components/StatsTable'
import { DataChart } from '../components/DataChart'

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top navbar */}
      <header className="bg-green-600 text-white py-4 shadow fixed w-full z-10">
        <div className="container mx-auto flex items-center justify-between px-4">
          <h1 className="text-2xl font-bold">BETAGRO CO., LTD</h1>
        </div>
      </header>

      {/* Offset for fixed header */}
      <div className="pt-16" />

      {/* Make the rest of the page scrollable */}
      <div className="flex-1 overflow-auto">
        {/* Page title */}
        <section className="py-6 text-center">
          <h2 className="text-xl md:text-2xl font-semibold text-purple-700">
            Temperature Real Time Data
          </h2>
        </section>

        {/* Chart area */}
        <section className="w-full px-4 pb-8">
          <div className="bg-green-700 rounded-xl shadow w-full h-80 relative">
            <div className="absolute inset-0 p-4">
              <DataChart
                containerHeight={320}
                lineColor="#FBBF24"
              />
            </div>
          </div>
        </section>

        {/* Stats table full width */}
        <section className="w-full px-4 pb-8">
          <div className="w-full bg-white rounded-xl shadow p-4">
            <StatsTable />
          </div>
        </section>
      </div>
    </div>
  )
}

export default Home
