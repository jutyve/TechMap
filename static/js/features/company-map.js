(() => {
  const { t, number, lang } = window.techmapLanguage;
  const el = (id) => document.getElementById(id);
  const { normalize, cityCenter } = window.techmapLocations;
  const groups = new Map();
  const cityPicker = el('atlasCity');
  const search = el('atlasSearch');
  const status = el('atlasStatus');
  const pins = el('atlasPins');
  const home = { center: [30.4, -8.8], zoom: 5 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const LAYER_KEY = 'techmap_map_layer';
  const ESRI_STREET_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
  const ESRI_IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const ESRI_LABEL_TILES = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
  const ESRI_STREET_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; OpenStreetMap contributors, and the GIS User Community';
  const ESRI_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';
  const ESRI_LABEL_ATTRIBUTION = 'Labels &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community';
  const LAYER_BUILDERS = {
    street: () => ({
      base: L.tileLayer(ESRI_STREET_TILES, { maxZoom: 19, attribution: ESRI_STREET_ATTRIBUTION }),
    }),
    satellite: () => ({
      base: L.tileLayer(ESRI_IMAGERY_TILES, { maxZoom: 19, attribution: ESRI_ATTRIBUTION }),
    }),
    hybrid: () => ({
      base: L.tileLayer(ESRI_IMAGERY_TILES, { maxZoom: 19, attribution: ESRI_ATTRIBUTION }),
      labels: L.tileLayer(ESRI_LABEL_TILES, {
        maxZoom: 19,
        pane: 'overlayPane',
        attribution: ESRI_LABEL_ATTRIBUTION,
      }),
    }),
  };
  let map, cityMarkers, officeMarkers, activeBaseLayer, activeLabelLayer, activeLayerName;
  let preferredLayer = readSavedLayer();
  const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  let activeCity, selectedCompany, loading = false, loaded = false;

  const button = (className) => {
    const node = document.createElement('button');
    node.type = 'button'; node.className = className;
    return node;
  };

  function readSavedLayer() {
    try {
      const saved = localStorage.getItem(LAYER_KEY);
      return LAYER_BUILDERS[saved] ? saved : 'street';
    } catch {
      return 'street';
    }
  }

  function setTileError(visible) {
    el('atlasTileStatus').classList.toggle('hidden', !visible);
  }

  function setMapView(center, zoom) {
    map.setView(center, zoom, { animate: !reducedMotion.matches });
  }

  function setMapLayer(kind) {
    const next = LAYER_BUILDERS[kind] ? kind : 'street';
    preferredLayer = next;
    try { localStorage.setItem(LAYER_KEY, next); } catch { /* Storage is optional. */ }
    document.querySelectorAll('[data-map-layer]').forEach(button => {
      const active = button.dataset.mapLayer === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!map || activeLayerName === next) return;
    activeLayerName = next;
    if (activeBaseLayer) map.removeLayer(activeBaseLayer);
    if (activeLabelLayer) map.removeLayer(activeLabelLayer);
    setTileError(false);
    const layers = LAYER_BUILDERS[next]();
    activeBaseLayer = layers.base;
    activeLabelLayer = layers.labels || null;
    activeBaseLayer.on('tileerror', () => setTileError(true));
    activeBaseLayer.on('tileload', () => setTileError(false));
    activeBaseLayer.addTo(map);
    activeLabelLayer?.addTo(map);
  }

  function initMap() {
    if (map) return;
    map = L.map('atlasStreetMap', { scrollWheelZoom: false, minZoom: 3, maxZoom: 19,
      zoomAnimation: !reducedMotion.matches, fadeAnimation: !reducedMotion.matches });
    cityMarkers = L.layerGroup().addTo(map);
    officeMarkers = L.layerGroup().addTo(map);
    map.setView(home.center, home.zoom);
    setMapLayer(preferredLayer);
  }

  function insight(company) {
    el('atlasInsight').hidden = !company;
    if (!company) return;
    el('atlasPrecision').textContent = t(company.coordinates ? 'Verified company coordinates' : 'Approximate city view — office location not verified');
    el('atlasCompanyName').textContent = company.company_name;
    const categories = company.specialties.length ? company.specialties : [t('No specialties listed')];
    el('atlasSpecialties').replaceChildren(...categories.map(label => {
      const tag = document.createElement('span'); tag.className = 'tag'; tag.dir = 'auto'; tag.textContent = label;
      return tag;
    }));
    el('atlasDirections').href = companyMapsUrl(company);
  }

  function focusOnCompany(company) {
    selectedCompany = company;
    if (company.coordinates) setMapView(company.coordinates, 17);
    insight(company);
  }

  function renderExactPins(companies) {
    officeMarkers.clearLayers();
    for (const company of companies) {
      if (!company.coordinates) continue;
      const pin = L.marker(company.coordinates, { title: company.company_name,
        icon: L.divIcon({ className: 'atlas-street-pin', html: pinIcon, iconSize: [27, 27], iconAnchor: [13, 26] }) });
      const tip = document.createElement('span'); tip.textContent = company.company_name;
      pin.bindTooltip(tip, { direction: 'top' });
      pin.on('mouseover', () => insight(company)).on('mouseout', () => insight(selectedCompany));
      pin.on('click', () => {
        focusOnCompany(company);
        for (const candidate of pins.querySelectorAll('button')) {
          candidate.setAttribute('aria-pressed', String(candidate.dataset.id === String(company.id)));
        }
      });
      pin.addTo(officeMarkers);
    }
  }

  function renderPins() {
    const query = normalize(search.value);
    const companies = activeCity.items.filter(c => normalize([c.company_name, ...c.specialties].join(' ')).includes(query));
    pins.replaceChildren();
    renderExactPins(companies);
    if (!companies.some(c => c.id === selectedCompany?.id)) selectedCompany = companies[0];
    insight(selectedCompany);
    if (!companies.length) {
      const empty = document.createElement('p'); empty.textContent = t('No matching companies in this city.'); pins.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const company of companies) {
      const node = button('atlas-company-pin');
      const label = document.createElement('span'); label.dir = 'auto'; label.textContent = company.company_name;
      if (company.coordinates) node.innerHTML = pinIcon;
      node.dataset.id = company.id;
      if (company.coordinates) node.classList.add('has-verified-pin');
      node.append(label);
      node.setAttribute('aria-pressed', String(company === selectedCompany));
      node.addEventListener('pointerenter', () => insight(company));
      node.addEventListener('pointerleave', () => insight(selectedCompany));
      node.addEventListener('focus', () => insight(company));
      node.addEventListener('blur', () => insight(selectedCompany));
      node.addEventListener('click', () => {
        pins.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        node.setAttribute('aria-pressed', 'true');
        focusOnCompany(company);
      });
      fragment.append(node);
    }
    pins.append(fragment);
    pins.scrollTop = 0;
  }

  function selectCity(city, zoomToCity = true) {
    if (!city) return;
    activeCity?.marker?.getElement()?.classList.remove('atlas-city-selected');
    activeCity = city;
    city.marker?.getElement()?.classList.add('atlas-city-selected');
    cityPicker.value = city.key;
    const exact = city.items.filter(company => company.coordinates).length;
    status.textContent = `${city.name} · ${t('Companies')}: ${number(city.items.length)} · ${t('Verified pins')}: ${number(exact)}`;
    search.value = '';
    selectedCompany = null;
    el('atlasCityDetails').classList.remove('hidden');
    renderPins();
    if (zoomToCity && city.center) setMapView(city.center, 12);
  }

  function addCity(city) {
    const option = document.createElement('option');
    option.value = city.key; option.textContent = `${city.name} (${number(city.items.length)})`;
    cityPicker.append(option);
    if (!city.center) return;
    const count = document.createElement('span');
    count.textContent = number(city.items.length);
    const marker = L.marker(city.center, { title: `${city.name} · ${t('Companies')}: ${number(city.items.length)}`,
      icon: L.divIcon({ className: 'atlas-street-city', html: count, iconSize: [29,29], iconAnchor: [14,14] }) });
    const tooltip = document.createElement('span'); tooltip.textContent = city.name;
    marker.bindTooltip(tooltip, { direction: 'top' });
    marker.on('click', () => selectCity(city));
    city.marker = marker.addTo(cityMarkers);
  }

  async function load() {
    requestAnimationFrame(() => { initMap(); map.invalidateSize({ pan: false }); });
    if (loading || loaded) return;
    loading = true;
    status.textContent = t('Loading company locations…');
    el('atlasRetry').classList.add('hidden');
    try {
      const response = await fetch('/api/companies/map');
      if (!response.ok) throw new Error('Map request failed');
      const { items } = await response.json();
      initMap();
      for (const company of items) {
        const key = normalize(company.city) || '_';
        if (!groups.has(key)) groups.set(key, { key, name: company.city || t('City not listed'), center: cityCenter(company.city), items: [] });
        groups.get(key).items.push(company);
      }
      const cities = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, lang));
      cities.forEach(addCity);
      cityPicker.disabled = !cities.length;
      const first = [...cities].sort((a, b) => b.items.length - a.items.length)[0];
      if (first) selectCity(first, false);
      else status.textContent = t('No company locations to show.');
      loaded = true;
    } catch {
      status.textContent = t('Could not load company locations.');
      el('atlasRetry').classList.remove('hidden');
    } finally { loading = false; }
  }

  document.querySelectorAll('[data-map-layer]').forEach(button => {
    button.addEventListener('click', () => setMapLayer(button.dataset.mapLayer));
  });
  document.querySelectorAll('[data-tab="company-map"]').forEach(tab => tab.addEventListener('click', load));
  cityPicker.addEventListener('change', () => selectCity(groups.get(cityPicker.value)));
  search.addEventListener('input', renderPins);
  el('atlasRetry').onclick = load;
  el('atlasReset').onclick = () => {
    setMapView(home.center, home.zoom);
    activeBaseLayer?.redraw();
    activeLabelLayer?.redraw();
  };
})();
