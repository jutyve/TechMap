(() => {
  const { t } = window.techmapLanguage;
  let googlePromise, activeFallback;

  function googleMaps() {
    if (googlePromise) return googlePromise;
    googlePromise = (async () => {
      const response = await fetch('/api/maps/config');
      if (!response.ok) return null;
      const { googleMapsBrowserKey } = await response.json();
      if (!googleMapsBrowserKey) return null;
      return new Promise(resolve => {
        const script = document.createElement('script');
        let timer;
        function done(maps) { clearTimeout(timer); resolve(maps); }
        window.techmapGoogleMapsReady = () => done(window.google?.maps || null);
        window.gm_authFailure = () => {
          done(null);
          activeFallback?.();
        };
        const url = new URL('https://maps.googleapis.com/maps/api/js');
        url.search = new URLSearchParams({ key: googleMapsBrowserKey, loading: 'async', callback: 'techmapGoogleMapsReady', language: window.techmapLanguage.lang });
        script.src = url.href;
        script.async = true;
        script.onerror = () => done(null);
        timer = setTimeout(() => done(null), 8000);
        document.head.append(script);
      });
    })().catch(() => null);
    return googlePromise;
  }

  function renderFallback(host, center, exact) {
    const [lat, lng] = center;
    const span = exact ? .009 : .065;
    const url = new URL('https://www.openstreetmap.org/export/embed.html');
    url.searchParams.set('bbox', [lng - span, lat - span / 2, lng + span, lat + span / 2].join(','));
    url.searchParams.set('layer', 'mapnik');
    if (exact) url.searchParams.set('marker', `${lat},${lng}`);
    const frame = document.createElement('iframe');
    frame.title = t('Company location map');
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.src = url.href;
    host.replaceChildren(frame);
  }

  window.initCompanyLocation = (company, root) => {
    const load = root.querySelector('.location-load');
    if (!load) return;
    const host = root.querySelector('.location-frame');
    const layer = root.querySelector('.location-layer');
    const status = root.querySelector('.location-map-status');
    const exact = Boolean(company.coordinates);
    const center = company.coordinates || window.techmapLocations.cityCenter(company.city);
    if (!center) { load.hidden = true; status.textContent = t('No map location available.'); return; }
    status.textContent = t(exact ? 'Verified company coordinates' : 'Approximate city view — office location not verified');
    load.addEventListener('click', async () => {
      load.disabled = true;
      host.hidden = false;
      // Street preview works without a Google key; swap only when Google is ready.
      renderFallback(host, center, exact);
      load.hidden = true;
      const maps = await googleMaps();
      if (!host.isConnected) return;
      if (!maps) {
        status.textContent += ` · ${t('Satellite, hybrid and traffic layers require Google Maps configuration.')}`;
        return;
      }
      const fallback = () => {
        if (!host.isConnected) return;
        layer.closest('label').hidden = true;
        renderFallback(host, center, exact);
        status.textContent = t('Google Maps layers unavailable; showing the street map.');
      };
      activeFallback = fallback;
      const canvas = document.createElement('div');
      canvas.className = 'location-google-canvas';
      host.replaceChildren(canvas);
      try {
        const position = { lat: center[0], lng: center[1] };
        const map = new maps.Map(canvas, { center: position, zoom: exact ? 16 : 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'cooperative' });
        if (exact) new maps.Marker({ map, position, title: company.company_name });
        const traffic = new maps.TrafficLayer();
        layer.closest('label').hidden = false;
        layer.addEventListener('change', () => {
          map.setMapTypeId(layer.value === 'traffic' ? 'roadmap' : layer.value);
          traffic.setMap(layer.value === 'traffic' ? map : null);
        });
      } catch { fallback(); }
    }, { once: true });
  };
})();
