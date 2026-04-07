import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import React from 'react'
import proj4 from 'proj4'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// --- Projection setup ---
// WA State Plane North (EPSG:2926) -> WGS84 (lat/lng)
proj4.defs(
  'EPSG:2926',
  '+proj=lcc +lat_1=47.5 +lat_2=48.73333333333333 +lat_0=47 +lon_0=-120.8333333333333 +x_0=1640416.666666667 +y_0=0 +datum=NAD83 +units=ft +no_defs'
)

const fromProjection = 'EPSG:2926'
const toProjection = 'EPSG:4326'

// --- Recursive coordinate converter ---
function convertCoords(coords: any): any {
  if (typeof coords[0] === 'number') {
    return proj4(fromProjection, toProjection, coords)
  }
  return coords.map(convertCoords)
}

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  const [input, setInput] = useState('')
  const [foundFeatures, setFoundFeatures] = useState<any[]>([])
  const [streetsData, setStreetsData] = useState<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)

  // --- Load + convert GeoJSON ---
  useEffect(() => {
    fetch('/cleaned-seattle-streets.geojson')
      .then(res => res.json())
      .then(data => {
        const converted = data.features.map((feature: any) => ({
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: convertCoords(feature.geometry.coordinates),
          },
        }))

        setStreetsData(converted)
        console.log('✅ Loaded + converted streets:', converted.length)
      })
  }, [])

  // --- Initialize Map ---
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

      // --- Base streets source (EMPTY INIT) ---
      m.addSource('streets', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
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

      // --- Highlight source ---
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

      setMapLoaded(true)
      console.log('🗺️ Map loaded')
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // --- Push converted data into map ---
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded || streetsData.length === 0) return

    const source = m.getSource('streets') as mapboxgl.GeoJSONSource
    if (!source) return

    source.setData({
      type: 'FeatureCollection',
      features: streetsData,
    })

    console.log('📦 Streets data added to map')
  }, [streetsData, mapLoaded])

  // --- Update highlight layer ---
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    const source = m.getSource('streets-highlight') as mapboxgl.GeoJSONSource
    if (!source) return

    source.setData({
      type: 'FeatureCollection',
      features: foundFeatures,
    })

    console.log('🔥 Updating highlights:', foundFeatures.length)
  }, [foundFeatures, mapLoaded])

  // --- Handle input ---
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return

    const name = input.trim().toUpperCase()
    if (!name) return

    if (
      foundFeatures.some(
        f => f.properties.STNAME_ORD.toUpperCase() === name
      )
    ) {
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

    if (!match) {
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
          {foundFeatures.length} found
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
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