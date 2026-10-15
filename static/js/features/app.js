const API_BASE = "/api";
const PAGE_SIZE = 12;
const MAX_UPLOAD_MB = 10;
const ALLOWED_EXT = [".pdf", ".docx", ".txt", ".md", ".odt"];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAnimate = () => typeof window.anime === "function" && !reduceMotion;

function loadFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem("techmap_favorites") || "[]")); } catch { return new Set(); }
}
function saveFavoritesToStorage(set) {
  try { localStorage.setItem("techmap_favorites", JSON.stringify([...set])); } catch { /* ignore */ }
}

const state = {
  specs: new Set(),
  matchAll: false,
  city: "all",
  search: "",
  sort: "recommended",
  contact: "all",
  offset: 0,
  total: 0,
  reqId: 0,
  file: null,
  resumeData: null,
  resumeTemplate: "classic",
  currentCompany: null,
  currentDetailCompany: null,
  lastSpecs: [],
  preparedTo: "",
  preparedResumeHtml: null,
  preparedResumeFilename: "",
  favorites: loadFavorites(),
  view: "all",
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

document.addEventListener("DOMContentLoaded", () => {
  if (location.protocol === "file:") {
    showBanner("You opened <code>index.html</code> straight from a folder, so it can't reach the backend. Start it with <code>python run.py</code> and open <code>http://127.0.0.1:8000</code> instead.");
  }
  initTabs();
  initFilters();
  initViewToggle();
  loadCompanies(true);
  initDetail();
  initAnalyzer();
  initModals();
  initResumeStudio();
  initAssistant();
  updateFavCount();
  animateBlobs();
});

/* ---------- Helpers ---------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value).trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function truncate(str, n) {
  if (!str) return "No description available.";
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

function showBanner(html) {
  const banner = $("#banner");
  banner.innerHTML = html;
  banner.classList.remove("hidden");
}

function normalizeCompany(c) {
  const specialties = Array.isArray(c.specialties)
    ? c.specialties
    : String(c.specialties || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  let emails = Array.isArray(c.emails)
    ? c.emails
    : String(c.all_emails || "").split(";").map((s) => s.trim()).filter(Boolean);
  if (c.apply_email && !emails.includes(c.apply_email)) emails = [c.apply_email, ...emails];
  return { ...c, specialties, emails };
}

function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

async function apiJson(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadTextFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slug(s) {
  return String(s || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem("techmap_profile") || "{}"); } catch { return {}; }
}
function saveProfile(p) {
  try { localStorage.setItem("techmap_profile", JSON.stringify(p)); } catch { /* ignore */ }
}

/* ---------- Favorites ---------- */
function isFavorite(id) {
  return state.favorites.has(Number(id));
}

function toggleFavorite(id) {
  id = Number(id);
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveFavoritesToStorage(state.favorites);
  updateFavCount();
  syncFavButtons(id);
}

function updateFavCount() {
  const el = $("#favCount");
  if (el) el.textContent = state.favorites.size;
}

function syncFavButtons(id) {
  const on = isFavorite(id);
  $$(`.fav-btn[data-id="${id}"]`).forEach((btn) => {
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "★" : "☆";
  });
  const detailBtn = $(`.fav-btn-detail[data-fav-id="${id}"]`);
  if (detailBtn) {
    detailBtn.classList.toggle("active", on);
    detailBtn.textContent = on ? "★ Saved" : "☆ Save";
  }
}

function initViewToggle() {
  $$(".view-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) return;
      $$(".view-toggle-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.view;
      ++state.reqId;
      $("#directoryStatus").textContent = "";
      $("#companiesGrid").setAttribute("aria-busy", "false");
      $("#loadMore").disabled = false;
      window.updateFilterSummary?.();

      $(".filters-bar").classList.toggle("hidden", state.view === "favorites");
      $(".specialty-picker").classList.toggle("hidden", state.view === "favorites");
      $("#loadMore").classList.toggle("hidden", state.view === "favorites");

      $("#emptyState p").textContent = state.view === "favorites"
        ? "You haven't saved any favorites yet. Click the star on a company card to save it here."
        : "No companies match these filters. Try removing a specialty or clearing the search.";

      if (state.view === "favorites") loadFavoritesView();
      else loadCompanies(true);
    });
  });
}

async function loadFavoritesView() {
  const myReq = ++state.reqId;
  const grid = $("#companiesGrid");
  const empty = $("#emptyState");

  if (state.favorites.size === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    $("#resultsCount").textContent = "0 favorites";
    return;
  }

  try {
    const ids = [...state.favorites].join(",");
    const data = await apiJson(`/companies/by-ids?ids=${ids}`);
    if (myReq !== state.reqId || state.view !== "favorites") return;
    const items = (data.items || []).map(normalizeCompany);

    $("#resultsCount").textContent = `${items.length} favorite${items.length === 1 ? "" : "s"}`;
    empty.classList.toggle("hidden", items.length !== 0);

    grid.innerHTML = "";
    const cards = items.map(createCard);
    cards.forEach((c) => grid.appendChild(c));

    if (canAnimate() && cards.length) {
      cards.forEach((c) => (c.style.opacity = "0"));
      anime({ targets: cards, opacity: [0, 1], translateY: [16, 0], delay: anime.stagger(40), duration: 450, easing: "easeOutQuad" });
    }
  } catch (e) {
    console.error(e);
    showToast("Could not load favorites");
  }
}

/* ---------- Background blobs ---------- */
function animateBlobs() {
  if (!canAnimate()) return;
  anime({
    targets: ".blob",
    translateX: () => anime.random(-40, 40),
    translateY: () => anime.random(-40, 40),
    scale: () => anime.random(90, 120) / 100,
    easing: "easeInOutSine",
    duration: 8000,
    direction: "alternate",
    loop: true,
    delay: anime.stagger(1000),
  });
}

/* ---------- Tabs (includes the Tools dropdown) ---------- */
function initTabs() {
  const tabButtons = $$("[data-tab]");
  const panels = $$(".tab-panel");
  const toolsToggle = $("#toolsToggle");
  const toolsMenu = $("#toolsMenu");
  const toolTabs = ["analyzer", "resume", "assistant"];

  function activate(target) {
    const label = document.querySelector(`.nav-tabs [data-tab="${target}"]`);
    if (label) document.getElementById("currentPage").textContent = label.textContent.replace(/^[^a-zA-Z]+/, "").replace(/ AI$/, "").trim();
    window.scrollTo({ top: 0, behavior: "instant" });
    tabButtons.forEach((t) => t.classList.toggle("active", t.dataset.tab === target));
    toolsToggle.classList.toggle("active", toolTabs.includes(target));

    panels.forEach((p) => {
      if (p.id === target) {
        p.classList.add("active");
        if (canAnimate()) {
          anime({ targets: p, opacity: [0, 1], translateY: [20, 0], duration: 500, easing: "easeOutQuad" });
        }
        if (target === "dashboard") loadStats();
      } else {
        p.classList.remove("active");
      }
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activate(btn.dataset.tab);
      toolsMenu.classList.add("hidden");
    });
  });

  toolsToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toolsMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!$("#toolsDropdown").contains(e.target)) toolsMenu.classList.add("hidden");
  });
}

