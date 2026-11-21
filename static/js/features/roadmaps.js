/* Roadmaps tab — a guided learning path per specialty. Students check off
   steps as they complete them; progress is saved in localStorage (same
   approach as the favorites feature). Purely client-side, no backend.
   Entrance + check animations use anime.js, gated by canAnimate(). */
(function () {
  "use strict";

  const ROADMAPS = [
    {
      id: "frontend",
      title: "Frontend Developer",
      blurb: "Build interfaces with HTML, CSS and JavaScript, then master a modern framework like React.",
      phases: [
        {
          name: "Foundations",
          steps: [
            { title: "Learn HTML & CSS", desc: "Structure pages and style them with modern CSS (flexbox, grid, responsive design).", type: "course", link: "https://www.freecodecamp.org/learn/2022/responsive-web-design/", linkLabel: "freeCodeCamp: Responsive Web Design" },
            { title: "JavaScript fundamentals", desc: "Variables, functions, arrays, objects and the DOM.", type: "course", link: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/", linkLabel: "freeCodeCamp: JavaScript Algorithms" },
            { title: "Git & GitHub", desc: "Track your work and push it to GitHub — every project needs this.", type: "practice" },
          ],
        },
        {
          name: "Core skills",
          steps: [
            { title: "Modern JavaScript (ES2020+)", desc: "Arrow functions, promises, async/await, modules.", type: "course" },
            { title: "Responsive & accessible UI", desc: "Make layouts work on every screen and for every user.", type: "practice" },
            { title: "A CSS framework", desc: "Learn Tailwind or Bootstrap to move faster.", type: "read" },
          ],
        },
        {
          name: "Frameworks",
          steps: [
            { title: "Learn React", desc: "Components, props, state and hooks.", type: "course", link: "https://www.freecodecamp.org/learn/front-end-development-libraries/", linkLabel: "freeCodeCamp: Front End Libraries" },
            { title: "Data fetching & state", desc: "Consume APIs and manage app state cleanly.", type: "course", link: "https://www.coursera.org/professional-certificates/meta-front-end-developer", linkLabel: "Meta Front-End Developer" },
            { title: "Build a React project", desc: "A todo app, weather app or clone of a favourite site.", type: "project" },
          ],
        },
        {
          name: "Portfolio & job",
          steps: [
            { title: "Google UX Design", desc: "Optional: learn to make interfaces usable and beautiful.", type: "cert", link: "https://www.coursera.org/professional-certificates/google-ux-design", linkLabel: "Google UX Design cert" },
            { title: "Ship 3 portfolio projects", desc: "Deploy them and write a short case study for each.", type: "project", tab: "portfolio", tabLabel: "Portfolio Studio" },
            { title: "Polish your resume & apply", desc: "Turn your projects into a clean résumé and start applying.", type: "practice", tab: "resume", tabLabel: "Resume Studio" },
          ],
        },
      ],
    },
    {
      id: "backend",
      title: "Backend Developer",
      blurb: "Serve data through APIs, work with databases, and keep systems secure and reliable.",
      phases: [
        {
          name: "Foundations",
          steps: [
            { title: "Pick a language", desc: "Python, JavaScript (Node) or Java — learn one well.", type: "course" },
            { title: "Git & GitHub", desc: "Version control is non-negotiable.", type: "practice" },
            { title: "HTTP & how the web works", desc: "Requests, responses, status codes, REST.", type: "read" },
          ],
        },
        {
          name: "Core",
          steps: [
            { title: "Build REST APIs", desc: "Routes, controllers and JSON responses.", type: "course", link: "https://www.coursera.org/professional-certificates/meta-back-end-developer", linkLabel: "Meta Back-End Developer" },
            { title: "Databases & SQL", desc: "Model data and write queries with PostgreSQL.", type: "course", link: "https://www.freecodecamp.org/learn/relational-database/", linkLabel: "freeCodeCamp: Relational Databases" },
            { title: "Authentication", desc: "Sessions, JWTs and password hashing.", type: "course" },
          ],
        },
        {
          name: "Deepen",
          steps: [
            { title: "Testing", desc: "Unit and integration tests with a framework like pytest or Jest.", type: "practice" },
            { title: "Caching & queues", desc: "Redis and background jobs for performance.", type: "read" },
            { title: "Web security basics", desc: "OWASP Top 10, input validation, CORS.", type: "read" },
          ],
        },
        {
          name: "Portfolio & job",
          steps: [
            { title: "Build & deploy an API", desc: "A real service with docs, deployed to the cloud.", type: "project", tab: "portfolio", tabLabel: "Portfolio Studio" },
            { title: "Google IT Support", desc: "Optional: understand the infra your code runs on.", type: "cert", link: "https://www.coursera.org/professional-certificates/google-it-support", linkLabel: "Google IT Support cert" },
            { title: "Apply with a strong résumé", desc: "Show your API project front and centre.", type: "practice", tab: "resume", tabLabel: "Resume Studio" },
          ],
        },
      ],
    },
    {
      id: "fullstack",
      title: "Full Stack Developer",
      blurb: "Go end-to-end: frontend, backend, database and deployment — own the whole product.",
      phases: [
        {
          name: "Foundations",
          steps: [
            { title: "HTML, CSS & JavaScript", desc: "The universal frontend base.", type: "course", link: "https://www.freecodecamp.org/learn/2022/responsive-web-design/", linkLabel: "freeCodeCamp: Responsive Web Design" },
            { title: "A backend language", desc: "Node, Python or Ruby.", type: "course" },
            { title: "Git & GitHub", desc: "Collaborate and ship.", type: "practice" },
          ],
        },
        {
          name: "Full stack path",
          steps: [
            { title: "The Odin Project", desc: "A complete free full-stack curriculum (Ruby + JS).", type: "course", link: "https://www.theodinproject.com/paths/full-stack-javascript", linkLabel: "The Odin Project" },
            { title: "CS50 Web Programming", desc: "Python, Django, JavaScript, SQL and scalability.", type: "cert", link: "https://cs50.harvard.edu/web/", linkLabel: "CS50 Web" },
            { title: "Databases & APIs", desc: "Connect a frontend to a real backend.", type: "project" },
          ],
        },
        {
          name: "Ship it",
          steps: [
            { title: "Full app project", desc: "Auth, database, UI — deployed and documented.", type: "project", tab: "portfolio", tabLabel: "Portfolio Studio" },
            { title: "IBM Full Stack cert", desc: "Optional, recognised credential.", type: "cert", link: "https://www.coursera.org/professional-certificates/ibm-full-stack-software-developer", linkLabel: "IBM Full Stack cert" },
            { title: "Apply", desc: "Full-stack roles value shipped products — lead with yours.", type: "practice", tab: "resume", tabLabel: "Resume Studio" },
          ],
        },
      ],
    },
    {
      id: "data",
      title: "Data & AI",
      blurb: "Turn raw data into insight and models — with Python, SQL and machine learning.",
      phases: [
        {
          name: "Foundations",
          steps: [
            { title: "Learn Python", desc: "The lingua franca of data work.", type: "course", link: "https://cs50.harvard.edu/python/", linkLabel: "CS50 Python" },
            { title: "Math & stats for ML", desc: "Linear algebra, probability, and descriptive stats.", type: "read" },
            { title: "Pandas & NumPy", desc: "Clean and analyse tabular data.", type: "course", link: "https://www.freecodecamp.org/learn/data-analysis-with-python/", linkLabel: "freeCodeCamp: Data Analysis" },
          ],
        },
        {
          name: "Core",
          steps: [
            { title: "SQL & databases", desc: "Query data where it lives.", type: "course", link: "https://www.freecodecamp.org/learn/relational-database/", linkLabel: "freeCodeCamp: Relational DB" },
            { title: "Data visualisation", desc: "Tell stories with charts and dashboards.", type: "course", link: "https://www.freecodecamp.org/learn/data-visualization/", linkLabel: "freeCodeCamp: Data Viz" },
            { title: "Machine learning", desc: "Scikit-learn, models, and evaluation.", type: "course", link: "https://www.freecodecamp.org/learn/machine-learning-with-python/", linkLabel: "freeCodeCamp: ML with Python" },
          ],
        },
        {
          name: "Credentials",
          steps: [
            { title: "Google Data Analytics", desc: "Recognised, portfolio-ready certificate.", type: "cert", link: "https://www.coursera.org/professional-certificates/google-data-analytics", linkLabel: "Google Data Analytics cert" },
            { title: "IBM Data Science", desc: "Broad, project-based credential.", type: "cert", link: "https://www.coursera.org/professional-certificates/ibm-data-science", linkLabel: "IBM Data Science cert" },
            { title: "Elements of AI", desc: "Free, university-grade AI intro.", type: "cert", link: "https://www.elementsofai.com/", linkLabel: "Elements of AI" },
          ],
        },
        {
          name: "Portfolio & job",
          steps: [
            { title: "Kaggle project", desc: "Analyse a public dataset end-to-end.", type: "project", link: "https://www.kaggle.com/learn", linkLabel: "Kaggle Learn" },
            { title: "Build a dashboard", desc: "Deploy an interactive dashboard.", type: "project", tab: "portfolio", tabLabel: "Portfolio Studio" },
            { title: "Apply", desc: "Data analyst / ML roles love shipped notebooks.", type: "practice", tab: "resume", tabLabel: "Resume Studio" },
          ],
        },
      ],
    },
    {
      id: "devops",
      title: "DevOps & Cloud",
      blurb: "Automate delivery: containers, CI/CD, cloud and infrastructure as code.",
      phases: [
        {
          name: "Foundations",
          steps: [
            { title: "Linux basics", desc: "Shell, permissions, processes, services.", type: "read" },
            { title: "Networking basics", desc: "DNS, ports, HTTP, firewalls.", type: "read" },
            { title: "Git & CI mindset", desc: "Small, frequent, automated changes.", type: "practice" },
          ],
        },
        {
          name: "Cloud & containers",
          steps: [
            { title: "AWS Cloud Practitioner", desc: "Core cloud concepts (free training).", type: "cert", link: "https://skillbuilder.aws/", linkLabel: "AWS Skill Builder" },
            { title: "Azure Fundamentals", desc: "Microsoft's cloud fundamentals path.", type: "cert", link: "https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/", linkLabel: "Microsoft Learn: AZ-900" },
            { title: "Docker & Kubernetes", desc: "Package and orchestrate apps.", type: "course", link: "https://training.linuxfoundation.org/training/introduction-to-kubernetes/", linkLabel: "Linux Foundation: Kubernetes" },
          ],
        },
        {
          name: "Automation",
          steps: [
            { title: "CI/CD pipelines", desc: "GitHub Actions or GitLab CI.", type: "practice" },
            { title: "Infrastructure as Code", desc: "Terraform to provision environments.", type: "read" },
            { title: "Observability", desc: "Logs, metrics and alerting.", type: "read" },
          ],
        },
        {
          name: "Portfolio & job",
          steps: [
            { title: "Deploy an app on K8s", desc: "From code to a running cluster.", type: "project", tab: "portfolio", tabLabel: "Portfolio Studio" },
            { title: "IBM DevOps cert", desc: "Optional, recognised credential.", type: "cert", link: "https://www.coursera.org/professional-certificates/devops-and-software-engineering", linkLabel: "IBM DevOps cert" },
            { title: "Apply", desc: "Show a pipeline you built, not just certs.", type: "practice", tab: "resume", tabLabel: "Resume Studio" },
          ],
        },
      ],
    },
    {
      id: "security",
      title: "Cybersecurity",
      blurb: "Defend systems and data — from secure coding to threat analysis.",
      phases: [
        {
          name: "Foundations",
          steps: [
            { title: "CS50 Cybersecurity", desc: "The security mindset, networks and crypto.", type: "cert", link: "https://cs50.harvard.edu/cybersecurity/", linkLabel: "CS50 Cybersecurity" },
            { title: "Linux & networking", desc: "Know the systems you're protecting.", type: "read" },
            { title: "How the web works", desc: "HTTP, cookies, sessions, CORS.", type: "read" },
          ],
        },
        {
          name: "Core",
          steps: [
            { title: "Security fundamentals", desc: "CIA triad, threats, hardening.", type: "course" },
            { title: "Hands-on practice", desc: "TryHackMe / Hack The Box labs.", type: "practice" },
            { title: "Secure coding", desc: "Input validation, auth, OWASP Top 10.", type: "course" },
          ],
        },
        {
          name: "Credentials",
          steps: [
            { title: "Google Cybersecurity", desc: "Broad, recognised entry cert.", type: "cert", link: "https://www.coursera.org/professional-certificates/google-cybersecurity", linkLabel: "Google Cybersecurity cert" },
            { title: "ISC2 Certified in Cybersecurity", desc: "Free training + exam voucher.", type: "cert", link: "https://www.isc2.org/landing/1mcc", linkLabel: "ISC2 CC" },
            { title: "Cisco Intro to Cybersecurity", desc: "Free Cisco course with certificate.", type: "cert", link: "https://www.netacad.com/courses/cybersecurity/introduction-cybersecurity", linkLabel: "Cisco NetAcad" },
          ],
        },
        {
          name: "Portfolio & job",
          steps: [
            { title: "Build a homelab", desc: "Practice defence on your own network.", type: "project" },
            { title: "Join CTFs", desc: "Capture-the-flag competitions build real skill.", type: "practice" },
            { title: "Apply", desc: "SOC analyst and junior roles value hands-on labs.", type: "practice", tab: "resume", tabLabel: "Resume Studio" },
          ],
        },
      ],
    },
    {
      id: "design",
      title: "UI/UX Design",
      blurb: "Design usable, beautiful products — research, wireframe, prototype and test.",
      phases: [
        {
          name: "Foundations",
          steps: [
            { title: "Design principles", desc: "Hierarchy, contrast, colour, spacing.", type: "read" },
            { title: "Learn Figma", desc: "The industry-standard design tool.", type: "course" },
            { title: "Visual basics", desc: "Typography and layout systems.", type: "practice" },
          ],
        },
        {
          name: "Core",
          steps: [
            { title: "Google UX Design", desc: "End-to-end UX with a portfolio case study.", type: "cert", link: "https://www.coursera.org/professional-certificates/google-ux-design", linkLabel: "Google UX Design cert" },
            { title: "Wireframing & prototyping", desc: "From sketches to clickable flows.", type: "course" },
            { title: "User research", desc: "Interviews, personas, usability testing.", type: "read" },
          ],
        },
        {
          name: "Portfolio & job",
          steps: [
            { title: "3 case studies", desc: "Show your process, not just pretty screens.", type: "project", tab: "portfolio", tabLabel: "Portfolio Studio" },
            { title: "Publish a portfolio site", desc: "Make it easy for recruiters to find you.", type: "project", tab: "portfolio", tabLabel: "Portfolio Studio" },
            { title: "Apply", desc: "Junior UX roles hire on portfolio strength.", type: "practice", tab: "resume", tabLabel: "Resume Studio" },
          ],
        },
      ],
    },
  ];

  const TYPE_META = {
    course:   { label: "Course",       cls: "course" },
    cert:     { label: "Certificate",  cls: "cert" },
    project:  { label: "Project",      cls: "project" },
    practice: { label: "Practice",     cls: "practice" },
    read:     { label: "Read",         cls: "read" },
  };

  // Per-phase path colours, echoing the reference quest map's vivid branches.
  const PHASE_COLORS = ["#e0a52e", "#2f9e7a", "#e8743b", "#7b5cc4", "#d6453d"];
  const ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

  const STORE_KEY = "techmap_roadmaps";
  let built = false;
  let activeId = ROADMAPS[0].id;
  let progress = loadProgress();

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch { /* ignore */ }
  }
  function doneSet(id) {
    if (!Array.isArray(progress[id])) progress[id] = [];
    return progress[id];
  }
  function isDone(id, sid) { return doneSet(id).includes(sid); }
  function toggleStep(id, sid) {
    const set = doneSet(id);
    const i = set.indexOf(sid);
    if (i >= 0) set.splice(i, 1); else set.push(sid);
    saveProgress();
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const stepId = (rm, pi, si) => `${rm.id}-${pi}-${si}`;

  function stepCard(rm, pi, si, step) {
    const sid = stepId(rm, pi, si);
    const done = isDone(rm.id, sid);
    const t = TYPE_META[step.type] || TYPE_META.read;
    let action = "";
    if (step.tab) {
      action = `<button type="button" class="rm-action" data-tablink="${escapeHtml(step.tab)}">Open ${escapeHtml(step.tabLabel || step.tab)} <span aria-hidden="true">↗</span></button>`;
    } else if (step.link) {
      action = `<a class="rm-action" href="${escapeHtml(step.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(step.linkLabel || "Open resource")} <span aria-hidden="true">↗</span></a>`;
    }
    return `<div class="rm-step${done ? " done" : ""}" data-id="${escapeHtml(sid)}">
      <button type="button" class="rm-check" aria-pressed="${done}" aria-label="Mark '${escapeHtml(step.title)}' as done"></button>
      <div class="rm-card">
        <div class="rm-card-top"><h4>${escapeHtml(step.title)}</h4><span class="rm-type rm-type--${t.cls}">${escapeHtml(t.label)}</span></div>
        <p>${escapeHtml(step.desc)}</p>
        ${action}
      </div>
    </div>`;
  }

  function updateProgress(rm) {
    let total = 0, done = 0;
    rm.phases.forEach((ph, pi) => ph.steps.forEach((s, si) => {
      total++; if (isDone(rm.id, stepId(rm, pi, si))) done++;
    }));
    const pct = total ? Math.round((done / total) * 100) : 0;
    const fill = $("#roadmapProgressFill");
    if (fill) fill.style.width = pct + "%";
    const label = $("#roadmapProgressLabel");
    if (label) label.textContent = `${done} of ${total} done · ${pct}%`;
  }

  function renderRoadmap() {
    const rm = ROADMAPS.find((r) => r.id === activeId);
    if (!rm) return;
    $("#roadmapTitle").textContent = rm.title;
    $("#roadmapBlurb").textContent = rm.blurb;

    const phases = $("#roadmapPhases");
    phases.classList.add("rm-roadmap");
    phases.innerHTML = rm.phases.map((ph, pi) => {
      const color = PHASE_COLORS[pi % PHASE_COLORS.length];
      const steps = ph.steps.map((s, si) => stepCard(rm, pi, si, s)).join("");
      return `<div class="rm-phase" style="--phase:${color}">
        <div class="rm-phase-head"><span class="rm-phase-num">${pi + 1}</span><h3>${escapeHtml(ph.name)}</h3></div>
        ${steps}
      </div>`;
    }).join("");

    updateProgress(rm);

    const steps = $$(".rm-step", phases);
    if (window.canAnimate && window.canAnimate() && steps.length) {
      steps.forEach((el) => (el.style.opacity = "0"));
      anime({ targets: steps, opacity: [0, 1], translateY: [12, 0], delay: anime.stagger(18), duration: 420, easing: "easeOutQuad" });
    }
  }

  function onPhaseClick(e) {
    const tabBtn = e.target.closest("[data-tablink]");
    if (tabBtn) {
      const target = document.querySelector(`[data-tab="${tabBtn.dataset.tablink}"]`);
      if (target) target.click();
      return;
    }
    const check = e.target.closest(".rm-check");
    if (!check) return;
    const step = check.closest(".rm-step");
    const sid = step.dataset.id;
    toggleStep(activeId, sid);
    const done = isDone(activeId, sid);
    step.classList.toggle("done", done);
    check.setAttribute("aria-pressed", String(done));
    if (window.canAnimate && window.canAnimate()) anime({ targets: check, scale: [0.82, 1], duration: 320, easing: "easeOutBack" });
    updateProgress(ROADMAPS.find((r) => r.id === activeId));
  }

  function buildChips() {
    const wrap = $("#roadmapChips");
    wrap.innerHTML = ROADMAPS.map((r) =>
      `<button type="button" class="chip${r.id === activeId ? " active" : ""}" data-rm="${r.id}" role="tab" aria-selected="${r.id === activeId}">${escapeHtml(r.title)}</button>`
    ).join("");
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rm]");
      if (!btn) return;
      activeId = btn.dataset.rm;
      $$(".chip", wrap).forEach((ch) => {
        const on = ch.dataset.rm === activeId;
        ch.classList.toggle("active", on);
        ch.setAttribute("aria-selected", String(on));
      });
      renderRoadmap();
    });

    const phases = $("#roadmapPhases");
    if (phases && !phases.dataset.wired) {
      phases.dataset.wired = "1";
      phases.addEventListener("click", onPhaseClick);
    }

    const reset = $("#roadmapReset");
    if (reset && !reset.dataset.wired) {
      reset.dataset.wired = "1";
      reset.addEventListener("click", () => {
        progress[activeId] = [];
        saveProgress();
        renderRoadmap();
      });
    }
  }

  function loadRoadmaps() {
    if (!built) {
      buildChips();
      built = true;
    }
    renderRoadmap();
  }

  window.loadRoadmaps = loadRoadmaps;
})();
