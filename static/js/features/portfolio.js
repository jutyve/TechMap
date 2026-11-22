(() => {
  const el = (id) => document.getElementById(id);
  const t = (str) => window.techmapLanguage?.t ? window.techmapLanguage.t(str) : str;
  const form = el('portfolioForm');
  const status = el('portfolioStatus');
  const previewStatus = el('portfolioPreviewStatus');
  const syncStatus = el('portfolioSyncStatus');
  const templates = {
    minimal: ['Minimal', 'Clean and focused'], editorial: ['Editorial', 'Serif and spacious'],
    terminal: ['Terminal', 'Monospace and technical'], gallery: ['Gallery', 'Project-first cards'],
    executive: ['Executive', 'Classic and polished'], bento: ['Bento', 'Modular and colorful'],
    atlas: ['Atlas', 'Split layout'], monograph: ['Monograph', 'High-contrast typography'],
  };
  // Preview-only content; never added to the form or publishing payload.
  const sample = {
    photo_mode: 'none', name: 'Nadia Belkacem', headline: 'Product designer & creative developer', location: 'Rabat, Morocco',
    bio: 'I design and build digital tools that make complicated things feel simple. I’m drawn to work that brings local stories, thoughtful systems, and the open web together.',
    skills: 'Design systems, Creative coding, Accessibility, Prototyping, Research',
    projects: [
      { title: 'The Medina Index', subtitle: 'Digital archive · Art direction & development', period: '2025', description: 'A browsable atlas of independent makers and workshops, built around interviews and hand-drawn maps.' },
      { title: 'Fieldnotes', subtitle: 'Open-source toolkit · Design systems', period: '2024', description: 'A set of accessible components for teams publishing field research on the web.' },
    ],
    experience: [{ title: 'Product Designer', subtitle: 'Studio Tilia', period: '2023–Present', description: 'Lead the design of publishing tools for independent researchers and small teams.' }],
    education: [{ title: 'BA in Visual Communication', subtitle: 'School of Design', period: '2022' }],
    certificates: [{ title: 'Digital Accessibility', subtitle: 'Professional development', period: '2025' }],
  };
  let samplePreference = null;
  const groups = {
    projects: ['Projects', 'project', 'Technologies or role', 'Project link'],
    experience: ['Experience', 'role', 'Company or organization', 'Company link'],
    education: ['Education', 'qualification', 'School or institution', 'Program link'],
    certificates: ['Certifications', 'certificate', 'Issuing organization', 'Credential link'],
  };
  const entryFields = [
    ['title', 'Title', 'text', 140], ['subtitle', '', 'text', 140],
    ['period', 'Date or period', 'text', 140], ['url', '', 'url', 500],
    ['description', 'Description', 'textarea', 2400],
  ];
  const fields = ['name', 'headline', 'location', 'email', 'bio', 'skills', 'github', 'linkedin', 'website', 'resume', 'template', 'motion', 'photo_mode'];
  const lists = {};
  const handoffKey = "techmap_portfolio_signin_draft";
  let initialized = false, initPromise = null, busy = false, current = null;
  let previewTimer, previewRequest, lastPreviewHtml = '', lastSyncSnapshot = null;

  let pendingPhotos = 0;
  const covers = new WeakMap();
  const onBusy = (busy) => { pendingPhotos += busy ? 1 : -1; };
  const onImageChange = () => { samplePreference = false; queuePreview(); };
  const portrait = techmapPhotos.picker(el('portfolioPortrait'), 'Portfolio photo', { onChange: onImageChange, onBusy });
  function paintPhotoMode() {
    el('portfolioPortrait').classList.toggle('hidden', form.elements.photo_mode.value !== 'custom');
  }

  for (const [key, [label, caption]] of Object.entries(templates)) {
    const option = document.createElement('label');
    option.className = 'portfolio-option';
    // Only fixed template metadata is interpolated here.
    option.innerHTML = `<input type="radio" name="template" value="${key}" ${key === 'minimal' ? 'checked' : ''}>
      <span class="portfolio-option-card"><span class="portfolio-thumb ${key}" aria-hidden="true"><i></i><i></i><i></i></span><strong>${label}</strong><small>${caption}</small></span>`;
    el('portfolioTemplates').append(option);
  }

  function addEntry(key, data = {}, focus = false) {
    const { list, add } = lists[key];
    if (list.children.length >= 12) return;
    const entry = document.createElement('fieldset');
    entry.className = 'portfolio-entry portfolio-fields';
    const legend = document.createElement('legend');
    legend.textContent = groups[key][1];
    entry.append(legend);
    for (const [field, label, type, maxLength] of entryFields) {
      const wrapper = document.createElement('label');
      wrapper.textContent = label || groups[key][field === 'url' ? 3 : 2];
      const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = type;
      else { input.rows = 3; wrapper.className = 'full'; }
      input.dataset.field = field;
      input.maxLength = maxLength;
      input.value = data[field] || '';
      wrapper.append(input);
      entry.append(wrapper);
    }
    if (key === 'projects') {
      const host = document.createElement('div');
      host.className = 'full';
      entry.append(host);
      const cover = techmapPhotos.picker(host, 'Project cover', { maxEdge: 1280, onChange: onImageChange, onBusy });
      cover.set(data.cover);
      covers.set(entry, cover);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini-btn portfolio-remove';
    remove.textContent = `Remove ${groups[key][1]}`;
    remove.onclick = () => { entry.remove(); add.disabled = false; add.focus(); updateSyncButtons(); queuePreview(); };
    entry.append(remove);
    list.append(entry);
    add.disabled = list.children.length >= 12;
    if (focus) entry.querySelector('input').focus();
  }

  for (const [key, [label, singular]] of Object.entries(groups)) {
    const section = document.createElement('section');
    section.className = 'portfolio-group';
    section.innerHTML = `<h3>${label}</h3><div></div><button type="button" class="mini-btn">+ Add ${singular}</button>`;
    const add = section.querySelector('button');
    lists[key] = { list: section.querySelector('div'), add };
    add.onclick = () => addEntry(key, {}, true);
    el('portfolioSections').append(section);
  }

  function collect(strict = false) {
    const data = Object.fromEntries(fields.map(key => [key, form.elements[key].value.trim()]));
    data.portrait = portrait.get();
    for (const key of Object.keys(groups)) {
      data[key] = [];
      for (const entry of lists[key].list.children) {
        const inputs = [...entry.querySelectorAll('[data-field]')];
        const values = Object.fromEntries(inputs.map(input => [input.dataset.field, input.value.trim()]));
        if (key === 'projects') values.cover = covers.get(entry).get();
        if (!Object.values(values).some(Boolean)) continue;
        if (!values.title) {
          if (strict) { inputs[0].focus(); throw new Error(`Enter a title for each ${groups[key][1]} you add.`); }
          continue;
        }
        data[key].push(values);
      }
    }
    return data;
  }

  function hasPortfolioContent(data) {
    return Object.entries(data).some(([key, value]) =>
      !['template', 'motion', 'photo_mode'].includes(key) && (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  }

  function applyPortfolioState(data, slugValue = null) {
    for (const key of fields) {
      form.elements[key].value = data[key] ?? (key === 'photo_mode' ? 'account' : key === 'motion' ? 'expressive' : '');
    }
    if (slugValue !== null) form.elements.slug.value = slugValue;
    portrait.set(data.portrait || '');
    paintPhotoMode();
    for (const key of Object.keys(groups)) {
      lists[key].list.replaceChildren();
      lists[key].add.disabled = false;
      (data[key] || []).slice(0, 12).forEach(entry => addEntry(key, entry));
    }
  }

  // --- Resume Studio -> Portfolio Studio sync ---
  const EMAIL_RE = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/;
  const PERIOD_RE = /\b(19|20)\d{2}\b|\b(present|current|now|actuel|aujourd)/i;
  const BULLET_RE = /^\s*(?:[-*•▪◦‣–—]\s+|\d+[.)]\s+)/;
  const INLINE_URL_RE = /\bhttps?:\/\/[^\s)<>"]+/i;

  function trimTo(value, max) {
    return String(value || '').trim().slice(0, max);
  }

  function normalizeEmail(raw) {
    const clean = trimTo(raw, 254);
    return EMAIL_RE.test(clean) ? clean : '';
  }

  function normalizeUrl(raw) {
    const clean = trimTo(raw, 500);
    if (!clean) return { value: '', skipped: false };
    if (/[\s\\<>]/.test(clean) || /^(javascript|data|vbscript|mailto):/i.test(clean)) {
      return { value: '', skipped: true };
    }
    const candidate = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    try {
      const parsed = new URL(candidate);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
          parsed.hostname && parsed.hostname.includes('.') &&
          !parsed.username && !parsed.password && candidate.length <= 500) {
        return { value: candidate, skipped: false };
      }
    } catch { /* Invalid URL */ }
    return { value: '', skipped: true };
  }

  function splitParts(line) {
    return String(line || '').split(/\s+(?:[-–—|])\s+/).map(s => s.trim()).filter(Boolean);
  }

  function splitTitleSubtitlePeriod(parts) {
    if (parts.length >= 3) {
      return { title: trimTo(parts[0], 140), subtitle: trimTo(parts[1], 140), period: trimTo(parts.slice(2).join(' · '), 140) };
    }
    if (parts.length === 2) {
      if (PERIOD_RE.test(parts[1])) {
        return { title: trimTo(parts[0], 140), subtitle: '', period: trimTo(parts[1], 140) };
      }
      return { title: trimTo(parts[0], 140), subtitle: trimTo(parts[1], 140), period: '' };
    }
    return { title: trimTo(parts[0] || '', 140), subtitle: '', period: '' };
  }

  function parseRawEducation(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 12).map(line => {
      const parsed = splitTitleSubtitlePeriod(splitParts(line));
      return { ...parsed, description: '', url: '' };
    }).filter(e => e.title);
  }

  function parseRawProjects(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 12).map(line => {
      let working = line;
      let url = '';
      const match = working.match(INLINE_URL_RE);
      if (match) {
        const normalized = normalizeUrl(match[0].replace(/[.,;:]+$/, ''));
        if (normalized.value) {
          url = normalized.value;
          working = working.replace(match[0], '').replace(/\(\s*\)/g, '').trim();
        }
      }
      const parts = splitParts(working);
      let title = '', subtitle = '', description = '';
      if (parts.length >= 3 && parts[1].length <= 80) {
        title = trimTo(parts[0], 140);
        subtitle = trimTo(parts[1], 140);
        description = trimTo(parts.slice(2).join(' — '), 2400);
      } else if (parts.length >= 2) {
        title = trimTo(parts[0], 140);
        description = trimTo(parts.slice(1).join(' — '), 2400);
      } else {
        title = trimTo(working, 140);
      }
      return { title, subtitle, period: '', description, url, cover: '' };
    }).filter(e => e.title);
  }

  function parseRawExperience(text) {
    const lines = String(text || '').split('\n');
    const items = [];
    let currentEntry = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        currentEntry = null;
        continue;
      }
      const isBullet = BULLET_RE.test(rawLine);
      const parts = splitParts(line);
      const startsNew = !isBullet && (parts.length >= 2 || (!currentEntry));
      if (startsNew) {
        if (items.length >= 12) break;
        const parsed = splitTitleSubtitlePeriod(parts.length ? parts : [line]);
        currentEntry = { ...parsed, description: '', url: '' };
        items.push(currentEntry);
      } else if (currentEntry) {
        const cleaned = line.replace(BULLET_RE, '').trim();
        if (cleaned) {
          const nextDesc = currentEntry.description ? `${currentEntry.description}\n${cleaned}` : cleaned;
          currentEntry.description = trimTo(nextDesc, 2400);
        }
      }
    }
    return items.filter(e => e.title);
  }

  function parseRawCertificates(value) {
    const rawList = Array.isArray(value)
      ? value
      : String(value || '').split(/[,;\n]/);
    return rawList.map(s => String(s || '').trim()).filter(Boolean).slice(0, 12).map(item => {
      const parsed = splitTitleSubtitlePeriod(splitParts(item));
      return { ...parsed, description: '', url: '' };
    }).filter(e => e.title);
  }

  function suggestSlug(name) {
    const slug = String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '');
    return slug.length >= 3 ? slug : '';
  }

  function readResumeSources() {
    let savedForm = null;
    let resumeData = null;
    let origin = 'local';
    let photo = '';
    try { savedForm = JSON.parse(localStorage.getItem('techmap_resume_form') || 'null'); } catch {}
    try { resumeData = window.state?.resumeData || JSON.parse(localStorage.getItem('techmap_resume_data') || 'null'); } catch {}
    try { origin = localStorage.getItem('techmap_resume_origin') || 'local'; } catch {}
    try {
      const rawPhoto = localStorage.getItem('techmap_resume_photo') || '';
      if (rawPhoto.length < 800000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(rawPhoto)) photo = rawPhoto;
    } catch {}
    let liveForm = null;
    if (typeof window.resumeFormToPayload === 'function' && el('rFullName')) {
      const candidate = window.resumeFormToPayload();
      if (Object.values(candidate).some(Boolean)) liveForm = candidate;
    }
    const formValues = liveForm || savedForm || {};
    return { formValues, resumeData, origin, photo };
  }

  function buildFromResume(sources = readResumeSources()) {
    const { formValues: f, resumeData: rd, origin, photo } = sources;
    const formName = trimTo(f.full_name, 140);
    const rdName = trimTo(rd?.full_name, 140);
    const useStructured = Boolean(
      rd && origin === 'ai' && (!formName || !rdName || formName.toLowerCase() === rdName.toLowerCase())
    );
    const contact = (useStructured && rd?.contact) ? rd.contact : {};
    const skippedLinks = [];
    const pickUrl = (label, primary, fallback) => {
      const first = normalizeUrl(primary);
      if (first.value) return first.value;
      const second = normalizeUrl(fallback);
      if (second.value) return second.value;
      if (first.skipped || second.skipped) skippedLinks.push(label);
      return '';
    };

    const skillsList = (useStructured && Array.isArray(rd.skills) && rd.skills.length)
      ? rd.skills
      : String(f.skills || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

    const experience = (useStructured && Array.isArray(rd.experience) && rd.experience.length)
      ? rd.experience.slice(0, 12).map(item => ({
          title: trimTo(item.title, 140),
          subtitle: trimTo(item.company, 140),
          period: trimTo(item.dates, 140),
          description: trimTo(Array.isArray(item.bullets) ? item.bullets.filter(Boolean).join('\n') : '', 2400),
          url: '',
        })).filter(e => e.title)
      : parseRawExperience(f.experience);

    const education = (useStructured && Array.isArray(rd.education) && rd.education.length)
      ? rd.education.slice(0, 12).map(item => ({
          title: trimTo(item.degree, 140),
          subtitle: trimTo(item.school, 140),
          period: trimTo(item.dates, 140),
          description: '',
          url: '',
        })).filter(e => e.title)
      : parseRawEducation(f.education);

    const projects = (useStructured && Array.isArray(rd.projects) && rd.projects.length)
      ? rd.projects.slice(0, 12).map(item => {
          let desc = trimTo(item.description, 2400);
          let url = '';
          const match = desc.match(INLINE_URL_RE);
          if (match) {
            const norm = normalizeUrl(match[0].replace(/[.,;:]+$/, ''));
            if (norm.value) {
              url = norm.value;
              desc = desc.replace(match[0], '').trim();
            }
          }
          return { title: trimTo(item.name, 140), subtitle: '', period: '', description: desc, url, cover: '' };
        }).filter(e => e.title)
      : parseRawProjects(f.projects);

    const certificates = (useStructured && Array.isArray(rd.certifications) && rd.certifications.length)
      ? parseRawCertificates(rd.certifications)
      : parseRawCertificates(f.certifications);

    const mapped = {
      name: formName || rdName,
      headline: trimTo((useStructured ? rd.title : '') || f.target_role || rd?.title, 140),
      location: trimTo(f.city || contact.city || rd?.contact?.city, 140),
      email: normalizeEmail(f.email || contact.email || rd?.contact?.email),
      bio: trimTo((useStructured ? rd.summary : '') || f.summary_hint || rd?.summary, 2400),
      skills: mergeSkills('', skillsList.join(',')),
      github: pickUrl('GitHub', f.github, contact.github || rd?.contact?.github),
      linkedin: pickUrl('LinkedIn', f.linkedin, contact.linkedin || rd?.contact?.linkedin),
      website: pickUrl('Website', f.portfolio, contact.portfolio || rd?.contact?.portfolio),
      projects,
      experience,
      education,
      certificates,
      photo,
      usedAi: useStructured,
      skippedLinks,
    };

    const hasAny = Boolean(
      mapped.name || mapped.headline || mapped.location || mapped.email || mapped.bio ||
      mapped.skills || mapped.github || mapped.linkedin || mapped.website || mapped.photo ||
      mapped.projects.length || mapped.experience.length || mapped.education.length || mapped.certificates.length
    );
    return { ...mapped, hasAny };
  }

  function mergeSkills(existing, incoming) {
    const out = [];
    const seen = new Set();
    for (const raw of `${existing || ''},${incoming || ''}`.split(',')) {
      const item = raw.trim();
      const key = item.toLowerCase();
      if (!item || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return trimTo(out.join(', '), 2400);
  }

  function mergeEntries(existing, incoming) {
    const out = [...existing];
    const seen = new Set(existing.map(e => (e.title || '').trim().toLowerCase()));
    let added = 0;
    for (const item of incoming) {
      if (out.length >= 12) break;
      const key = (item.title || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      added++;
    }
    return { entries: out, added };
  }

  function updateSyncButtons(mapped = buildFromResume()) {
    const currentData = collect();
    const portfolioHasData = hasPortfolioContent(currentData);
    const mergeBtn = el('portfolioSyncMerge');
    const replaceBtn = el('portfolioSyncReplace');
    const openResumeBtn = el('portfolioSyncOpenResume');
    const photoWrap = el('portfolioSyncPhotoWrap');

    photoWrap.classList.toggle('hidden', !mapped.photo);
    if (!mapped.hasAny) {
      mergeBtn.classList.add('hidden');
      replaceBtn.classList.add('hidden');
      openResumeBtn.classList.remove('hidden');
      return;
    }
    openResumeBtn.classList.add('hidden');
    mergeBtn.classList.remove('hidden');
    if (portfolioHasData) {
      mergeBtn.textContent = t('Fill empty fields');
      replaceBtn.classList.remove('hidden');
    } else {
      mergeBtn.textContent = t('Import from Resume Studio');
      replaceBtn.classList.add('hidden');
    }
  }

  function refreshSyncCard() {
    const mapped = buildFromResume();
    const summaryEl = el('portfolioSyncSummary');
    if (!mapped.hasAny) {
      summaryEl.textContent = t('No details found in Resume Studio yet. Add your profile, experience, or projects there to import them in one click.');
    } else {
      const parts = [];
      if (mapped.name || mapped.headline || mapped.bio) parts.push(t('profile'));
      if (mapped.skills) parts.push(t('skills'));
      if (mapped.experience.length) parts.push(`${mapped.experience.length} ${t('experience')}`);
      if (mapped.projects.length) parts.push(`${mapped.projects.length} ${t('projects')}`);
      if (mapped.education.length) parts.push(`${mapped.education.length} ${t('education')}`);
      if (mapped.certificates.length) parts.push(`${mapped.certificates.length} ${t('certifications')}`);
      if (mapped.photo) parts.push(t('photo'));
      const sourceLabel = mapped.usedAi ? t('AI-polished résumé ready:') : t('Ready from Resume Studio:');
      summaryEl.textContent = `${sourceLabel} ${parts.join(', ')}.`;
    }
    updateSyncButtons(mapped);
    return mapped;
  }

  function syncFromResume(mode = 'merge') {
    const mapped = buildFromResume();
    if (!mapped.hasAny) {
      syncStatus.textContent = t('Add some details in Resume Studio first, then sync again.');
      return false;
    }
    const before = collect();
    const beforeSlug = form.elements.slug.value.trim();
    lastSyncSnapshot = { data: before, slug: beforeSlug };

    const next = {
      ...before,
      projects: [...before.projects],
      experience: [...before.experience],
      education: [...before.education],
      certificates: [...before.certificates],
    };
    const changed = [];
    const profileKeys = ['name', 'headline', 'location', 'email', 'bio', 'github', 'linkedin', 'website'];
    for (const key of profileKeys) {
      if (!mapped[key]) continue;
      if (mode === 'replace' || !next[key]) {
        if (next[key] !== mapped[key]) {
          next[key] = mapped[key];
          changed.push(key);
        }
      }
    }
    if (mapped.skills) {
      const mergedSkills = mode === 'replace' ? mapped.skills : mergeSkills(next.skills, mapped.skills);
      if (mergedSkills !== next.skills) {
        next.skills = mergedSkills;
        changed.push('skills');
      }
    }

    for (const key of Object.keys(groups)) {
      if (!mapped[key].length) continue;
      if (mode === 'replace') {
        const existingCovers = key === 'projects'
          ? new Map(before.projects.filter(p => p.cover).map(p => [p.title.toLowerCase(), p.cover]))
          : null;
        next[key] = mapped[key].map(entry => (
          existingCovers && existingCovers.has(entry.title.toLowerCase())
            ? { ...entry, cover: existingCovers.get(entry.title.toLowerCase()) }
            : entry
        ));
        changed.push(key);
      } else {
        const { entries, added } = mergeEntries(next[key], mapped[key]);
        if (added > 0) {
          next[key] = entries;
          changed.push(key);
        }
      }
    }

    const includePhoto = Boolean(mapped.photo && el('portfolioSyncPhoto').checked);
    if (includePhoto && (mode === 'replace' || !before.portrait)) {
      next.photo_mode = 'custom';
      next.portrait = mapped.photo;
      changed.push('photo');
    }

    let nextSlug = beforeSlug;
    if (!nextSlug && next.name) {
      const candidateSlug = suggestSlug(next.name);
      if (candidateSlug) nextSlug = candidateSlug;
    }

    samplePreference = false;
    applyPortfolioState(next, nextSlug);
    el('portfolioSyncUndo').classList.remove('hidden');
    updateSyncButtons(mapped);
    queuePreview();

    if (!changed.length) {
      syncStatus.textContent = t('Everything from Resume Studio is already in your portfolio.');
    } else {
      const skippedNote = mapped.skippedLinks.length
        ? ` (${t('Skipped invalid URL:')} ${mapped.skippedLinks.join(', ')})`
        : '';
      syncStatus.textContent = `${t('Synced from Resume Studio. Review the live preview, then save or publish.')}${skippedNote}`;
    }
    return true;
  }

  async function request(path = '', options = {}) {
    const response = await fetch(`/api/portfolio${path}`, {
      ...options, headers: options.body ? { 'Content-Type': 'application/json' } : {},
    });
    if (!response.ok) {
      const { detail } = await response.json().catch(() => ({}));
      const error = new Error(typeof detail === 'string' ? detail :
        `Check your ${path === '/preview' ? 'profile details and links' : 'username and form details'} and try again.`);
      error.status = response.status;
      throw error;
    }
    return response;
  }

  function showingSample(data) {
    return samplePreference ?? !hasPortfolioContent(data);
  }

  async function refreshPreview() {
    const controller = new AbortController();
    previewRequest = controller;
    try {
      const data = collect();
      const example = showingSample(data);
      const response = await request('/preview', {
        method: 'POST',
        body: JSON.stringify(example ? { ...sample, template: data.template, motion: data.motion } : data),
        signal: controller.signal,
      });
      const html = await response.text();
      if (controller.signal.aborted) return;
      lastPreviewHtml = html;
      el('portfolioFrame').srcdoc = html;
      el('portfolioPreviewMode').textContent = example ? t('Sample content') : t('Private preview');
      el('portfolioSample').textContent = example ? t('Show my content') : t('Show sample');
      previewStatus.hidden = true;
    } catch (error) {
      if (controller.signal.aborted) return;
      previewStatus.textContent = `Preview not updated. ${error.message}`;
      previewStatus.hidden = false;
    }
  }

  function queuePreview() {
    el('portfolioDesign').textContent = (templates[form.elements.template.value] || templates.minimal)[0];
    el('portfolioReplay').disabled = form.elements.motion.value === 'none';
    previewRequest?.abort();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 350);
  }

  function replayAnimations() {
    if (form.elements.motion.value === 'none') return;
    const frame = el('portfolioFrame');
    if (lastPreviewHtml) {
      frame.srcdoc = '';
      requestAnimationFrame(() => { frame.srcdoc = lastPreviewHtml; });
    } else {
      refreshPreview();
    }
  }

  function paintPublished() {
    const published = Boolean(current?.published);
    el('portfolioDraft').classList.toggle('hidden', published);
    el('portfolioUnpublish').classList.toggle('hidden', !published);
    el('portfolioLive').classList.toggle('hidden', !published);
    el('portfolioPublish').textContent = published ? t('Publish changes') : t('Publish website');
    if (published) el('portfolioOpen').href = `/portfolio/${current.slug}`;
    else el('portfolioOpen').removeAttribute('href');
  }

  function initialize() {
    if (initPromise) return initPromise;
    initialized = true;
    initPromise = (async () => {
      // Don't let a delayed account response replace someone’s in-progress typing.
      form.inert = true;
      try {
        current = await (await request()).json();
        let handoff = null;
        try {
          handoff = JSON.parse(sessionStorage.getItem(handoffKey));
          sessionStorage.removeItem(handoffKey);
        } catch { /* Session storage may be blocked. */ }
        const source = handoff && (!current || window.confirm('Continue the draft you started before signing in? Your saved portfolio will not change until you save or publish.')) ? handoff : current;
        if (source) {
          applyPortfolioState(source, source.slug || '');
        }
        paintPublished();
        el('portfolioActions').classList.remove('hidden');
      } catch (error) {
        if (error.status === 401) el('portfolioGuest').classList.remove('hidden');
        else {
          status.textContent = 'Could not load your portfolio. Refresh the page to try again.';
          initialized = false;
          initPromise = null;
        }
      } finally {
        form.inert = false;
        refreshSyncCard();
        queuePreview();
      }
    })();
    return initPromise;
  }

  function setBusy(value) {
    busy = value;
    for (const button of el('portfolioActions').querySelectorAll('button')) button.disabled = value;
  }

  form.addEventListener('input', (event) => {
    if (event.target.id === 'portfolioSyncPhoto') return;
    updateSyncButtons();
    queuePreview();
  });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'motion' || event.target.name === 'template') queuePreview();
  });
  form.elements.photo_mode.addEventListener('change', () => { paintPhotoMode(); onImageChange(); });
  el('portfolioSample').onclick = () => {
    samplePreference = !showingSample(collect());
    queuePreview();
  };
  el('portfolioReplay').onclick = replayAnimations;

  el('portfolioSyncMerge').onclick = () => syncFromResume('merge');
  el('portfolioSyncReplace').onclick = () => {
    if (window.confirm(t('Replace your current portfolio fields with your Resume Studio details? You can undo this right away.'))) {
      syncFromResume('replace');
    }
  };
  el('portfolioSyncOpenResume').onclick = () => {
    document.querySelector('.nav-tab[data-tab="resume"]')?.click();
  };
  el('portfolioSyncUndo').onclick = () => {
    if (!lastSyncSnapshot) return;
    applyPortfolioState(lastSyncSnapshot.data, lastSyncSnapshot.slug);
    lastSyncSnapshot = null;
    el('portfolioSyncUndo').classList.add('hidden');
    syncStatus.textContent = t('Sync undone. Your previous portfolio details were restored.');
    updateSyncButtons();
    queuePreview();
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !event.submitter) return;
    if (pendingPhotos) { status.textContent = 'Wait for your images to finish processing.'; return; }
    const slug = form.elements.slug.value.trim();
    const published = event.submitter.value === 'publish';
    if (!slug) { status.textContent = 'Choose a public username.'; form.elements.slug.focus(); return; }
    if (published && !form.elements.name.value.trim()) {
      status.textContent = 'Enter your display name before publishing.';
      form.elements.name.focus();
      return;
    }
    if (published && current?.published && current.slug !== slug &&
        !window.confirm('Change the public link? The old address will stop working.')) return;
    setBusy(true);
    try {
      current = await (await request('', { method: 'PUT', body: JSON.stringify({ ...collect(true), slug, published }) })).json();
      paintPublished();
      status.textContent = published ? 'Published. Anyone with the link can visit your website.' : 'Private draft saved.';
    } catch (error) {
      status.textContent = error.message;
    } finally { setBusy(false); }
  });

  el('portfolioUnpublish').onclick = async () => {
    if (busy || !window.confirm('Take your public portfolio offline? Your saved content will remain available to you.')) return;
    setBusy(true);
    try {
      await request('/unpublish', { method: 'POST' });
      current.published = false;
      paintPublished();
      status.textContent = 'Website unpublished. Your saved version is now private.';
    } catch (error) { status.textContent = error.message; }
    finally { setBusy(false); }
  };

  el('portfolioCopy').onclick = async () => {
    const url = el('portfolioOpen').href;
    try { await navigator.clipboard.writeText(url); status.textContent = 'Public link copied.'; }
    catch { status.textContent = `Copy your public link: ${url}`; }
  };

  function handoffDraft(event) {
    try {
      if (pendingPhotos) throw new Error('Wait for your images to finish processing.');
      const draft = { ...collect(true), slug: form.elements.slug.value.trim() };
      sessionStorage.setItem(handoffKey, JSON.stringify(draft));
    } catch (error) {
      event.preventDefault();
      status.textContent = error.message;
    }
  }
  el('portfolioSignIn').addEventListener('click', handoffDraft);
  el('portfolioAccountSettings').addEventListener('click', handoffDraft);

  /* Called by the Projects tab: drop one idea into the project editor.
     Returns true, "duplicate" or "full" so the caller can explain what
     happened. Nothing is saved or published until the user does it. */
  function addProjectIdea(idea) {
    if (!idea || !String(idea.title || '').trim()) return false;
    const list = lists.projects.list;
    if (list.children.length >= 12) return 'full';
    const title = String(idea.title).trim();
    const duplicate = [...list.querySelectorAll('[data-field="title"]')]
      .some(input => input.value.trim().toLowerCase() === title.toLowerCase());
    if (duplicate) return 'duplicate';
    addEntry('projects', {
      title: title.slice(0, 140),
      subtitle: String(idea.subtitle || '').slice(0, 140),
      period: String(idea.period || '').slice(0, 140),
      url: '',
      description: String(idea.description || '').slice(0, 2400),
    }, false);
    updateSyncButtons();
    queuePreview();
    const entry = list.lastElementChild;
    if (entry) entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  window.techmapPortfolio = {
    ensureReady: initialize,
    refreshSyncCard,
    buildFromResume,
    syncFromResume,
    addProjectIdea,
    async openFromResume() {
      await initialize();
      const mapped = refreshSyncCard();
      if (!mapped.hasAny) {
        syncStatus.textContent = t('Add some details in Resume Studio first, then sync again.');
        return false;
      }
      const card = el('portfolioSyncCard');
      if (!hasPortfolioContent(collect())) {
        syncFromResume('merge');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        syncStatus.textContent = t('Your portfolio already has content. Choose Fill empty fields or Replace with Resume.');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      card.classList.add('is-highlighted');
      setTimeout(() => card.classList.remove('is-highlighted'), 1800);
      return true;
    },
  };

  const tab = document.querySelector('.nav-tab[data-tab="portfolio"]');
  tab.addEventListener('click', () => {
    initialize();
    refreshSyncCard();
  });
  if (new URLSearchParams(location.search).get('studio') === 'portfolio') {
    document.addEventListener('DOMContentLoaded', () => tab.click(), { once: true });
  }
})();