/* ---------- Filters ---------- */
async function initFilters() {
  try {
    const [specialties, cities] = await Promise.all([apiJson("/specialties"), apiJson("/cities")]);
    if (specialties.length && typeof specialties[0] === "string") {
      showBanner("The backend that is running looks like an <strong>older</strong> version of the API. Stop the server (Ctrl+C) and start it again with <code>python run.py</code>.");
    }
    renderSpecialtyChips(specialties);

    const citySelect = $("#cityFilter");
    cities.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      citySelect.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
    showBanner(`Can't reach the backend (${escapeHtml(e.message)}). Start it with <code>python run.py</code> from the project root (the folder holding <code>run.py</code>), then open <code>http://127.0.0.1:8000</code>.`);
  }

  $("#cityFilter").addEventListener("change", (e) => {
    state.city = e.target.value;
    if (state.view === "all") loadCompanies(true);
  });

  $("#matchAll").addEventListener("change", (e) => {
    state.matchAll = e.target.checked;
    if (state.specs.size > 1 && state.view === "all") loadCompanies(true);
  });

  $("#clearSpecialties").addEventListener("click", () => {
    state.specs.clear();
    $$(".chip").forEach((c) => {
      c.classList.remove("active");
      c.setAttribute("aria-pressed", "false");
    });
    updateClearButton();
    if (state.view === "all") loadCompanies(true);
  });

  let debounceTimer;
  $("#searchInput").addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      if (state.view === "all") loadCompanies(true);
    }, 350);
  });

  $("#loadMore").addEventListener("click", () => loadCompanies(false));
}

function renderSpecialtyChips(list) {
  const wrap = $("#specialtyChips");
  const items = list.map((s) => (typeof s === "string" ? { name: s, count: null } : s));

  if (items.length === 0) {
    wrap.innerHTML = `<span class="muted">No specialties found yet. Check that your CSV has a <code>specialties</code> column.</span>`;
    return;
  }

  wrap.innerHTML = items
    .map(
      (s) => `<button type="button" class="chip" data-name="${escapeHtml(s.name)}" aria-pressed="false">
        <span class="chip-label">${escapeHtml(s.name)}</span>${s.count !== null ? `<span class="chip-count">${s.count}</span>` : ""}
      </button>`
    )
    .join("");

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;

    const name = btn.dataset.name;
    if (state.specs.has(name)) state.specs.delete(name);
    else state.specs.add(name);

    const on = state.specs.has(name);
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));

    if (canAnimate()) {
      anime({ targets: btn, scale: [0.92, 1], duration: 350, easing: "easeOutBack" });
    }

    updateClearButton();
    if (state.view === "all") loadCompanies(true);
  });

  if (canAnimate()) {
    anime({ targets: ".chip", opacity: [0, 1], translateY: [8, 0], delay: anime.stagger(40), duration: 450, easing: "easeOutQuad" });
  }
}

function updateClearButton() {
  $("#clearSpecialties").classList.toggle("hidden", state.specs.size === 0);
}

/* ---------- Companies ---------- */
async function loadCompanies(reset) {
  if (state.view !== "all") return;

  const myReq = ++state.reqId;
  const status = $("#directoryStatus");
  status.textContent = "Finding your next team…";
  $("#companiesGrid").setAttribute("aria-busy", "true");
  $("#loadMore").disabled = true;
  window.updateFilterSummary?.();
  if (reset) state.offset = 0;

  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: state.offset, sort: state.sort, contact: state.contact });
  if (state.search) params.set("search", state.search);
  if (state.city !== "all") params.set("city", state.city);
  if (state.specs.size) {
    params.set("specialties", [...state.specs].join("|"));
    params.set("match", state.matchAll ? "all" : "any");
  }

  try {
    const data = await apiJson(`/companies?${params}`);
    if (myReq !== state.reqId) return;

    const items = (Array.isArray(data) ? data : data.items || []).map(normalizeCompany);
    state.total = Array.isArray(data) ? data.length : data.total;
    renderCompanies(items, reset);
    state.offset += items.length;

    $("#loadMore").classList.toggle("hidden", state.offset >= state.total);
  } catch (e) {
    if (myReq !== state.reqId) return;
    console.error(e);
    status.textContent = "Could not load companies. Check your connection and try again.";
  } finally {
    if (myReq === state.reqId) {
      $("#companiesGrid").setAttribute("aria-busy", "false");
      $("#loadMore").disabled = false;
      if (status.textContent === "Finding your next team…") status.textContent = "";
    }
  }
}

function renderCompanies(items, reset) {
  const grid = $("#companiesGrid");
  const empty = $("#emptyState");

  $("#resultsCount").textContent = `${state.total} compan${state.total === 1 ? "y" : "ies"}`;

  if (reset) grid.innerHTML = "";
  empty.classList.toggle("hidden", state.total !== 0);

  const filtering = state.search || state.city !== "all" || state.specs.size > 0;
  if (state.total === 0 && !filtering) {
    showBanner("The backend is running but found <strong>0 companies</strong>. Check that your CSV is at <code>database/data/morocco_tech_companies_clean.csv</code> and that it has a header row.");
  }

  const cards = items.map(createCard);
  const animated = canAnimate() ? cards.slice(0, 24) : [];
  animated.forEach((c) => (c.style.opacity = "0"));
  cards.forEach((c) => grid.appendChild(c));

  if (animated.length) {
    anime({ targets: animated, opacity: [0, 1], translateY: [26, 0], delay: anime.stagger(50), duration: 550, easing: "easeOutQuad" });
  }
}

