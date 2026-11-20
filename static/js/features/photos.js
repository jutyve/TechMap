/* Shared, local image resizing for account and portfolio uploads. */
window.techmapPhotos = (() => {
  async function prepare(file, maxEdge) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error('Choose a JPG, PNG, or WebP image under 10 MB.');
    }
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('That image could not be opened.'); }
    try {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const ctx = canvas.getContext('2d', { alpha: false });
      for (const scale of [1, .8, .64, .5]) {
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio * scale));
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [.86, .72, .58]) {
          const photo = canvas.toDataURL('image/jpeg', quality);
          if (photo.startsWith('data:image/jpeg;base64,') && photo.length <= Math.floor(180000 * (maxEdge <= 512 ? .5 : 1))) return photo;
        }
      }
      throw new Error('That image could not be compressed. Try a smaller image.');
    } finally { bitmap.close(); }
  }

  async function accountPhoto(photo) {
    const url = '/api/account/photo';
    const response = await fetch(url, photo === undefined ? { cache: 'no-store' } : {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo }),
    });
    if (!response.ok) throw new Error('Could not access your account photo. Try signing in again.');
    return response.json();
  }

  function avatar(target, photo) {
    target?.querySelector('img')?.remove();
    if (target && photo) {
      const image = document.createElement('img');
      image.alt = '';
      image.src = photo;
      target.append(image);
    }
  }

  function picker(host, label, { maxEdge = 512, onChange = () => {}, onBusy = () => {} } = {}) {
    host.classList.add('photo-picker');
    const caption = document.createElement('label');
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    caption.append(input);
    const image = document.createElement('img');
    image.alt = '';
    image.hidden = true;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini-btn';
    remove.textContent = `Remove ${label.toLowerCase()}`;
    remove.hidden = true;
    const status = document.createElement('span');
    status.className = 'photo-status';
    status.setAttribute('role', 'status');
    host.append(image, caption, remove, status);
    let value = '';
    function set(photo) {
      value = photo || '';
      if (value) image.src = value;
      else image.removeAttribute('src');
      image.hidden = remove.hidden = !value;
    }
    async function change(file) {
      input.disabled = remove.disabled = true;
      onBusy(true);
      status.textContent = file ? 'Preparing image…' : '';
      try {
        const next = file ? await prepare(file, maxEdge) : '';
        await onChange(next);
        set(next);
        status.textContent = next ? 'Image selected.' : 'Image removed.';
      } catch (error) { status.textContent = error.message; }
      finally { input.value = ''; input.disabled = remove.disabled = false; onBusy(false); }
    }
    input.addEventListener('change', () => { if (input.files[0]) change(input.files[0]); });
    remove.addEventListener('click', () => change(null));
    return { set, get: () => value };
  }

  return { accountPhoto, avatar, picker };
})();
