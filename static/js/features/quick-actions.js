(() => {
  const { t } = window.techmapLanguage;
  const el = (id) => document.getElementById(id);
  /* Local line icons for each action. */
  const actionIcon = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const ACTION_ICONS = {
    discover: actionIcon('<rect x="3" y="3" width="7.6" height="7.6" rx="2.2"/><rect x="13.4" y="3" width="7.6" height="7.6" rx="2.2"/><rect x="3" y="13.4" width="7.6" height="7.6" rx="2.2"/><rect x="13.4" y="13.4" width="7.6" height="7.6" rx="2.2"/>'),
    saved: actionIcon('<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.8z"/>'),
    insights: actionIcon('<path d="M3.5 20.5h17"/><path d="M6.5 20.5v-6.2M11.4 20.5V7.8M16.3 20.5v-9.1M21 20.5V4.5"/>'),
    studio: actionIcon('<path d="M7 2.8h6.4L19 8.4v12a1.4 1.4 0 0 1-1.4 1.4H7a1.4 1.4 0 0 1-1.4-1.4V4.2A1.4 1.4 0 0 1 7 2.8Z"/><path d="M13.2 2.9v5.6H19"/><path d="M9 13.4h6M9 17h3.6"/>'),
    analyzer: actionIcon('<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.4"/><path d="M12 1.6v2.4M12 20v2.4M1.6 12h2.4M20 12h2.4"/>'),
    assistant: actionIcon('<path d="M11.4 3.4 13 8.6l5.2 1.6-5.2 1.6-1.6 5.2-1.6-5.2L4.6 10.2l5.2-1.6z"/><path d="M18.6 3.4v3.2M17 5h3.2"/>'),
    help: actionIcon('<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.7v.3"/><path d="M12 17.2h.01"/>'),
    account: actionIcon('<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c1.2-3.4 3.8-5.2 7-5.2s5.8 1.8 7 5.2"/>'),
  };
  /* Searchable quick actions, with keyboard navigation and native dialog focus. */
  const nav = (tab) =>
    document.querySelector(`.nav-tabs [data-tab="${tab}"]`).click();
  const commands = [
    [
      "Discover companies",
      "Explore Morocco’s tech ecosystem",
      ACTION_ICONS.discover,
      () => nav("companies"),
    ],
    [
      "Saved companies",
      "Your shortlist in one place",
      ACTION_ICONS.saved,
      () => {
        nav("companies");
        document.querySelector('[data-view="favorites"]').click();
      },
    ],
    [
      "Company map",
      "Browse company pins by city across Morocco.",
      ACTION_ICONS.discover,
      () => nav("company-map"),
    ],
    [
      "Ecosystem insights",
      "Get to know the directory",
      ACTION_ICONS.insights,
      () => nav("dashboard"),
    ],
    [
      "Resume studio",
      "Four styles, an optional photo, and your story",
      ACTION_ICONS.studio,
      () => nav("resume"),
    ],
    [
      "Portfolio studio",
      "Build and publish your own portfolio website",
      ACTION_ICONS.studio,
      () => nav("portfolio"),
    ],
    [
      "Resume analyzer",
      "Review your resume with AI",
      ACTION_ICONS.analyzer,
      () => nav("analyzer"),
    ],
    [
      "Career assistant",
      "Talk through your next move with AI",
      ACTION_ICONS.assistant,
      () => nav("assistant"),
    ],
    [
      "Account & sign in",
      "Save your companies, notes and resume to your account",
      ACTION_ICONS.account,
      () => location.assign("/login.html"),
    ],
    [
      "Workspace help",
      "Find your way around TechMap",
      ACTION_ICONS.help,
      () => el("helpBtn").click(),
    ],
  ];
  let visible = commands,
    active = 0;
  function paintLauncher() {
    const input = el("launcherInput");
    const query = input.value.trim().toLowerCase();
    visible = commands.filter((c) =>
      [c[0], c[1], t(c[0]), t(c[1])].join(" ").toLowerCase().includes(query),
    );
    active = Math.max(0, Math.min(active, visible.length - 1));
    el("launcherResults").innerHTML =
      visible
        .map(
          (c, i) =>
            `<div role="option" id="command-${i}" data-command="${i}" aria-selected="${i === active}" class="launcher-option"><span aria-hidden="true">${c[2]}</span><div><strong>${t(c[0])}</strong><small>${t(c[1])}</small></div><span aria-hidden="true">↵</span></div>`,
        )
        .join("") ||
      `<p class="launcher-empty">${t("No actions found. Try “resume” or “companies”.")}</p>`;
    if (visible.length) {
      input.setAttribute("aria-activedescendant", `command-${active}`);
      el(`command-${active}`).scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }
  function openLauncher() {
    if (document.querySelector("dialog[open], .detail-overlay:not(.hidden)"))
      return;
    el("launcherInput").value = "";
    active = 0;
    el("launcherDialog").showModal();
    paintLauncher();
    el("launcherInput").focus();
  }
  function execute(index) {
    const command = visible[index];
    if (!command) return;
    el("launcherDialog").close();
    command[3]();
  }
  el("openLauncher").onclick = openLauncher;
  el("closeLauncher").onclick = () => el("launcherDialog").close();
  el("launcherInput").oninput = () => {
    active = 0;
    paintLauncher();
  };
  el("launcherInput").onkeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visible.length)
        active =
          (active + (event.key === "ArrowDown" ? 1 : -1) + visible.length) %
          visible.length;
      paintLauncher();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      execute(active);
    }
  };
  el("launcherResults").onclick = (event) => {
    const option = event.target.closest("[data-command]");
    if (option) execute(Number(option.dataset.command));
  };
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (el("launcherDialog").open) el("launcherDialog").close();
      else openLauncher();
    }
  });
})();