function createCard(c) {
  const card = document.createElement("article");
  card.className = "company-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open details for ${c.company_name}`);

  const initial = (c.company_name || "?").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const site = safeUrl(c.website) || safeUrl(c.apply_link);
  const shown = c.specialties.slice(0, 3);
  const extra = c.specialties.length - shown.length;
  const fav = isFavorite(c.id);

  const hints = [
    c.website || c.apply_link ? `<span title="Has a website">🌐</span>` : "",
    c.emails.length ? `<span title="Has an email">✉️</span>` : "",
    c.phone ? `<span title="Has a phone number">📞</span>` : "",
    c.careers_url ? `<span title="Has a careers page">💼</span>` : "",
  ].join("");

  card.innerHTML = `
    <div class="card-top">
      <div class="company-logo" style="--logo-hue:${(c.id * 47) % 360}">${escapeHtml(initial)}</div>
      <div class="card-top-right">
        <div class="contact-hints">${c.careers_url ? '<span class="careers-indicator">Careers page</span>' : '<span class="directory-indicator">In the directory</span>'}</div>
        <button type="button" class="fav-btn ${fav ? "active" : ""}" data-id="${c.id}" aria-label="Save ${escapeHtml(c.company_name)}" aria-pressed="${fav}">${fav ? "★" : "☆"}</button>
      </div>
    </div>
    <h3 class="company-name">${escapeHtml(c.company_name)}</h3>
    <div class="company-city"><svg class="location-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg> ${escapeHtml(c.city || "Morocco")}</div>
    <div class="specialty-tags">
      ${shown.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}
      ${extra > 0 ? `<span class="tag tag-more">+${extra}</span>` : ""}
    </div>
    <p class="company-desc">${escapeHtml(truncate(c.description, 150) || "Explore this company’s specialties and contact details to see where your skills could fit.")}</p>
    <div class="card-footer">
      ${
        site
          ? `<button type="button" class="btn-website" data-url="${escapeHtml(site)}">Website ↗</button>`
          : `<button type="button" class="btn-website disabled" disabled>No website</button>`
      }
      <button type="button" class="btn-email">View company →</button>
    </div>
    <button type="button" class="compare-pick" data-compare-id="${c.id}" aria-pressed="${window.isCompared?.(c.id) || false}">${window.isCompared?.(c.id) ? "✓ Selected for comparison" : "+ Add to comparison"}</button>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.closest(".compare-pick")) { window.toggleCompare?.(c); return; }
    const favBtn = e.target.closest(".fav-btn");
    if (favBtn) {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.id);
      if (state.view === "favorites") loadFavoritesView();
      return;
    }

    const siteBtn = e.target.closest(".btn-website");
    if (siteBtn) {
      e.stopPropagation();
      const url = safeUrl(siteBtn.dataset.url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    openDetail(c, card);
  });

  card.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target === card) {
      e.preventDefault();
      openDetail(c, card);
    }
  });

  return card;
}

/* ---------- Company detail panel ---------- */
let lastFocus = null;

function initDetail() {
  $("#detailClose").addEventListener("click", closeDetail);
  $("#detailOverlay").addEventListener("click", (e) => {
    if (e.target.id === "detailOverlay") closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#applyOverlay").classList.contains("hidden")) { closeOverlay("#applyOverlay"); return; }
      if (!$("#letterOverlay").classList.contains("hidden")) { closeOverlay("#letterOverlay"); return; }
      if (!$("#detailOverlay").classList.contains("hidden")) closeDetail();
    }
  });

  $("#detailContent").addEventListener("click", async (e) => {
    const favBtn = e.target.closest("[data-fav-id]");
    if (favBtn) {
      toggleFavorite(favBtn.dataset.favId);
      return;
    }

    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        showToast("Copied to clipboard");
      } catch {
        showToast("Could not copy, select the text instead");
      }
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const company = state.currentDetailCompany;
      if (!company) return;
      if (actionBtn.dataset.action === "letter") openLetterModal(company);
      if (actionBtn.dataset.action === "apply") openApplyModal(company);
    }
  });
}

function linkRow(label, url, buttonText) {
  const safe = safeUrl(url);
  return `
    <div class="info-row">
      <span class="info-label">${label}</span>
      ${
        safe
          ? `<span class="info-value"><a class="info-link" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(hostOf(safe))}${escapeHtml(new URL(safe).pathname.replace(/\/$/, ""))}</a>
             <a class="mini-btn primary" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${buttonText}</a></span>`
          : `<span class="info-value muted">Not available</span>`
      }
    </div>`;
}

function detailHtml(c) {
  const tags = c.specialties.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("");
  const fav = isFavorite(c.id);

  const emails = c.emails.length
    ? c.emails
        .map(
          (e) => `
      <div class="info-row">
        <span class="info-value email-value">${escapeHtml(e)}
          ${e === c.apply_email ? `<span class="best-badge">Best to apply</span>` : ""}
        </span>
        <span class="info-actions">
          <button type="button" class="mini-btn" data-copy="${escapeHtml(e)}">Copy</button>
          <a class="mini-btn primary" href="mailto:${escapeHtml(e)}">Write email</a>
        </span>
      </div>`
        )
        .join("")
    : `<div class="info-row"><span class="info-value muted">No email found</span></div>`;

  const phone = c.phone
    ? `<div class="info-row">
         <span class="info-value">${escapeHtml(c.phone)}</span>
         <span class="info-actions">
           <button type="button" class="mini-btn" data-copy="${escapeHtml(c.phone)}">Copy</button>
           <a class="mini-btn primary" href="tel:${escapeHtml(c.phone.replace(/[^\d+]/g, ""))}">Call</a>
         </span>
       </div>`
    : `<div class="info-row"><span class="info-value muted">No phone number found</span></div>`;

  return `
    <header class="detail-head">
      <div class="company-logo big">${escapeHtml((c.company_name || "?").charAt(0).toUpperCase())}</div>
      <div class="detail-head-info">
        <h2 id="detailName">${escapeHtml(c.company_name)}</h2>
        <div class="company-city"><svg class="location-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg> ${escapeHtml(c.city || "Morocco")}</div>
      </div>
      <button type="button" class="fav-btn-detail ${fav ? "active" : ""}" data-fav-id="${c.id}">${fav ? "★ Saved" : "☆ Save"}</button>
    </header>
    <div class="specialty-tags detail-tags">${tags || `<span class="muted">No specialties listed</span>`}</div>

    <div class="detail-grid">
      <section class="detail-section">
        <h4>About</h4>
        <p class="detail-desc">${escapeHtml(c.description || "No description available.")}</p>
        ${c.apply_via ? `<h4>Best way to reach them</h4><p class="detail-desc">${escapeHtml(c.apply_via)}</p>` : ""}
        ${c.source ? `<h4>Found through</h4><p class="detail-desc">${escapeHtml(c.source)}</p>` : ""}
      </section>

      <section class="detail-section">
        <h4>Email</h4>
        ${emails}
        <h4>Phone</h4>
        ${phone}
      </section>

      <section class="detail-section wide">
        <h4>Links</h4>
        ${linkRow("Website", c.website, "Visit")}
        ${linkRow("Careers page", c.careers_url, "Open")}
        ${linkRow("Contact page", c.contact_url, "Open")}
        ${c.apply_link && c.apply_link !== c.website && c.apply_link !== c.careers_url && c.apply_link !== c.contact_url ? linkRow("Apply link", c.apply_link, "Apply") : ""}
      </section>

      <section class="detail-section wide">
        <h4>Apply to ${escapeHtml(c.company_name)}</h4>
        <p class="detail-desc">Let AI help you stand out: write a tailored cover letter, or prepare a full application email with your resume, ready to send from your own inbox.</p>
        <div class="apply-actions">
          <button type="button" class="mini-btn" data-action="letter">📝 Write cover letter</button>
          <button type="button" class="mini-btn primary" data-action="apply">🚀 Apply with AI</button>
        </div>
      </section>
    </div>`;
}

function openDetail(company, cardEl) {
  lastFocus = document.activeElement;
  state.currentDetailCompany = company;
  const overlay = $("#detailOverlay");
  const box = $(".detail-box", overlay);

  $("#detailContent").innerHTML = detailHtml(company);
  window.addCompanyNotes?.(company);
  overlay.classList.remove("hidden");
  document.body.classList.add("no-scroll");
  box.scrollTop = 0;
  $("#detailClose").focus({ preventScroll: true });

  if (!canAnimate()) return;

  const from = cardEl.getBoundingClientRect();
  const to = box.getBoundingClientRect();

  anime.remove([box, overlay]);
  anime({ targets: overlay, opacity: [0, 1], duration: 250, easing: "linear" });
  anime({
    targets: box,
    translateX: [from.left - to.left, 0],
    translateY: [from.top - to.top, 0],
    scaleX: [from.width / to.width, 1],
    scaleY: [from.height / to.height, 1],
    duration: 550,
    easing: "easeOutExpo",
  });
  anime({
    targets: ".detail-head, .detail-tags, .detail-section",
    opacity: [0, 1],
    translateY: [14, 0],
    delay: anime.stagger(70, { start: 220 }),
    duration: 450,
    easing: "easeOutQuad",
  });
}

function closeDetail() {
  const overlay = $("#detailOverlay");
  if (overlay.classList.contains("hidden")) return;

  const finish = () => {
    overlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
    $(".detail-box", overlay).style.transform = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };

  if (!canAnimate()) {
    finish();
    return;
  }

  anime.remove([overlay, $(".detail-box", overlay)]);
  anime({ targets: overlay, opacity: [1, 0], duration: 200, easing: "linear", complete: finish });
}

/* ---------- Letter / Apply modals ---------- */
function initModals() {
  $("#letterClose").addEventListener("click", () => closeOverlay("#letterOverlay"));
  $("#applyClose").addEventListener("click", () => closeOverlay("#applyOverlay"));
  $("#letterOverlay").addEventListener("click", (e) => { if (e.target.id === "letterOverlay") closeOverlay("#letterOverlay"); });
  $("#applyOverlay").addEventListener("click", (e) => { if (e.target.id === "applyOverlay") closeOverlay("#applyOverlay"); });

  $("#letterForm").addEventListener("submit", submitLetterForm);
  $("#applyForm").addEventListener("submit", submitApplyForm);

  $("#copyLetterBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#letterText").value);
      showToast("Copied to clipboard");
    } catch {
      showToast("Could not copy");
    }
  });

  $("#downloadLetterBtn").addEventListener("click", () => {
    downloadTextFile(`cover-letter-${slug(state.currentCompany?.company_name)}.txt`, $("#letterText").value);
  });

  $$('input[name="resumeSource"]').forEach((r) =>
    r.addEventListener("change", () => {
      const useFile = $("#srcFile").checked;
      $("#aResumeFile").classList.toggle("hidden", !useFile);
      if (useFile) $("#aResumeFile").click();
    })
  );

  $("#aResumeFile").addEventListener("change", () => {
    const f = $("#aResumeFile").files[0];
    $("#aFileLabel").textContent = f ? `Remember to attach: ${f.name} (${formatSize(f.size)})` : "";
  });

  $("#viewPreparedResumeBtn").addEventListener("click", () => {
    if (!state.preparedResumeHtml) return;
    const blob = new Blob([state.preparedResumeHtml], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  });

  $("#downloadPreparedResumeBtn").addEventListener("click", () => {
    if (!state.preparedResumeHtml) return;
    downloadTextFile(state.preparedResumeFilename || "resume.html", state.preparedResumeHtml, "text/html");
  });

  $("#openGmailBtn").addEventListener("click", () => {
    const to = state.preparedTo || "";
    const subject = $("#applySubjectInput").value;
    const body = $("#applyBodyInput").value;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  });

  $("#openMailAppBtn").addEventListener("click", () => {
    const to = state.preparedTo || "";
    const subject = $("#applySubjectInput").value;
    const body = $("#applyBodyInput").value;
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

function openOverlay(sel) {
  const overlay = $(sel);
  overlay.classList.remove("hidden");
  document.body.classList.add("no-scroll");
  if (canAnimate()) {
    anime({ targets: overlay, opacity: [0, 1], duration: 220, easing: "linear" });
    anime({ targets: $(".detail-box", overlay), scale: [0.94, 1], opacity: [0, 1], duration: 350, easing: "easeOutQuad" });
  }
}

function closeOverlay(sel) {
  const overlay = $(sel);
  overlay.classList.add("hidden");
  document.body.classList.remove("no-scroll");
}

function openLetterModal(company) {
  state.currentCompany = company;
  $("#letterCompanyName").textContent = company.company_name;
  $("#letterResult").classList.add("hidden");
  $("#letterStatus").className = "analysis-status hidden";
  $("#letterForm").classList.remove("hidden");

  const saved = loadProfile();
  $("#lFullName").value = saved.full_name || "";
  $("#lTargetRole").value = saved.target_role || "";
  $("#lHighlights").value = "";

  openOverlay("#letterOverlay");
}

function openApplyModal(company) {
  state.currentCompany = company;
  $("#applyCompanyName").textContent = company.company_name;
  $("#applyStatus").className = "analysis-status hidden";
  $("#applyForm").classList.remove("hidden");
  $("#applyResult").classList.add("hidden");

  const saved = loadProfile();
  $("#aFullName").value = saved.full_name || "";
  $("#aEmail").value = saved.email || "";
  $("#aPhone").value = saved.phone || "";
  $("#aTargetRole").value = saved.target_role || "";
  $("#aNote").value = "";
  $("#aResumeFile").value = "";
  $("#aResumeFile").classList.add("hidden");
  $("#aFileLabel").textContent = "";

  const hasStudioResume = !!state.resumeData;
  $("#srcStudio").disabled = !hasStudioResume;
  $("#srcStudio").checked = hasStudioResume;
  $("#srcQuick").checked = !hasStudioResume;
  $("#srcFile").checked = false;

  openOverlay("#applyOverlay");
}

async function submitLetterForm(e) {
  e.preventDefault();
  const fullName = $("#lFullName").value.trim();
  if (!fullName) return;

  const payload = {
    full_name: fullName,
    target_role: $("#lTargetRole").value.trim(),
    highlights: $("#lHighlights").value.trim(),
    tone: $("#lTone").value,
  };
  saveProfile({ ...loadProfile(), full_name: fullName, target_role: payload.target_role });

  const btn = $("#letterSubmitBtn");
  btn.disabled = true;
  $("#letterStatus").className = "analysis-status working";
  $("#letterStatus").textContent = "Writing your cover letter...";
  $("#letterStatus").classList.remove("hidden");
  $("#letterResult").classList.add("hidden");

  try {
    const result = await apiJson(`/companies/${state.currentCompany.id}/cover-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    $("#letterStatus").classList.add("hidden");
    $("#letterText").value = result.letter;
    $("#letterResult").classList.remove("hidden");
  } catch (err) {
    $("#letterStatus").className = "analysis-status error";
    $("#letterStatus").textContent = err.message || "Could not generate the letter.";
  } finally {
    btn.disabled = false;
  }
}

