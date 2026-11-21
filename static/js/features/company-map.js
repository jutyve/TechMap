(() => {
  const { t, number, lang } = window.techmapLanguage;
  const el = (id) => document.getElementById(id);
  // Approximate city centers, not company coordinates. Same projection as the SVG.
  const centers = {
    casablanca: [33.59,-7.62], rabat: [34.02,-6.84], tanger: [35.76,-5.80],
    marrakech: [31.63,-8.00], agadir: [30.43,-9.60], fes: [34.04,-5.00],
    jadida: [33.25,-8.50], mohammedia: [33.69,-7.39], tetouan: [35.57,-5.37],
    temara: [33.93,-6.91], oujda: [34.68,-1.91], sale: [34.05,-6.80],
    kenitra: [34.26,-6.58], nador: [35.17,-2.93], berrechid: [33.27,-7.58],
    'beni mellal': [32.34,-6.36], deroua: [33.38,-7.54], meknes: [33.89,-5.55],
    settat: [33.00,-7.62], taroudant: [30.47,-8.88], tinghir: [31.51,-5.53],
    'ait amira': [30.22,-9.50], azilal: [31.96,-6.57], larache: [35.19,-6.15],
    selouane: [35.08,-2.94], 'oued laou': [35.45,-5.10], 'tan-tan': [28.44,-11.10],
    'oulad teima': [30.40,-9.21], safi: [32.30,-9.24], 'ben guerir': [32.23,-7.95],
    'ksar el-kebir': [35.00,-5.90], taza: [34.22,-4.01], inezgane: [30.36,-9.54],
    bouskoura: [33.45,-7.65], khenifra: [32.94,-5.67],
  };
  const normalize = (text) => text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const groups = new Map();
  const cityPicker = el('atlasCity');
  const search = el('atlasSearch');
  const status = el('atlasStatus');
  const pins = el('atlasPins');
  const plane = el('atlasPlane');
  const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  let activeCity, selectedCompany, loading = false, loaded = false, zoom = 1;

  const button = (className) => {
    const node = document.createElement('button');
    node.type = 'button'; node.className = className;
    return node;
  };

  function point(center) {
    const [lat, lon] = center;
    return { x: (lon + 18.4) * 36 / 660 * 100, y: (36.8 - lat) * 40 / 640 * 100 };
  }

  function paintZoom() {
    const focus = activeCity?.center ? point(activeCity.center) : { x: 58, y: 35 };
    plane.style.transformOrigin = `${focus.x}% ${focus.y}%`;
    plane.style.setProperty('--atlas-zoom', zoom);
    plane.style.setProperty('--marker-scale', 1 / zoom);
    el('atlasZoomOut').disabled = zoom <= 1;
    el('atlasZoomIn').disabled = zoom >= 2.5;
  }

  function insight(company) {
    el('atlasInsight').hidden = !company;
    if (!company) return;
    el('atlasCompanyName').textContent = company.company_name;
    const categories = company.specialties.length ? company.specialties : [t('No specialties listed')];
    el('atlasSpecialties').replaceChildren(...categories.map(label => {
      const tag = document.createElement('span'); tag.className = 'tag'; tag.dir = 'auto'; tag.textContent = label;
      return tag;
    }));
    el('atlasDirections').href = companyMapsUrl(company);
  }

  function renderPins() {
    const query = normalize(search.value);
    const companies = activeCity.items.filter(c => normalize([c.company_name, ...c.specialties].join(' ')).includes(query));
    pins.replaceChildren();
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
      node.innerHTML = pinIcon;
      node.append(label);
      node.setAttribute('aria-pressed', String(company === selectedCompany));
      node.addEventListener('pointerenter', () => insight(company));
      node.addEventListener('pointerleave', () => insight(selectedCompany));
      node.addEventListener('focus', () => insight(company));
      node.addEventListener('blur', () => insight(selectedCompany));
      node.addEventListener('click', () => {
        pins.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        node.setAttribute('aria-pressed', 'true');
        selectedCompany = company;
        insight(company);
      });
      fragment.append(node);
    }
    pins.append(fragment);
    pins.scrollTop = 0;
  }

  function selectCity(city) {
    if (!city) return;
    activeCity?.marker?.setAttribute('aria-pressed', 'false');
    activeCity = city;
    city.marker?.setAttribute('aria-pressed', 'true');
    cityPicker.value = city.key;
    status.textContent = `${city.name} · ${t('Companies')}: ${number(city.items.length)}`;
    search.value = '';
    selectedCompany = null;
    el('atlasCityDetails').classList.remove('hidden');
    renderPins();
    paintZoom();
  }

  function addCity(city) {
    const option = document.createElement('option');
    option.value = city.key; option.textContent = `${city.name} (${number(city.items.length)})`;
    cityPicker.append(option);
    if (!city.center) return;
    const marker = button('atlas-marker');
    const { x, y } = point(city.center);
    marker.style.left = `${x}%`; marker.style.top = `${y}%`;
    marker.setAttribute('aria-label', `${city.name} · ${t('Companies')}: ${number(city.items.length)}`);
    marker.setAttribute('aria-pressed', 'false');
    marker.textContent = number(city.items.length);
    const tooltip = document.createElement('span'); tooltip.className = 'atlas-city-tip'; tooltip.textContent = city.name;
    tooltip.setAttribute('aria-hidden', 'true'); marker.append(tooltip);
    marker.addEventListener('click', () => selectCity(city));
    city.marker = marker;
    el('atlasMarkers').append(marker);
  }

  async function load() {
    if (loading || loaded) return;
    loading = true;
    status.textContent = t('Loading company locations…');
    el('atlasRetry').classList.add('hidden');
    try {
      const response = await fetch('/api/companies/map');
      if (!response.ok) throw new Error('Map request failed');
      const { items } = await response.json();
      for (const company of items) {
        const key = normalize(company.city) || '_';
        if (!groups.has(key)) groups.set(key, { key, name: company.city || t('City not listed'), center: Object.hasOwn(centers, key) ? centers[key] : null, items: [] });
        groups.get(key).items.push(company);
      }
      const cities = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, lang));
      cities.forEach(addCity);
      cityPicker.disabled = !cities.length;
      const first = [...cities].sort((a, b) => b.items.length - a.items.length)[0];
      if (first) selectCity(first);
      else status.textContent = t('No company locations to show.');
      loaded = true;
    } catch {
      status.textContent = t('Could not load company locations.');
      el('atlasRetry').classList.remove('hidden');
    } finally { loading = false; }
  }

  document.querySelectorAll('[data-tab="company-map"]').forEach(tab => tab.addEventListener('click', load));
  cityPicker.addEventListener('change', () => selectCity(groups.get(cityPicker.value)));
  search.addEventListener('input', renderPins);
  el('atlasRetry').onclick = load;
  el('atlasZoomIn').onclick = () => { zoom = Math.min(2.5, zoom + .5); paintZoom(); };
  el('atlasZoomOut').onclick = () => { zoom = Math.max(1, zoom - .5); paintZoom(); };
  el('atlasReset').onclick = () => { zoom = 1; paintZoom(); };
  paintZoom();
})();
