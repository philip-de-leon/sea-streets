import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import React from 'react'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  const [input, setInput] = useState('')
  const [foundFeatures, setFoundFeatures] = useState<any[]>([])
  const [streetsData, setStreetsData] = useState<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false) // ✅ NEW

  // Load GeoJSON streets into memory
  useEffect(() => {
    fetch('/cleaned-seattle-streets.geojson')
      .then(res => res.json())
      .then(data => {
        setStreetsData(data.features)
        console.log('Loaded streets:', data.features.length)
      })
  }, [])

  // Initialize Map
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

      // Base streets
      m.addSource('streets', {
        type: 'geojson',
        data: '/cleaned-seattle-streets.geojson',
      })

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

      // Highlight source
      m.addSource('streets-highlight', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      m.addLayer({
        id: 'streets-highlight-layer',
        type: 'line',
        source: 'streets-highlight',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ff0000',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 14, 6, 16, 8],
          'line-opacity': 1,
        },
      })

      setMapLoaded(true) // ✅ IMPORTANT
      console.log('Map fully loaded')
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update highlight layer
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return // ✅ wait for map

    if (!m.isStyleLoaded()) return // ✅ extra safety

    const source = m.getSource('streets-highlight') as mapboxgl.GeoJSONSource
    if (!source) {
      console.log('❌ highlight source missing')
      return
    }

    console.log('🔥 Updating highlights:', foundFeatures.length)

    source.setData({
      type: 'FeatureCollection',
      features: foundFeatures,
    })
  }, [foundFeatures, mapLoaded])

  // Handle input
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return

    const name = input.trim().toUpperCase()
    if (!name) return

    // Prevent duplicates
    if (
      foundFeatures.some(
        f => f.properties.STNAME_ORD.toUpperCase() === name
      )
    ) {
      console.log('Already found:', name)
      setInput('')
      return
    }

    const normalizedInput = name.replace(/\s+/g, '')

    const match = streetsData.find(
      f =>
        f.properties &&
        typeof f.properties.STNAME_ORD === 'string' &&
        f.properties.STNAME_ORD
          .toUpperCase()
          .replace(/\s+/g, '')
          .includes(normalizedInput)
    )

    if (!match || !match.properties) {
      console.log('❌ No match for:', name)
      setInput('')
      return
    }

    console.log('✅ Matched:', match.properties.STNAME_ORD)

    setFoundFeatures(prev => [...prev, match])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div ref={mapContainer} style={{ flex: 1, height: '100%' }} />

      <div
        style={{
          width: 280,
          background: '#1a1d27',
          borderLeft: '1px solid #2a2d3a',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontFamily: 'monospace',
          color: '#e8eaf0',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: '#7a7d8a',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
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
          {foundFeatures.length} found
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {foundFeatures.map(f => (
            <div
              key={f.properties.STNAME_ORD}
              style={{
                fontSize: 12,
                padding: '5px 8px',
                background: '#1e2230',
                borderRadius: 4,
                borderLeft: '2px solid #ff0000',
              }}
            >
              {f.properties.STNAME_ORD}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}