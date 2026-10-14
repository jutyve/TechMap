(() => {
  const colors = {
    forest: "#315c49",
    navy: "#294665",
    terracotta: "#974f3b",
    charcoal: "#3b3e43",
  };
  const descriptions = {
    classic: "Classic · A timeless, centered layout with understated detail.",
    modern:
      "Modern · A confident two-column layout with a dedicated skills sidebar.",
    bold: "Bold · A strong introduction with a colorful header and visual timeline.",
    editorial:
      "Editorial · Refined typography, generous spacing, and a clean reading order.",
  };
  let photo = "";
  let accent = "forest";
  let origin = "ai";
  let uploadVersion = 0;
  const el = (id) => document.getElementById(id);
  const validPhoto = (value) =>
    typeof value === "string" &&
    value.length < 800000 &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);
  try {
    const stored = localStorage.getItem("techmap_resume_photo");
    if (validPhoto(stored)) photo = stored;
    const savedAccent = localStorage.getItem("techmap_resume_accent");
    if (colors[savedAccent]) accent = savedAccent;
    origin =
      localStorage.getItem("techmap_resume_origin") === "local"
        ? "local"
        : "ai";
  } catch {}
  window.setStudioOrigin = (value) => {
    origin = value;
    try {
      localStorage.setItem("techmap_resume_origin", value);
    } catch {}
  };
  function savePhoto() {
    try {
      if (photo) localStorage.setItem("techmap_resume_photo", photo);
      else localStorage.removeItem("techmap_resume_photo");
      el("photoStatus").textContent = photo
        ? "Photo added. Saved in this browser only; never sent to AI."
        : "Photo removed. Your resume works beautifully without one.";
    } catch {
      el("photoStatus").textContent =
        "Updated for this session. Browser storage is full or unavailable; this change may not survive a reload.";
    }
  }
  function portraitImage(className) {
    const img = document.createElement("img");
    img.className = className;
    img.src = photo;
    img.alt = "Profile photo";
    img.width = 160;
    img.height = 160;
    return img;
  }
  function paintPhotoControl() {
    const box = el("portraitPreview");
    box.replaceChildren();
    if (photo) box.append(portraitImage("portrait-thumbnail"));
    else {
      const icon = document.createElement("span");
      icon.textContent = "◎";
      icon.setAttribute("aria-hidden", "true");
      box.append(icon);
    }
    el("removeResumePhoto").classList.toggle("hidden", !photo);
    document.querySelector(".portrait-upload").firstChild.textContent = photo
      ? "Change photo "
      : "Add a photo ";
  }
  window.decorateResume = (preview) => {
    const doc = preview.querySelector(".rdoc");
    if (!doc) return;
    doc.style.setProperty("--resume-accent", colors[accent]);
    if (!photo) return;
    const avatar = doc.querySelector(".rdoc-avatar");
    if (avatar) {
      avatar.replaceChildren(portraitImage("resume-portrait"));
      avatar.classList.add("has-photo");
    } else {
      const header = doc.querySelector(".rdoc-header, .editorial-header");
      if (header) {
        header.prepend(portraitImage("resume-portrait"));
        header.classList.add("with-photo");
      }
    }
  };
  function refreshPreview() {
    if (state.resumeData)
      renderResumePreview(state.resumeData, state.resumeTemplate);
  }
  el("resumePhotoInput").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const version = ++uploadVersion;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      el("photoStatus").textContent =
        "Choose a JPG, PNG, or WebP image up to 5 MB. Your current photo has not changed.";
      event.target.value = "";
      return;
    }
    el("photoStatus").textContent = "Preparing your photo…";
    let url;
    try {
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (version !== uploadVersion) return;
      if (
        !image.naturalWidth ||
        image.naturalWidth * image.naturalHeight > 25000000
      )
        throw Error(
          "Image dimensions are too large. Resize it to under 25 megapixels.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 512, 512);
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      context.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        512,
        512,
      );
      const processed = canvas.toDataURL("image/jpeg", 0.88);
      if (!validPhoto(processed))
        throw Error("Could not prepare this photo. Try a smaller image.");
      photo = processed;
      savePhoto();
      paintPhotoControl();
      refreshPreview();
    } catch (error) {
      if (version === uploadVersion)
        el("photoStatus").textContent = error.message.startsWith(
          "Image dimensions",
        )
          ? error.message
          : "This image could not be read. Try a different JPG, PNG, or WebP. Your current photo has not changed.";
    } finally {
      if (url) URL.revokeObjectURL(url);
      event.target.value = "";
    }
  };
  el("removeResumePhoto").onclick = () => {
    ++uploadVersion;
    photo = "";
    el("resumePhotoInput").value = "";
    savePhoto();
    paintPhotoControl();
    refreshPreview();
  };

  window.buildEditorialResume = (r) => {
    const section = (title, body) =>
      body
        ? `<section class="editorial-section"><h2>${title}</h2><div>${body}</div></section>`
        : "";
    const contact = contactEntries(r)
      .map((c) => `<span>${escapeHtml(c.text)}</span>`)
      .join("");
    return `<article class="rdoc rdoc-editorial"><header class="editorial-header"><div><div class="editorial-kicker">CURRICULUM VITAE</div><h1>${escapeHtml(r.full_name)}</h1>${r.title ? `<p class="editorial-title">${escapeHtml(r.title)}</p>` : ""}<div class="editorial-contact">${contact}</div></div></header>${section("Profile", r.summary ? `<p class="rdoc-summary">${escapeHtml(r.summary)}</p>` : "")}${section("Experience", (r.experience || []).length ? rdocExperienceHtml(r) : "")}${section("Projects", rdocProjectsHtml(r))}${section("Education", (r.education || []).length ? rdocEducationHtml(r) : "")}${section("Expertise", r.skills?.length ? `<p>${escapeHtml(r.skills.join(" · "))}</p>` : "")}${section("Languages", r.languages?.length ? `<p>${escapeHtml(r.languages.join(" · "))}</p>` : "")}${section("Certifications", r.certifications?.length ? `<p>${escapeHtml(r.certifications.join(" · "))}</p>` : "")}</article>`;
  };
  function localResume(p) {
    const lines = (v) =>
      v
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    const list = (v) =>
      v
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    // Preserve the user's own words; do not infer employers, dates, or credentials.
    return {
      full_name: p.full_name,
      title: p.target_role,
      contact: {
        email: p.email,
        phone: p.phone,
        city: p.city,
        linkedin: p.linkedin,
        github: p.github,
        portfolio: p.portfolio,
      },
      summary: p.summary_hint,
      experience: lines(p.experience).map((text) => ({
        title: text,
        company: "",
        dates: "",
        bullets: [],
      })),
      education: lines(p.education).map((text) => ({
        degree: text,
        school: "",
        dates: "",
      })),
      projects: lines(p.projects).map((text) => ({
        name: text,
        description: "",
      })),
      skills: list(p.skills),
      languages: list(p.languages),
      certifications: list(p.certifications),
    };
  }
  function persistForm() {
    const payload = resumeFormToPayload();
    try {
      localStorage.setItem("techmap_resume_form", JSON.stringify(payload));
      el("studioSaveStatus").textContent = "Details saved on this device";
    } catch {
      el("studioSaveStatus").textContent = "Session only · storage unavailable";
    }
    return payload;
  }
  function previewOwnDetails() {
    const payload = persistForm();
    if (!payload.full_name) {
      el("rFullName").focus();
      showToast("Start with your name to preview your resume.");
      return;
    }
    state.resumeData = localResume(payload);
    window.setStudioOrigin("local");
    try {
      localStorage.setItem(
        "techmap_resume_data",
        JSON.stringify(state.resumeData),
      );
    } catch {}
    el("resumeStatus").classList.add("hidden");
    el("resumeEmptyState").classList.add("hidden");
    el("resumePreviewWrap").classList.remove("hidden");
    renderResumePreview(state.resumeData, state.resumeTemplate);
  }
  el("previewDetailsBtn").onclick = previewOwnDetails;
  let timer;
  el("resumeForm").addEventListener("input", (event) => {
    if (event.target.type === "file") return;
    el("studioSaveStatus").textContent = "Saving your details…";
    clearTimeout(timer);
    timer = setTimeout(() => {
      const p = persistForm();
      if (
        origin === "local" &&
        state.resumeData &&
        p.full_name &&
        !el("generateResumeBtn").disabled
      )
        previewOwnDetails();
    }, 450);
  });
  // Flush text edits before leaving the page; photo data has its own bounded key.
  window.addEventListener("pagehide", () => {
    clearTimeout(timer);
    persistForm();
  });
  document.querySelectorAll("[data-resume-accent]").forEach((button) => {
    button.onclick = () => {
      accent = button.dataset.resumeAccent;
      try {
        localStorage.setItem("techmap_resume_accent", accent);
      } catch {}
      paintAccents();
      refreshPreview();
    };
  });
  function paintAccents() {
    document.querySelectorAll("[data-resume-accent]").forEach((b) => {
      const selected = b.dataset.resumeAccent === accent;
      b.classList.toggle("active", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
  }
  function paintTemplateDescription() {
    el("templateDescription").textContent =
      descriptions[state.resumeTemplate] || descriptions.classic;
    document
      .querySelectorAll("[data-template]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.template === state.resumeTemplate),
        ),
      );
  }
  // App listeners are registered at DOMContentLoaded; attach these after them.
  document.addEventListener("DOMContentLoaded", () => {
    paintPhotoControl();
    paintAccents();
    paintTemplateDescription();
    document
      .querySelectorAll("[data-template]")
      .forEach((b) => b.addEventListener("click", paintTemplateDescription));
    if (state.resumeData) refreshPreview();
  });

  // Preserve the selected design and photo in the Studio attachment used by Apply.
  window.studioStandaloneHtml = async () => {
    const styles = await Promise.all(
      ["style.css", "studio.css"].map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) throw Error("Could not load resume styles.");
        return response.text();
      }),
    );
    const doc = document.createElement("div");
    doc.innerHTML = buildResumeHtml(state.resumeData, state.resumeTemplate);
    decorateResume(doc);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(state.resumeData.full_name)} — Resume</title><style>${styles.join("\n")}body{background:#fff;color:#222;margin:0;font-family:Arial,sans-serif}#resumePreview{max-width:850px;margin:0 auto;border:0;box-shadow:none}@media print{body *{visibility:visible!important}#resumePreview{position:static;padding:0;width:auto}}</style></head><body><main id="resumePreview">${doc.innerHTML}</main></body></html>`;
  };

  /* Brief entrance and feedback motion; no perpetual moving UI. */
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const animate = (node, keyframes, options) => {
    if (node && !motion.matches && node.animate)
      node.animate(keyframes, options);
  };
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-tab]"))
      requestAnimationFrame(() =>
        animate(
          document.querySelector(".tab-panel.active"),
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 280, easing: "ease-out" },
        ),
      );
    if (event.target.closest("[data-template], [data-resume-accent]"))
      requestAnimationFrame(() =>
        animate(
          el("resumePreview"),
          [
            { opacity: 0.5, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 240, easing: "ease-out" },
        ),
      );
    const favorite = event.target.closest(".fav-btn");
    if (favorite)
      animate(
        favorite,
        [
          { transform: "scale(1)" },
          { transform: "scale(1.23)" },
          { transform: "scale(1)" },
        ],
        { duration: 260, easing: "ease-out" },
      );
  });
  const grid = el("companiesGrid");
  new MutationObserver((records) => {
    let n = 0;
    for (const record of records)
      for (const card of record.addedNodes)
        if (card.nodeType === 1 && n < 12) {
          animate(
            card,
            [
              { opacity: 0, transform: "translateY(12px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: 320,
              delay: n++ * 25,
              easing: "ease-out",
              fill: "backwards",
            },
          );
        }
  }).observe(grid, { childList: true });
  motion.addEventListener("change", () => {
    if (motion.matches)
      document.getAnimations().forEach((animation) => animation.cancel());
  });
})();