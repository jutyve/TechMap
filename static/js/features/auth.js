/* Account widget + workspace sync for the main app (index.html).
 *
 * Guests keep the original behaviour: everything lives in localStorage.
 * When a user is signed in, the whitelisted localStorage keys (favorites,
 * company notes, Resume Studio form/resume/photo/style, profile, theme,
 * layout) are mirrored to /api/me/state:
 *
 *  - On load the server copy is applied to localStorage (reloading once if
 *    anything changed, so every feature re-reads the synced values).
 *  - Guest work already in this browser is migrated into the account the
 *    first time its owner signs in here (favorites/notes are merged).
 *  - Afterwards, localStorage writes to those keys are uploaded, debounced.
 *  - If a *different* account signs in on this browser, the previous
 *    account's local copy is wiped first so accounts never leak into
 *    each other.
 */
(() => {
  const SYNC_KEYS = [
    "techmap_favorites",
    "techmap_company_notes",
    "techmap_profile",
    "techmap_resume_form",
    "techmap_resume_data",
    "techmap_resume_template",
    "techmap_resume_accent",
    "techmap_resume_origin",
    "techmap_resume_photo",
    "techmap_theme",
    "techmap_layout",
  ];
  const ACCOUNT_KEY = "techmap_account_id"; // local only, never synced

  /* Capture the native storage methods before patching, so the sync layer
     can read/write localStorage without triggering itself. */
  const proto = Storage.prototype;
  const nativeGet = proto.getItem;
  const nativeSet = proto.setItem;
  const nativeRemove = proto.removeItem;
  const rawGet = (key) => {
    try {
      return nativeGet.call(localStorage, key);
    } catch {
      return null;
    }
  };
  const rawSet = (key, value) => {
    try {
      nativeSet.call(localStorage, key, value);
    } catch {
      /* storage unavailable */
    }
  };
  const rawRemove = (key) => {
    try {
      nativeRemove.call(localStorage, key);
    } catch {
      /* ignore */
    }
  };

  let currentUser = null;
  let applyingServer = false;
  const pendingKeys = new Set();
  let flushTimer = null;

  const parseLocal = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return raw; // plain string values (theme, template, photo, ...)
    }
  };
  const serializeServer = (value) =>
    typeof value === "string" ? value : JSON.stringify(value);

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) {
      const error = new Error(`Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  /* --- Upload side: watch localStorage writes ---------------------------- */

  proto.setItem = function (key, value) {
    const result = nativeSet.call(this, key, value);
    if (this === localStorage) queueSync(key);
    return result;
  };
  proto.removeItem = function (key) {
    const result = nativeRemove.call(this, key);
    if (this === localStorage) queueSync(key);
    return result;
  };

  function queueSync(key) {
    if (!currentUser || applyingServer || !SYNC_KEYS.includes(key)) return;
    pendingKeys.add(key);
    setSyncStatus("busy", "Syncing…");
    clearTimeout(flushTimer);
    // The page is going away (e.g. Studio's pagehide flush): upload now
    // with keepalive instead of waiting for the debounce timer.
    if (document.visibilityState === "hidden") {
      flushSync(true);
    } else {
      flushTimer = setTimeout(() => flushSync(false), 600);
    }
  }

  async function flushSync(keepalive) {
    if (!currentUser || !pendingKeys.size) return;
    const values = {};
    for (const key of pendingKeys) {
      const raw = rawGet(key);
      values[key] = raw === null ? null : parseLocal(raw);
    }
    pendingKeys.clear();
    try {
      await api("/me/state", {
        method: "PUT",
        body: JSON.stringify({ values }),
        keepalive: Boolean(keepalive),
      });
      setSyncStatus("ok", "Synced to your account");
    } catch (error) {
      if (error.status === 401) {
        currentUser = null;
        paintWidget();
      } else {
        // Keep the local copy; the next change (or next sign-in sync)
        // will try uploading again.
        Object.keys(values).forEach((key) => pendingKeys.add(key));
        setSyncStatus("error", "Saved on this device — sync will retry");
      }
    }
  }
  window.addEventListener("pagehide", () => flushSync(true));

  /* --- Download side: apply the account's saved state --------------------- */

  function mergeFavorites(localRaw, serverValue) {
    const serverIds = Array.isArray(serverValue) ? serverValue : [];
    let localIds = [];
    try {
      localIds = JSON.parse(localRaw || "[]");
    } catch {
      /* ignore */
    }
    return [...new Set([...serverIds, ...localIds].map(Number).filter(Number.isFinite))];
  }

  function mergeNotes(localRaw, serverValue) {
    let localNotes = {};
    try {
      localNotes = JSON.parse(localRaw || "{}") || {};
    } catch {
      /* ignore */
    }
    const serverNotes =
      serverValue && typeof serverValue === "object" && !Array.isArray(serverValue)
        ? serverValue
        : {};
    return { ...localNotes, ...serverNotes };
  }

  async function syncFromServer(user) {
    let server = {};
    try {
      server = (await api("/me/state")).state || {};
    } catch {
      return false; // offline etc. — keep working from the local copy
    }

    const previousAccount = rawGet(ACCOUNT_KEY);
    const differentAccount =
      previousAccount !== null && previousAccount !== String(user.id);

    applyingServer = true;
    let changed = false;
    const uploads = {};
    try {
      if (differentAccount) {
        SYNC_KEYS.forEach((key) => rawRemove(key));
        changed = true;
      }
      for (const key of SYNC_KEYS) {
        const localRaw = rawGet(key);
        const hasServer = Object.prototype.hasOwnProperty.call(server, key);
        if (hasServer) {
          let merged = server[key];
          if (!differentAccount && localRaw !== null) {
            if (key === "techmap_favorites") merged = mergeFavorites(localRaw, merged);
            if (key === "techmap_company_notes") merged = mergeNotes(localRaw, merged);
          }
          const nextRaw = serializeServer(merged);
          if (nextRaw !== localRaw) {
            rawSet(key, nextRaw);
            changed = true;
          }
          if (JSON.stringify(merged) !== JSON.stringify(server[key])) {
            uploads[key] = merged; // local guest data merged in — save it back
          }
        } else if (localRaw !== null && !differentAccount) {
          uploads[key] = parseLocal(localRaw); // migrate guest work up
        }
      }
      rawSet(ACCOUNT_KEY, String(user.id));
    } finally {
      applyingServer = false;
    }

    if (Object.keys(uploads).length) {
      try {
        await api("/me/state", {
          method: "PUT",
          body: JSON.stringify({ values: uploads }),
        });
      } catch {
        /* will retry on the next change */
      }
    }
    return changed;
  }

  /* --- Account widget ------------------------------------------------------ */

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function initialsOf(name, email) {
    const parts = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "?";
  }

  function setSyncStatus(kind, text) {
    const el = document.getElementById("syncStatus");
    if (el) {
      el.innerHTML = `<span class="sync-dot${kind === "ok" ? "" : ` ${kind}`}"></span>${escapeHtml(text)}`;
    }
  }

  function paintWidget() {
    const widget = document.querySelector(".local-profile");
    const headerAvatar = document.getElementById("headerAvatar");
    if (!widget) return;

    if (!currentUser) {
      widget.innerHTML =
        `<a class="account-main" href="/login.html">` +
        `<span class="avatar" aria-hidden="true">?</span>` +
        `<span class="account-meta">Guest workspace<small>Saved on this device only</small></span></a>` +
        `<a class="account-cta" href="/login.html">Sign in</a>`;
      if (headerAvatar) {
        headerAvatar.textContent = "?";
        headerAvatar.title = "Sign in to save your workspace to your account";
      }
      return;
    }

    const initials = initialsOf(currentUser.name, currentUser.email);
    widget.innerHTML =
      `<a class="account-main" href="/login.html" title="Account settings">` +
      `<span class="avatar" aria-hidden="true">${escapeHtml(initials)}</span>` +
      `<span class="account-meta"><span class="account-name" title="${escapeHtml(currentUser.email)}">${escapeHtml(currentUser.name || currentUser.email)}</span>` +
      `<small id="syncStatus"><span class="sync-dot"></span>Synced to your account</small></span></a>` +
      `<button type="button" class="account-cta" id="signOutBtn">Sign out</button>`;
    if (headerAvatar) {
      headerAvatar.textContent = initials;
      headerAvatar.title = `${currentUser.name || currentUser.email} — account settings`;
    }
    document.getElementById("signOutBtn").addEventListener("click", signOut);
  }

  async function signOut() {
    const button = document.getElementById("signOutBtn");
    if (button) button.disabled = true;
    await flushSync(false);
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* session already gone */
    }
    currentUser = null;
    try {
      sessionStorage.removeItem("techmap_synced_reload");
    } catch {
      /* ignore */
    }
    paintWidget();
    window.showToast?.("Signed out. Your work stays available on this device.");
  }

  /* --- Boot ----------------------------------------------------------------- */

  function handleLandingParams() {
    const params = new URLSearchParams(location.search);
    const messages = {
      verified: "Email verified — welcome to TechMap! Your workspace now saves to your account.",
      signedin: "Signed in — your workspace now saves to your account.",
      reset: "Password updated — you're signed in.",
    };
    for (const [key, message] of Object.entries(messages)) {
      if (params.has(key)) {
        window.showToast?.(message);
        params.delete(key);
        const query = params.toString();
        history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
        break;
      }
    }
  }

  async function boot() {
    paintWidget(); // guest state first; upgraded below if signed in
    const headerAvatar = document.getElementById("headerAvatar");
    headerAvatar?.addEventListener("click", () => location.assign("/login.html"));

    let user = null;
    try {
      user = (await api("/auth/me")).user;
    } catch {
      return; // guest (or server unreachable) — local mode as before
    }
    currentUser = user;
    paintWidget();
    setSyncStatus("busy", "Syncing…");

    const changed = await syncFromServer(user);
    setSyncStatus("ok", "Synced to your account");
    handleLandingParams();

    if (changed) {
      // Features read their saved values once at startup; reload a single
      // time so favorites, resume, theme etc. reflect the account copy.
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem("techmap_synced_reload") === String(user.id);
        sessionStorage.setItem("techmap_synced_reload", String(user.id));
      } catch {
        /* ignore */
      }
      if (!alreadyReloaded) location.reload();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.techmapAuth = {
    user: () => currentUser,
    syncNow: () => flushSync(false),
  };
})();
