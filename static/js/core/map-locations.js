/* Approximate city centers; never publish these as company coordinates. */
(() => {
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
  window.techmapLocations = {
    normalize,
    cityCenter(name) { const key = normalize(name || ''); return Object.hasOwn(centers, key) ? centers[key] : null; },
  };
})();