async function submitApplyForm(e) {
  e.preventDefault();
  const company = state.currentCompany;
  if (!company) return;

  const fullName = $("#aFullName").value.trim();
  if (!fullName) return;

  const resumeSource = $$('input[name="resumeSource"]').find((r) => r.checked)?.value || "quick";

  if (resumeSource === "file" && !$("#aResumeFile").files[0]) {
    showToast("Pick the resume file you plan to attach (so we can remind you of its name).");
    $("#aResumeFile").click();
    return;
  }

  saveProfile({
    ...loadProfile(),
    full_name: fullName,
    email: $("#aEmail").value.trim(),
    phone: $("#aPhone").value.trim(),
    target_role: $("#aTargetRole").value.trim(),
  });

  const form = new FormData();
  form.append("full_name", fullName);
  form.append("email", $("#aEmail").value.trim());
  form.append("phone", $("#aPhone").value.trim());
  form.append("target_role", $("#aTargetRole").value.trim());
  form.append("note", $("#aNote").value.trim());
  form.append("resume_source", resumeSource);
  if (resumeSource === "studio" && state.resumeData) {
    form.append("resume_json", JSON.stringify(state.resumeData));
  }

  const btn = $("#applySubmitBtn");
  btn.disabled = true;
  $("#applyStatus").className = "analysis-status working";
  $("#applyStatus").textContent = "Drafting your application...";
  $("#applyStatus").classList.remove("hidden");
  $("#applyResult").classList.add("hidden");

  try {
    const result = await apiJson(`/companies/${company.id}/prepare-application`, { method: "POST", body: form });

    $("#applyStatus").classList.add("hidden");
    $("#applyToEmail").textContent = result.to;

    state.preparedTo = result.to;
    state.preparedResumeHtml = resumeSource === "studio" && state.resumeData && window.studioStandaloneHtml
      ? await window.studioStandaloneHtml() : result.resume_html || null;
    state.preparedResumeFilename = result.resume_filename || `${slug(fullName)}-resume.html`;

    const hasResumeStep = !!result.resume_html;
    $("#applyResumeStep").classList.toggle("hidden", !hasResumeStep);
    $("#applyStepTitle").textContent = hasResumeStep ? "2. Review & send" : "1. Review & send";

    $("#applySubjectInput").value = result.subject;
    $("#applyBodyInput").value = result.body;

    $("#applyResult").classList.remove("hidden");
    $("#applyForm").classList.add("hidden");

    showToast("Your application is ready — open it in Gmail or your email app to send it.");
  } catch (err) {
    $("#applyStatus").className = "analysis-status error";
    $("#applyStatus").textContent = err.message || "Could not prepare the application.";
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Dashboard ---------- */
async function loadStats() {
  try {
    const stats = await apiJson("/stats");
    animateCounter("statTotal", stats.total_companies);
    animateCounter("statWebsite", stats.with_website);
    animateCounter("statEmail", stats.with_email);
    animateCounter("statPhone", stats.with_phone);

    renderRaceChart("specialtyChart", stats.specialty_distribution, 8);
    renderRaceChart("cityChart", stats.city_distribution, 8);
    renderBarChart("applyViaChart", stats.apply_via_distribution, 6);
  } catch (e) {
    console.error(e);
    showToast("Could not load statistics");
  }
}

function animateCounter(id, value) {
  const el = document.getElementById(id);
  el.textContent = value.toLocaleString();
  if (!canAnimate()) return;

  const obj = { val: 0 };
  anime({
    targets: obj,
    val: value,
    round: 1,
    duration: 1200,
    easing: "easeOutExpo",
    update: () => (el.textContent = obj.val.toLocaleString()),
  });
}

function topEntries(data, limit) {
  return Object.entries(data || {})
    .filter(([label]) => label && label !== "nan")
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function renderBarChart(containerId, data, limit = 8) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  container.style.height = "";
  container.classList.remove("race");

  const entries = topEntries(data, limit);
  if (entries.length === 0) {
    container.innerHTML = `<div class="no-data">No data available</div>`;
    return;
  }

  const max = entries[0][1];

  entries.forEach(([label, value], i) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">${value}</div>`;
    container.appendChild(row);

    const fill = $(".bar-fill", row);
    const finalWidth = `${(value / max) * 100}%`;

    if (!canAnimate()) {
      fill.style.width = finalWidth;
      return;
    }
    fill.style.width = "0%";
    anime({ targets: fill, width: finalWidth, duration: 900, delay: i * 80, easing: "easeOutQuad" });
  });
}

const RACE_ROW_H = 38;
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function renderRaceChart(containerId, data, limit = 8) {
  const container = document.getElementById(containerId);

  if (container._race) container._race.pause();

  container.innerHTML = "";
  const entries = topEntries(data, limit);

  if (entries.length === 0) {
    container.classList.remove("race");
    container.style.height = "";
    container.innerHTML = `<div class="no-data">No data available</div>`;
    return;
  }

  container.classList.add("race");
  container.style.height = `${entries.length * RACE_ROW_H}px`;

  const max = entries[0][1];

  const rows = entries.map(([label, value], i) => {
    const el = document.createElement("div");
    el.className = "race-row";
    el.innerHTML = `
      <div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">0</div>`;
    container.appendChild(el);
    return { el, fill: $(".bar-fill", el), val: $(".bar-value", el), value, rank: -1, index: i };
  });

  const paint = (live) => {
    const order = live.map((_, i) => i).sort((a, b) => live[b] - live[a] || a - b);

    order.forEach((idx, rank) => {
      const row = rows[idx];
      if (row.rank !== rank) {
        row.rank = rank;
        row.el.style.transform = `translateY(${rank * RACE_ROW_H}px)`;
        row.el.classList.toggle("leader", rank === 0);
      }
      row.fill.style.width = `${(live[idx] / max) * 100}%`;
      row.val.textContent = Math.round(live[idx]).toLocaleString();
    });
  };

  const finalValues = entries.map(([, v]) => v);

  if (!canAnimate()) {
    rows.forEach((r) => (r.el.style.transition = "none"));
    paint(finalValues);
    return;
  }

  const plan = entries.map(() => ({ delay: Math.random() * 0.35, span: 0.5 + Math.random() * 0.15 }));
  paint(entries.map(() => 0));

  const clock = { t: 0 };
  container._race = anime({
    targets: clock,
    t: 1,
    duration: 4200,
    easing: "linear",
    update: () => {
      paint(entries.map(([, value], i) => value * easeOutCubic(clamp01((clock.t - plan[i].delay) / plan[i].span))));
    },
    complete: () => paint(finalValues),
  });
}

/* ---------- Analyzer (resume upload) ---------- */
function initAnalyzer() {
  const dropzone = $("#dropzone");
  const input = $("#resumeFile");

  dropzone.addEventListener("click", () => input.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragging");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragging");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  input.addEventListener("change", () => {
    if (input.files[0]) setFile(input.files[0]);
  });

  $("#removeFile").addEventListener("click", clearFile);
  $("#analyzeBtn").addEventListener("click", analyzeFile);
  $("#findCompaniesBtn").addEventListener("click", useDetectedSpecialties);
}

function setFile(file) {
  const ext = "." + file.name.split(".").pop().toLowerCase();

  if (ext === ".doc") {
    showToast("Old .doc files aren't supported. Save it as .docx or PDF first.");
    return;
  }
  if (!ALLOWED_EXT.includes(ext)) {
    showToast("Unsupported file. Use PDF, Word (.docx), TXT or ODT.");
    return;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    showToast(`File is too large (${MAX_UPLOAD_MB} MB max).`);
    return;
  }
  if (file.size === 0) {
    showToast("That file is empty.");
    return;
  }

  state.file = file;
  $("#fileName").textContent = file.name;
  $("#fileSize").textContent = formatSize(file.size);
  $("#analyzeBtn").disabled = false;
  $("#analyzerResults").classList.add("hidden");

  const chip = $("#fileChip");
  chip.classList.remove("hidden");
  $("#dropzone").classList.add("has-file");

  if (canAnimate()) {
    anime({ targets: chip, opacity: [0, 1], translateY: [10, 0], duration: 400, easing: "easeOutQuad" });
  }
}

function clearFile() {
  state.file = null;
  $("#resumeFile").value = "";
  $("#fileChip").classList.add("hidden");
  $("#dropzone").classList.remove("has-file");
  $("#analyzeBtn").disabled = true;
  $("#analyzerResults").classList.add("hidden");
}

async function analyzeFile() {
  if (!state.file) return;

  const btn = $("#analyzeBtn");
  btn.disabled = true;
  btn.classList.add("loading");
  btn.innerHTML = "<span>Analyzing...</span>";

  showAnalysisStatus("Reading your resume and scoring it. This can take up to a minute.", "working");

  try {
    const form = new FormData();
    form.append("file", state.file);
    const result = await apiJson("/analyze", { method: "POST", body: form });
    displayAnalyzerResults(result);
  } catch (e) {
    console.error(e);
    showAnalysisStatus(e.message || "Analysis failed.", "error");
  } finally {
    btn.classList.remove("loading");
    btn.innerHTML = "<span>Analyze Resume</span>";
    btn.disabled = !state.file;
  }
}

function showAnalysisStatus(message, kind) {
  const results = $("#analyzerResults");
  const status = $("#analysisStatus");

  results.classList.remove("hidden");
  $("#analysisBody").classList.add("hidden");
  status.className = `analysis-status ${kind}`;
  status.textContent = message;

  if (canAnimate()) {
    anime({ targets: results, opacity: [0, 1], translateY: [12, 0], duration: 350, easing: "easeOutQuad" });
  }
}

function verdictFor(score) {
  if (score >= 90) return "Excellent resume";
  if (score >= 75) return "Strong resume";
  if (score >= 60) return "Good, with room to grow";
  if (score >= 40) return "Getting there";
  return "Needs real work";
}

function fillList(selector, items, emptyText) {
  const el = $(selector);
  el.innerHTML = items.length
    ? items.map((t) => `<li>${escapeHtml(t)}</li>`).join("")
    : `<li class="muted">${escapeHtml(emptyText)}</li>`;
}

function displayAnalyzerResults(result) {
  const results = $("#analyzerResults");
  const status = $("#analysisStatus");

  status.className = "analysis-status hidden";
  $("#analysisBody").classList.remove("hidden");
  results.classList.remove("hidden");

  const score = Math.max(0, Math.min(100, Number(result.score) || 0));

  $("#scoreVerdict").textContent = verdictFor(score);
  $("#analysisSummary").textContent = result.summary || "";

  fillList("#strengthsList", result.strengths || [], "Nothing highlighted.");
  fillList("#improvementsList", result.improvements || [], "No suggestions this time.");

  state.lastSpecs = result.specialties || [];
  $("#detectedSpecs").innerHTML = state.lastSpecs.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("");
  $("#matchRow").classList.toggle("hidden", state.lastSpecs.length === 0);

  renderScore(score);
  renderKeywords(result.keywords_found || [], result.keywords_to_add || []);

  if (canAnimate()) {
    anime({ targets: results, opacity: [0, 1], translateY: [16, 0], duration: 450, easing: "easeOutQuad" });
    anime({ targets: ".analysis-list li", opacity: [0, 1], translateX: [-12, 0], delay: anime.stagger(60, { start: 500 }), duration: 450, easing: "easeOutQuad" });
  }

  results.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
}

function renderScore(score) {
  const circle = $("#scoreFillCircle");
  const scoreEl = $("#scoreNumber");
  const circumference = 2 * Math.PI * 54;

  circle.style.strokeDasharray = circumference;
  circle.style.stroke = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  const setProgress = (v) => {
    scoreEl.textContent = Math.round(v);
    circle.style.strokeDashoffset = circumference - (v / 100) * circumference;
  };

  if (!canAnimate()) {
    setProgress(score);
    return;
  }

  setProgress(0);
  const obj = { val: 0 };
  anime({ targets: obj, val: score, duration: 1500, easing: "easeOutExpo", update: () => setProgress(obj.val) });
}

function renderKeywords(found, toAdd) {
  $("#matchedCount").textContent = found.length;
  $("#missingCount").textContent = toAdd.length;
  $("#matchedKeywords").innerHTML = found.map((k) => `<span class="keyword-tag matched">${escapeHtml(k)}</span>`).join("");
  $("#missingKeywords").innerHTML = toAdd.map((k) => `<span class="keyword-tag missing">${escapeHtml(k)}</span>`).join("");

  if (canAnimate() && found.length + toAdd.length) {
    anime({ targets: ".keyword-tag", opacity: [0, 1], scale: [0.5, 1], delay: anime.stagger(20, { start: 700 }), duration: 400, easing: "easeOutBack" });
  }
}

function useDetectedSpecialties() {
  state.specs = new Set(state.lastSpecs || []);
  $$(".chip").forEach((chip) => {
    const on = state.specs.has(chip.dataset.name);
    chip.classList.toggle("active", on);
    chip.setAttribute("aria-pressed", String(on));
  });
  updateClearButton();

  const allToggle = $('.view-toggle-btn[data-view="all"]');
  if (allToggle && !allToggle.classList.contains("active")) allToggle.click();

  $('[data-tab="companies"]').click();
  loadCompanies(true);
}

/* ---------- AI Assistant (chat) ---------- */
const chatState = { history: [] };

function initAssistant() {
  $("#chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chatInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    appendChatBubble("user", text);
    const historySnapshot = [...chatState.history];
    chatState.history.push({ role: "user", content: text });
    appendChatBubble("assistant", "…", true);

    try {
      const res = await apiJson("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historySnapshot }),
      });
      removeTypingBubble();
      appendChatBubble("assistant", res.reply);
      chatState.history.push({ role: "assistant", content: res.reply });
      if (res.companies && res.companies.length) renderChatCompanies(res.companies);
    } catch (err) {
      removeTypingBubble();
      appendChatBubble("assistant", "Sorry, something went wrong: " + err.message);
    }
  });
}

