import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import React from 'react'
import proj4 from 'proj4'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// ✅ Define Seattle projection (WA North State Plane - feet)
proj4.defs(
  "EPSG:2926",
  "+proj=lcc +lat_1=48.73333333333333 +lat_2=47.5 +lat_0=47 +lon_0=-120.8333333333333 +x_0=500000 +y_0=0 +datum=NAD83 +units=ft +no_defs"
)

// 🔁 Convert coordinates recursively
function convertCoords(coords: any): any {
  if (typeof coords[0] === 'number') {
    return proj4("EPSG:2926", "EPSG:4326", coords)
  }
  return coords.map(convertCoords)
}

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  const [input, setInput] = useState('')
  const [foundFeatures, setFoundFeatures] = useState<
    { name: string; segments: any[]; count: number }[]
  >([])
  const [streetsData, setStreetsData] = useState<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)

  // ✅ Load + CONVERT GeoJSON ONCE
  useEffect(() => {
    fetch('/cleaned-seattle-streets.geojson')
      .then(res => res.json())
      .then(data => {
        const converted = data.features.map((f: any) => ({
          type: 'Feature',
          properties: f.properties,
          geometry: {
            type: f.geometry.type,
            coordinates: convertCoords(f.geometry.coordinates),
          },
        }))
        setStreetsData(converted)
        console.log('✅ Streets loaded & converted:', converted.length)
      })
  }, [])

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

      m.addSource('streets-highlight', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      m.addLayer(
        {
          id: 'streets-highlight-layer',
          type: 'line',
          source: 'streets-highlight',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ff4d4d',
            'line-width': 6,
            'line-opacity': 1,
          },
        },
        'streets-base'
      )

      setMapLoaded(true)
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update highlight layer
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return
    if (!m.isStyleLoaded()) return

    const source = m.getSource('streets-highlight') as mapboxgl.GeoJSONSource
    if (!source) return

    // Flatten all segments from foundFeatures for highlighting
    const allSegments = foundFeatures.flatMap(f => f.segments)

    source.setData({
      type: 'FeatureCollection',
      features: allSegments,
    })
  }, [foundFeatures, mapLoaded])

  // Handle input
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return

    const name = input.trim().toUpperCase()
    if (!name) return
    const normalizedInput = name.replace(/\s+/g, '')

    // Match ALL segments
    const matches = streetsData.filter(
      f =>
        f.properties &&
        typeof f.properties.STNAME_ORD === 'string' &&
        f.properties.STNAME_ORD.toUpperCase().replace(/\s+/g, '').includes(normalizedInput)
    )

    if (matches.length === 0) {
      console.log('❌ No match for:', name)
      setInput('')
      return
    }

    console.log('✅ Highlighting:', matches.length, 'segments')

    // Group by street name
    const streetMap = new Map<string, any[]>()
    matches.forEach(f => {
      const streetName = f.properties.STNAME_ORD
      if (!streetMap.has(streetName)) streetMap.set(streetName, [])
      streetMap.get(streetName)!.push(f)
    })

    const newFound = Array.from(streetMap.entries()).map(([name, segments]) => ({
      name,
      segments,
      count: segments.length,
    }))

    // Merge with previous, keeping uniqueness
    setFoundFeatures(prev => {
      const combined = [...prev, ...newFound]
      const unique = new Map<string, typeof combined[0]>()
      combined.forEach(f => unique.set(f.name, f))
      return Array.from(unique.values())
    })

    setInput('')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div ref={mapContainer} style={{ flex: 1 }} />

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
        <div style={{ fontSize: 11, color: '#7a7d8a', textTransform: 'uppercase' }}>
          Type a street name
        </div>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Broadway"
          style={{
            padding: '10px 12px',
            background: '#0f1117',
            border: '1px solid #2a2d3a',
            borderRadius: 6,
            color: '#e8eaf0',
          }}
        />

        <div style={{ fontSize: 12, color: '#7a7d8a' }}>
          {foundFeatures.length} street{foundFeatures.length !== 1 ? 's' : ''} found
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
              key={f.name}
              style={{
                fontSize: 12,
                padding: '5px 8px',
                background: '#1e2230',
                borderRadius: 4,
                borderLeft: '2px solid #ff0000',
              }}
            >
              {f.name} {f.count > 1 ? `(${f.count} segments)` : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}