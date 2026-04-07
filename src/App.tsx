import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import React from 'react'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [input, setInput] = useState('')
  const [found, setFound] = useState<string[]>([])

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-122.3321, 47.6062],
      zoom: 12,
      minZoom: 11,
      maxZoom: 16,
      maxBounds: [[-122.5, 47.48], [-122.1, 47.73]],
    })

    map.current.dragRotate.disable()
    map.current.touchZoomRotate.disableRotation()

    map.current.on('load', () => {
      const m = map.current!

      // Load streets from GeoJSON in public/
      m.addSource('streets', {
        type: 'geojson',
        data: '/cleaned-seattle-streets.geojson',
      })

      // All streets — muted base
      m.addLayer({
        id: 'streets-base',
        type: 'line',
        source: 'streets',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2a3040',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 2, 16, 3],
          'line-opacity': 0.8,
        },
      })

      // Found streets — bright highlight, starts empty
      m.addLayer({
        id: 'streets-found',
        type: 'line',
        source: 'streets',
        filter: ['in', ['get', 'STNAME_ORD'], ['literal', []]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#4fc3f7',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 4, 16, 5],
          'line-opacity': 1,
        },
      })
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update highlight filter whenever found list changes
  useEffect(() => {
    const m = map.current
    if (!m || !m.getLayer('streets-found')) return
    m.setFilter('streets-found', ['in', ['get', 'STNAME_ORD'], ['literal', found]])
  }, [found])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const name = input.trim()
    if (!name || found.includes(name)) return
    setFound(prev => [...prev, name])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Map */}
      <div ref={mapContainer} style={{ flex: 1, height: '100%' }} />

      {/* Minimal sidebar */}
      <div style={{
        width: 280,
        background: '#1a1d27',
        borderLeft: '1px solid #2a2d3a',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'monospace',
        color: '#e8eaf0',
      }}>
        <div style={{ fontSize: 11, color: '#7a7d8a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Type a street name
        </div>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. PIKE ST"
          autoComplete="off"
          spellCheck={false}
          style={{
            padding: '10px 12px',
            background: '#0f1117',
            border: '1px solid #2a2d3a',
            borderRadius: 6,
            color: '#e8eaf0',
            fontFamily: 'monospace',
            fontSize: 14,
            outline: 'none',
          }}
        />

        <div style={{ fontSize: 12, color: '#7a7d8a' }}>
          {found.length} found
        </div>

        {/* Found list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {found.map(name => (
            <div key={name} style={{
              fontSize: 12,
              padding: '5px 8px',
              background: '#1e2230',
              borderRadius: 4,
              borderLeft: '2px solid #4fc3f7',
            }}>
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}