function appendChatBubble(role, text, typing = false) {
  const wrap = $("#chatMessages");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}` + (typing ? " typing" : "");
  bubble.textContent = text;
  if (typing) bubble.id = "typingBubble";
  wrap.appendChild(bubble);
  wrap.scrollTop = wrap.scrollHeight;

  if (!typing && canAnimate()) {
    anime({ targets: bubble, opacity: [0, 1], translateY: [8, 0], duration: 300, easing: "easeOutQuad" });
  }
}

function removeTypingBubble() {
  const el = document.getElementById("typingBubble");
  if (el) el.remove();
}

function renderChatCompanies(companies) {
  const normalized = companies.map(normalizeCompany);
  const wrap = $("#chatMessages");
  const row = document.createElement("div");
  row.className = "chat-companies";
  row.innerHTML = normalized
    .map(
      (c) => `
    <div class="chat-company-card" data-id="${c.id}">
      <strong>${escapeHtml(c.company_name)}</strong>
      <span class="muted small-note"><svg class="location-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg> ${escapeHtml(c.city || "Morocco")}</span>
      <div class="specialty-tags">${c.specialties.slice(0, 3).map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>
    </div>`
    )
    .join("");

  row.addEventListener("click", (e) => {
    const card = e.target.closest(".chat-company-card");
    if (!card) return;
    const company = normalized.find((c) => String(c.id) === card.dataset.id);
    if (company) openDetail(company, card);
  });

  wrap.appendChild(row);
  wrap.scrollTop = wrap.scrollHeight;

  if (canAnimate()) {
    anime({ targets: row, opacity: [0, 1], translateY: [10, 0], duration: 350, easing: "easeOutQuad" });
  }
}

/* ---------- Resume Studio ---------- */
function initResumeStudio() {
  restoreResumeForm();

  $("#resumeForm").addEventListener("submit", submitResumeForm);

  $$(".template-opt").forEach((btn) =>
    btn.addEventListener("click", () => {
      $$(".template-opt").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.resumeTemplate = btn.dataset.template;
      try { localStorage.setItem("techmap_resume_template", state.resumeTemplate); } catch { /* ignore */ }
      if (state.resumeData) renderResumePreview(state.resumeData, state.resumeTemplate);
    })
  );

  $("#printResumeBtn").addEventListener("click", () => window.print());
  $("#copyResumeBtn").addEventListener("click", async () => {
    if (!state.resumeData) return;
    try {
      await navigator.clipboard.writeText(resumeToPlainText(state.resumeData));
      showToast("Resume copied as text");
    } catch {
      showToast("Could not copy");
    }
  });

  try {
    const candidate = localStorage.getItem("techmap_resume_template");
    const savedTpl = ["classic", "modern", "bold", "editorial"].includes(candidate) ? candidate : "classic";
    state.resumeTemplate = savedTpl;
    $$(".template-opt").forEach((b) => b.classList.toggle("active", b.dataset.template === savedTpl));

    const savedResume = JSON.parse(localStorage.getItem("techmap_resume_data") || "null");
    if (savedResume) {
      state.resumeData = savedResume;
      renderResumePreview(savedResume, savedTpl);
      $("#resumePreviewWrap").classList.remove("hidden");
      $("#resumeEmptyState").classList.add("hidden");
    }
  } catch { /* ignore */ }
}

function resumeFormToPayload() {
  return {
    full_name: $("#rFullName").value.trim(),
    email: $("#rEmail").value.trim(),
    phone: $("#rPhone").value.trim(),
    city: $("#rCity").value.trim(),
    linkedin: $("#rLinkedin").value.trim(),
    github: $("#rGithub").value.trim(),
    portfolio: "",
    target_role: $("#rTargetRole").value.trim(),
    years_experience: $("#rYears").value.trim(),
    summary_hint: $("#rSummaryHint").value.trim(),
    education: $("#rEducation").value.trim(),
    experience: $("#rExperience").value.trim(),
    projects: $("#rProjects").value.trim(),
    skills: $("#rSkills").value.trim(),
    languages: $("#rLanguages").value.trim(),
    certifications: $("#rCerts").value.trim(),
  };
}

function restoreResumeForm() {
  try {
    const saved = JSON.parse(localStorage.getItem("techmap_resume_form") || "null");
    if (!saved) return;
    const map = {
      rFullName: "full_name", rEmail: "email", rPhone: "phone", rCity: "city",
      rLinkedin: "linkedin", rGithub: "github", rTargetRole: "target_role",
      rYears: "years_experience", rSummaryHint: "summary_hint", rEducation: "education",
      rExperience: "experience", rProjects: "projects", rSkills: "skills",
      rLanguages: "languages", rCerts: "certifications",
    };
    Object.entries(map).forEach(([id, key]) => {
      if (saved[key]) $(`#${id}`).value = saved[key];
    });
  } catch { /* ignore */ }
}

