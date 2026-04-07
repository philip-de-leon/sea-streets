export function highlightStreet(map, foundNames) {
    map.setFilter('streets-found', ['in', ['get', 'STNAME_ORD'], ['literal', foundNames]])
  }