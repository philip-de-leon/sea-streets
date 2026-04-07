import fs from 'fs'

const geojson = JSON.parse(fs.readFileSync('public/cleaned-seattle-streets.geojson', 'utf-8'))

const names = [...new Set(
    geojson.features
      .map(f => f.properties.STNAME_ORD)
      .filter(Boolean)
  )].sort()

const output = `export const STREETS = ${JSON.stringify(names, null, 2)}\n`
fs.writeFileSync('src/data/streetNames.js', output)

console.log(`Extracted ${names.length} street names`)