async function submitResumeForm(e) {
  e.preventDefault();
  const payload = resumeFormToPayload();
  if (!payload.full_name) {
    showToast("Full name is required.");
    return;
  }

  try { localStorage.setItem("techmap_resume_form", JSON.stringify(payload)); } catch { /* ignore */ }
  saveProfile({ ...loadProfile(), full_name: payload.full_name, email: payload.email, phone: payload.phone, target_role: payload.target_role });

  const btn = $("#generateResumeBtn");
  $("#previewDetailsBtn").disabled = true;
  btn.disabled = true;
  btn.classList.add("loading");
  $("#resumeStatus").className = "analysis-status working";
  $("#resumeStatus").textContent = "Writing and polishing your resume...";
  $("#resumeStatus").classList.remove("hidden");
  $("#resumePreviewWrap").classList.add("hidden");
  $("#resumeEmptyState").classList.add("hidden");

  try {
    const resume = await apiJson("/resume/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    window.setStudioOrigin?.("ai");
    state.resumeData = resume;
    try { localStorage.setItem("techmap_resume_data", JSON.stringify(resume)); } catch { /* ignore */ }
    $("#resumeStatus").classList.add("hidden");
    renderResumePreview(resume, state.resumeTemplate || "classic");
    $("#resumePreviewWrap").classList.remove("hidden");
  } catch (err) {
    $("#resumeStatus").className = "analysis-status error";
    $("#resumeStatus").textContent = err.message || "Could not generate the resume.";
    $("#resumeEmptyState").classList.toggle("hidden", !!state.resumeData);
    $("#resumePreviewWrap").classList.toggle("hidden", !state.resumeData);
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    $("#previewDetailsBtn").disabled = false;
  }
}

function renderResumePreview(resume, template) {
  const el = $("#resumePreview");
  el.className = "resume-preview";
  el.innerHTML = buildResumeHtml(resume, template);
  window.decorateResume?.(el);
  if (canAnimate()) {
    anime({ targets: el, opacity: [0, 1], translateY: [10, 0], duration: 400, easing: "easeOutQuad" });
  }
}

/* ---------- Resume document builders (4 real templates) ---------- */
function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function contactEntries(r) {
  const c = r.contact || {};
  const entries = [];
  if (c.email) entries.push({ icon: "✉", text: c.email });
  if (c.phone) entries.push({ icon: "☎", text: c.phone });
  if (c.city) entries.push({ icon: "📍", text: c.city });
  if (c.linkedin) entries.push({ icon: "🔗", text: c.linkedin });
  if (c.github) entries.push({ icon: "🔗", text: c.github });
  if (c.portfolio) entries.push({ icon: "🔗", text: c.portfolio });
  return entries;
}

function rdocExperienceHtml(r) {
  const items = r.experience || [];
  if (!items.length) return `<p class="rdoc-empty">No experience added yet.</p>`;
  return items.map((e) => `
    <div class="rdoc-entry">
      <div class="rdoc-entry-head">
        <h3>${escapeHtml(e.title)}</h3>
        <span class="rdoc-dates">${escapeHtml(e.dates)}</span>
      </div>
      ${e.company ? `<div class="rdoc-entry-sub">${escapeHtml(e.company)}</div>` : ""}
      ${(e.bullets || []).length ? `<ul class="rdoc-bullets">${e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}
    </div>`).join("");
}

function rdocEducationHtml(r) {
  const items = r.education || [];
  if (!items.length) return `<p class="rdoc-empty">No education added yet.</p>`;
  return items.map((ed) => `
    <div class="rdoc-entry">
      <div class="rdoc-entry-head">
        <h3>${escapeHtml(ed.degree)}</h3>
        <span class="rdoc-dates">${escapeHtml(ed.dates)}</span>
      </div>
      ${ed.school ? `<div class="rdoc-entry-sub">${escapeHtml(ed.school)}</div>` : ""}
    </div>`).join("");
}

function rdocProjectsHtml(r) {
  const items = r.projects || [];
  if (!items.length) return "";
  return items.map((p) => `
    <div class="rdoc-entry">
      <h3>${escapeHtml(p.name)}</h3>
      ${p.description ? `<ul class="rdoc-bullets"><li>${escapeHtml(p.description)}</li></ul>` : ""}
    </div>`).join("");
}

function rdocPillList(items) {
  return (items || []).map((s) => `<span class="rdoc-pill">${escapeHtml(s)}</span>`).join("");
}

function rdocInlineList(items) {
  return (items || []).map((s) => escapeHtml(s)).join('<span class="sep">·</span>');
}

function buildResumeHtml(r, template) {
  if (template === "editorial" && window.buildEditorialResume) return window.buildEditorialResume(r);
  if (template === "modern") return buildModernResume(r);
  if (template === "bold") return buildBoldResume(r);
  return buildClassicResume(r);
}

function buildClassicResume(r) {
  const contact = contactEntries(r).map((c) => `<span>${c.icon} ${escapeHtml(c.text)}</span>`).join("");
  const skills = rdocInlineList(r.skills);
  const languages = rdocInlineList(r.languages);
  const certs = rdocInlineList(r.certifications);
  const projects = rdocProjectsHtml(r);

  return `
    <div class="rdoc rdoc-classic">
      <header class="rdoc-header">
        <h1 class="rdoc-name">${escapeHtml(r.full_name)}</h1>
        ${r.title ? `<div class="rdoc-title">${escapeHtml(r.title)}</div>` : ""}
        <div class="rdoc-contact">${contact}</div>
      </header>
      <hr class="rdoc-rule" />

      ${r.summary ? `<section class="rdoc-section"><h2>Profile</h2><p class="rdoc-summary">${escapeHtml(r.summary)}</p></section>` : ""}

      <section class="rdoc-section">
        <h2>Experience</h2>
        ${rdocExperienceHtml(r)}
      </section>

      ${projects ? `<section class="rdoc-section"><h2>Projects</h2>${projects}</section>` : ""}

      <section class="rdoc-section">
        <h2>Education</h2>
        ${rdocEducationHtml(r)}
      </section>

      <section class="rdoc-section rdoc-cols">
        ${skills ? `<div><h2>Skills</h2><p class="rdoc-inline-list">${skills}</p></div>` : ""}
        ${languages || certs ? `<div>
          ${languages ? `<h2>Languages</h2><p class="rdoc-inline-list">${languages}</p>` : ""}
          ${certs ? `<h2 style="margin-top:14px;">Certifications</h2><p class="rdoc-inline-list">${certs}</p>` : ""}
        </div>` : ""}
      </section>
    </div>`;
}

function buildModernResume(r) {
  const initials = initialsOf(r.full_name);
  const contactList = contactEntries(r)
    .map((c) => `<span><span class="ico">${c.icon}</span>${escapeHtml(c.text)}</span>`)
    .join("");
  const skills = rdocPillList(r.skills);
  const languages = rdocPillList(r.languages);
  const certs = rdocPillList(r.certifications);
  const projects = rdocProjectsHtml(r);

  return `
    <div class="rdoc rdoc-modern">
      <aside class="rdoc-side">
        <div class="rdoc-avatar">${escapeHtml(initials)}</div>
        <div>
          <div class="rdoc-side-name">${escapeHtml(r.full_name)}</div>
          ${r.title ? `<div class="rdoc-side-title">${escapeHtml(r.title)}</div>` : ""}
        </div>
        <div>
          <h4>Contact</h4>
          <div class="rdoc-contact-list">${contactList}</div>
        </div>
        ${skills ? `<div><h4>Skills</h4><div class="rdoc-pill-list">${skills}</div></div>` : ""}
        ${languages ? `<div><h4>Languages</h4><div class="rdoc-pill-list">${languages}</div></div>` : ""}
        ${certs ? `<div><h4>Certifications</h4><div class="rdoc-pill-list">${certs}</div></div>` : ""}
      </aside>
      <div class="rdoc-main">
        <div class="rdoc-main-head">
          <div class="rdoc-main-name">${escapeHtml(r.full_name)}</div>
          ${r.title ? `<div class="rdoc-main-title">${escapeHtml(r.title)}</div>` : ""}
        </div>

        ${r.summary ? `<section class="rdoc-section"><h2>Profile</h2><p class="rdoc-summary">${escapeHtml(r.summary)}</p></section>` : ""}

        <section class="rdoc-section">
          <h2>Experience</h2>
          ${rdocExperienceHtml(r)}
        </section>

        ${projects ? `<section class="rdoc-section"><h2>Projects</h2>${projects}</section>` : ""}

        <section class="rdoc-section">
          <h2>Education</h2>
          ${rdocEducationHtml(r)}
        </section>
      </div>
    </div>`;
}

function buildBoldResume(r) {
  const initials = initialsOf(r.full_name);
  const contact = contactEntries(r).map((c) => `<span>${c.icon} ${escapeHtml(c.text)}</span>`).join("");
  const skills = rdocPillList(r.skills);
  const projects = rdocProjectsHtml(r);

  return `
    <div class="rdoc rdoc-bold">
      <div class="rdoc-banner">
        <div class="rdoc-avatar">${escapeHtml(initials)}</div>
        <div>
          <div class="rdoc-banner-name">${escapeHtml(r.full_name)}</div>
          ${r.title ? `<div class="rdoc-banner-title">${escapeHtml(r.title)}</div>` : ""}
          <div class="rdoc-contact">${contact}</div>
        </div>
      </div>
      <div class="rdoc-body">
        <div class="rdoc-main">
          ${r.summary ? `<section class="rdoc-section"><h2>Profile</h2><p class="rdoc-summary">${escapeHtml(r.summary)}</p></section>` : ""}
          <section class="rdoc-section">
            <h2>Experience</h2>
            <div class="rdoc-timeline">${rdocExperienceHtml(r)}</div>
          </section>
          ${projects ? `<section class="rdoc-section"><h2>Projects</h2>${projects}</section>` : ""}
        </div>
        <div class="rdoc-side">
          <h2>Education</h2>
          ${rdocEducationHtml(r)}
          ${skills ? `<h4>Skills</h4><div class="rdoc-pill-list">${skills}</div>` : ""}
          ${(r.languages || []).length ? `<h4>Languages</h4><p>${escapeHtml(r.languages.join(", "))}</p>` : ""}
          ${(r.certifications || []).length ? `<h4>Certifications</h4><p>${escapeHtml(r.certifications.join(", "))}</p>` : ""}
        </div>
      </div>
    </div>`;
}

function resumeToPlainText(r) {
  const lines = [];
  lines.push(r.full_name);
  if (r.title) lines.push(r.title);

  const contact = [r.contact.email, r.contact.phone, r.contact.city, r.contact.linkedin, r.contact.github, r.contact.portfolio].filter(Boolean);
  if (contact.length) lines.push(contact.join(" | "));
  lines.push("");

  if (r.summary) { lines.push("SUMMARY"); lines.push(r.summary); lines.push(""); }

  if ((r.experience || []).length) {
    lines.push("EXPERIENCE");
    r.experience.forEach((e) => {
      lines.push(`${e.title}${e.company ? " - " + e.company : ""}${e.dates ? " (" + e.dates + ")" : ""}`);
      (e.bullets || []).forEach((b) => lines.push(`  - ${b}`));
    });
    lines.push("");
  }

  if ((r.projects || []).length) {
    lines.push("PROJECTS");
    r.projects.forEach((p) => lines.push(`${p.name} - ${p.description}`));
    lines.push("");
  }

  if ((r.education || []).length) {
    lines.push("EDUCATION");
    r.education.forEach((ed) => lines.push(`${ed.degree}${ed.school ? " - " + ed.school : ""}${ed.dates ? " (" + ed.dates + ")" : ""}`));
    lines.push("");
  }

  if ((r.skills || []).length) lines.push(`SKILLS: ${r.skills.join(", ")}`);
  if ((r.languages || []).length) lines.push(`LANGUAGES: ${r.languages.join(", ")}`);
  if ((r.certifications || []).length) lines.push(`CERTIFICATIONS: ${r.certifications.join(", ")}`);

  return lines.join("\n");
}