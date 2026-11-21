(() => {
  const { t, number, lang } = window.techmapLanguage;
  const el = (id) => document.getElementById(id);
  const { normalize, cityCenter } = window.techmapLocations;
  const groups = new Map();
  const cityPicker = el('atlasCity');
  const search = el('atlasSearch');
  const status = el('atlasStatus');
  const pins = el('atlasPins');
  const plane = el('atlasPlane');
  const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  let activeCity, selectedCompany, loading = false, loaded = false, zoom = 1, mapFocus = null;

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
    const center = mapFocus || activeCity?.center;
    const focus = center ? point(center) : { x: 58, y: 35 };
    plane.style.transformOrigin = `${focus.x}% ${focus.y}%`;
    plane.style.setProperty('--atlas-zoom', zoom);
    plane.style.setProperty('--marker-scale', 1 / zoom);
    el('atlasZoomOut').disabled = zoom <= 1;
    el('atlasZoomIn').disabled = zoom >= 16;
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
    if (company.coordinates) {
      mapFocus = company.coordinates;
      zoom = Math.max(zoom, 5);
      paintZoom();
    }
    insight(company);
  }

  function renderExactPins(companies) {
    const markers = el('atlasExactMarkers');
    markers.replaceChildren();
    for (const company of companies) {
      if (!company.coordinates) continue;
      const mark = button('atlas-marker atlas-office-marker');
      const { x, y } = point(company.coordinates);
      mark.style.left = `${x}%`; mark.style.top = `${y}%`;
      mark.innerHTML = pinIcon;
      mark.setAttribute('aria-label', company.company_name);
      const tip = document.createElement('span');
      tip.className = 'atlas-city-tip'; tip.textContent = company.company_name;
      tip.setAttribute('aria-hidden', 'true'); mark.append(tip);
      mark.onpointerenter = mark.onfocus = () => insight(company);
      mark.onpointerleave = mark.onblur = () => insight(selectedCompany);
      mark.onclick = () => {
        focusOnCompany(company);
        for (const candidate of pins.querySelectorAll('button')) {
          candidate.setAttribute('aria-pressed', String(candidate.dataset.id === String(company.id)));
        }
      };
      markers.append(mark);
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
      node.innerHTML = pinIcon;
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

  function selectCity(city) {
    if (!city) return;
    activeCity?.marker?.setAttribute('aria-pressed', 'false');
    activeCity = city;
    mapFocus = null;
    zoom = 1;
    city.marker?.setAttribute('aria-pressed', 'true');
    cityPicker.value = city.key;
    const exact = city.items.filter(company => company.coordinates).length;
    status.textContent = `${city.name} · ${t('Companies')}: ${number(city.items.length)} · ${t('Verified pins')}: ${number(exact)}`;
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
        if (!groups.has(key)) groups.set(key, { key, name: company.city || t('City not listed'), center: cityCenter(company.city), items: [] });
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
  el('atlasZoomIn').onclick = () => { zoom = Math.min(16, zoom * 1.5); paintZoom(); };
  el('atlasZoomOut').onclick = () => { zoom = Math.max(1, zoom / 1.5); paintZoom(); };
  el('atlasReset').onclick = () => { zoom = 1; mapFocus = null; paintZoom(); };
  paintZoom();
})();
