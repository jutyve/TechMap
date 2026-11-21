/* Certificates tab — a curated, big list of free & recognised courses
   that strengthen a portfolio or résumé. Purely client-side: the list is
   static data so no backend is required. Rendering uses anime.js (already
   shipped) for the staggered entrance, gated behind canAnimate(). */
(function () {
  "use strict";

  /* cost: "free-cert" = fully free including a certificate.
           "free-learn" = free to learn/audit; certificate via Coursera
           financial aid (still free to the learner, just an extra step). */
  const CERTIFICATES = [
    // ---- Google (Coursera) ----
    { title: "Google Data Analytics Professional Certificate", provider: "Google", short: "G", accent: "brand", category: "data", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/google-data-analytics", desc: "Learn spreadsheets, SQL, Tableau and R to analyse data and build a portfolio of case studies.", tags: ["SQL", "Tableau", "R", "Sheets"] },
    { title: "Google UX Design Professional Certificate", provider: "Google", short: "G", accent: "brand", category: "design", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/google-ux-design", desc: "End-to-end UX: research, wireframes, prototypes and a portfolio case study.", tags: ["Figma", "Research", "Prototyping"] },
    { title: "Google IT Support Professional Certificate", provider: "Google", short: "G", accent: "brand", category: "foundations", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/google-it-support", desc: "Foundational IT: troubleshooting, networking, operating systems, security and scripting.", tags: ["IT", "Networking", "Linux"] },
    { title: "Google Project Management Professional Certificate", provider: "Google", short: "G", accent: "brand", category: "business", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/google-project-management", desc: "Agile, Scrum and traditional project management with hands-on tools.", tags: ["Agile", "Scrum", "Asana"] },
    { title: "Google Cybersecurity Professional Certificate", provider: "Google", short: "G", accent: "brand", category: "security", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/google-cybersecurity", desc: "Defensive security, SIEM tooling, incident response and threat analysis.", tags: ["Security", "SIEM", "Python"] },
    { title: "Google Digital Marketing & E-commerce Certificate", provider: "Google", short: "G", accent: "brand", category: "business", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/google-digital-marketing-ecommerce", desc: "SEO, SEM, analytics, email and e-commerce store operations.", tags: ["SEO", "Analytics", "Ads"] },
    { title: "Google Advanced Data Analytics Certificate", provider: "Google", short: "G", accent: "brand", category: "data", level: "Intermediate", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/google-advanced-data-analytics", desc: "Statistics, Python and predictive modelling for deeper data analysis.", tags: ["Python", "Stats", "Modelling"] },
    { title: "Fundamentals of Digital Marketing", provider: "Google", short: "G", accent: "brand", category: "business", level: "Beginner", duration: "40 hours", cost: "free-cert", url: "https://learndigital.withgoogle.com/digitalgarage/course/digital-marketing", desc: "A free, accredited Google certificate covering the essentials of digital marketing.", tags: ["SEO", "Ads", "Analytics"] },

    // ---- IBM (Coursera) ----
    { title: "IBM Data Science Professional Certificate", provider: "IBM", short: "IBM", accent: "indigo", category: "data", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/ibm-data-science", desc: "Python, data visualisation, machine learning and an open-source capstone.", tags: ["Python", "ML", "Pandas"] },
    { title: "IBM AI Engineering Professional Certificate", provider: "IBM", short: "IBM", accent: "indigo", category: "data", level: "Intermediate", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/ai-engineer", desc: "Deep learning, ML pipelines and model deployment with PyTorch and TensorFlow.", tags: ["Deep Learning", "PyTorch", "APIs"] },
    { title: "IBM Full Stack Software Developer Certificate", provider: "IBM", short: "IBM", accent: "indigo", category: "web", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/ibm-full-stack-software-developer", desc: "Front-end and back-end with React, Node, containers and CI/CD.", tags: ["React", "Node", "Docker"] },
    { title: "IBM DevOps & Software Engineering Certificate", provider: "IBM", short: "IBM", accent: "indigo", category: "cloud", level: "Intermediate", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/devops-and-software-engineering", desc: "CI/CD, Cloud Foundry, Kubernetes and monitoring in practice.", tags: ["Kubernetes", "CI/CD", "Cloud"] },

    // ---- Meta (Coursera) ----
    { title: "Meta Front-End Developer Professional Certificate", provider: "Meta", short: "Meta", accent: "terracotta", category: "web", level: "Beginner", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/meta-front-end-developer", desc: "HTML, CSS, React and version control with a capstone project.", tags: ["HTML", "CSS", "React"] },
    { title: "Meta Back-End Developer Professional Certificate", provider: "Meta", short: "Meta", accent: "terracotta", category: "web", level: "Intermediate", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/meta-back-end-developer", desc: "Node, Express, MongoDB and building REST APIs.", tags: ["Node", "Express", "MongoDB"] },
    { title: "Meta iOS Developer Professional Certificate", provider: "Meta", short: "Meta", accent: "terracotta", category: "web", level: "Intermediate", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/meta-ios-developer", desc: "Swift and SwiftUI for building real iOS applications.", tags: ["Swift", "SwiftUI"] },
    { title: "Meta Android Developer Professional Certificate", provider: "Meta", short: "Meta", accent: "terracotta", category: "web", level: "Intermediate", duration: "3–6 months", cost: "free-learn", url: "https://www.coursera.org/professional-certificates/meta-android-developer", desc: "Kotlin and Jetpack Compose for modern Android apps.", tags: ["Kotlin", "Android"] },

    // ---- DeepLearning.AI ----
    { title: "AI For Everyone", provider: "DeepLearning.AI", short: "DL", accent: "brand", category: "data", level: "Beginner", duration: "6 hours", cost: "free-learn", url: "https://www.coursera.org/learn/ai-for-everyone", desc: "A non-technical introduction to AI strategy and workflow by Andrew Ng.", tags: ["AI", "Strategy"] },

    // ---- freeCodeCamp ----
    { title: "Responsive Web Design", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "web", level: "Beginner", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/2022/responsive-web-design/", desc: "Build sites with HTML, CSS, flexbox, grid and accessibility — with a free certificate.", tags: ["HTML", "CSS", "Accessibility"] },
    { title: "JavaScript Algorithms & Data Structures", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "web", level: "Beginner", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/", desc: "JavaScript fundamentals, algorithms, OOP and functional programming.", tags: ["JavaScript", "Algorithms"] },
    { title: "Front End Development Libraries", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "web", level: "Intermediate", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/front-end-development-libraries/", desc: "React, Redux, Bootstrap and jQuery through guided projects.", tags: ["React", "Redux"] },
    { title: "Back End Development & APIs", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "web", level: "Intermediate", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/back-end-development-and-apis/", desc: "Node, Express, MongoDB and building APIs.", tags: ["Node", "Express", "APIs"] },
    { title: "Data Visualization", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "data", level: "Intermediate", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/data-visualization/", desc: "Tell stories with data using D3.js and SVG dashboards.", tags: ["D3", "SVG"] },
    { title: "Machine Learning with Python", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "data", level: "Intermediate", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/machine-learning-with-python/", desc: "TensorFlow, neural networks and scikit-learn fundamentals.", tags: ["Python", "TensorFlow", "ML"] },
    { title: "Data Analysis with Python", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "data", level: "Intermediate", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/data-analysis-with-python/", desc: "NumPy, Pandas and reproducible data pipelines.", tags: ["Python", "Pandas", "NumPy"] },
    { title: "Information Security", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "security", level: "Intermediate", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/information-security/", desc: "Helmet.js, cryptography and secure development practices.", tags: ["Security", "Cryptography"] },
    { title: "Quality Assurance", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "web", level: "Intermediate", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/quality-assurance/", desc: "Testing with Chai, plus continuous integration basics.", tags: ["Testing", "Chai"] },
    { title: "Relational Databases", provider: "freeCodeCamp", short: "fCC", accent: "ok", category: "data", level: "Beginner", duration: "~300 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/relational-database/", desc: "PostgreSQL, Bash and Git through a hands-on project.", tags: ["SQL", "PostgreSQL", "Bash"] },
    { title: "Foundational C# with Microsoft", provider: "freeCodeCamp + Microsoft", short: "fCC", accent: "ok", category: "web", level: "Beginner", duration: "~35 hours", cost: "free-cert", url: "https://www.freecodecamp.org/learn/foundational-c-sharp-with-microsoft/", desc: "Learn C# fundamentals in partnership with Microsoft — free certificate.", tags: ["C#", ".NET"] },

    // ---- Harvard (CS50) ----
    { title: "CS50: Introduction to Computer Science", provider: "Harvard", short: "CS50", accent: "gold", category: "foundations", level: "Beginner", duration: "12 weeks", cost: "free-cert", url: "https://cs50.harvard.edu/x/", desc: "The famous intro to CS: C, algorithms, web and more, with a free Harvard certificate.", tags: ["C", "Algorithms", "CS"] },
    { title: "CS50: Web Programming with Python & JS", provider: "Harvard", short: "CS50", accent: "gold", category: "web", level: "Intermediate", duration: "12 weeks", cost: "free-cert", url: "https://cs50.harvard.edu/web/", desc: "Python, Django, JavaScript, SQL, MVC and scalability.", tags: ["Django", "JavaScript", "SQL"] },
    { title: "CS50: Introduction to Programming with Python", provider: "Harvard", short: "CS50", accent: "gold", category: "foundations", level: "Beginner", duration: "10 weeks", cost: "free-cert", url: "https://cs50.harvard.edu/python/", desc: "Start programming from zero with Python.", tags: ["Python"] },
    { title: "CS50: Introduction to Cybersecurity", provider: "Harvard", short: "CS50", accent: "gold", category: "security", level: "Intermediate", duration: "10 weeks", cost: "free-cert", url: "https://cs50.harvard.edu/cybersecurity/", desc: "The security mindset, networks and cryptography made approachable.", tags: ["Security", "Networks"] },

    // ---- University of Helsinki ----
    { title: "Full Stack Open", provider: "Univ. of Helsinki", short: "Helsinki", accent: "sage", category: "web", level: "Intermediate", duration: "~self-paced", cost: "free-cert", url: "https://fullstackopen.com/en/", desc: "Modern web: React, Node, MongoDB, GraphQL, TypeScript and CI/CD — with a free certificate.", tags: ["React", "Node", "GraphQL"] },
    { title: "DevOps with Kubernetes", provider: "Univ. of Helsinki", short: "Helsinki", accent: "sage", category: "cloud", level: "Intermediate", duration: "~self-paced", cost: "free-cert", url: "https://devopswithkubernetes.com/", desc: "Containers, Kubernetes and cloud-native workflows.", tags: ["Kubernetes", "Docker"] },
    { title: "Building AI (Elements of AI)", provider: "Univ. of Helsinki", short: "Elements", accent: "sage", category: "foundations", level: "Beginner", duration: "~30 hours", cost: "free-cert", url: "https://www.elementsofai.com/", desc: "A free, university-grade introduction to AI for everyone.", tags: ["AI"] },

    // ---- The Odin Project ----
    { title: "Full Stack JavaScript Path", provider: "The Odin Project", short: "Odin", accent: "brand", category: "web", level: "Beginner", duration: "~1000+ hours", cost: "free-cert", url: "https://www.theodinproject.com/paths/full-stack-javascript", desc: "A complete free curriculum: HTML, CSS, JS, Ruby, Rails and Node.", tags: ["HTML", "CSS", "Ruby", "Node"] },

    // ---- Cisco Networking Academy ----
    { title: "Introduction to Cybersecurity", provider: "Cisco NetAcad", short: "Cisco", accent: "indigo", category: "security", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://www.netacad.com/courses/cybersecurity/introduction-cybersecurity", desc: "A free Cisco course with certificate on cyber awareness and safety.", tags: ["Security", "Cisco"] },
    { title: "Python Essentials", provider: "Cisco NetAcad", short: "Cisco", accent: "indigo", category: "foundations", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://www.netacad.com/courses/programming/python-essentials-1", desc: "A free, certificate-bearing Python course from Cisco Networking Academy.", tags: ["Python"] },

    // ---- HubSpot Academy ----
    { title: "Inbound Marketing Certification", provider: "HubSpot Academy", short: "HubSpot", accent: "terracotta", category: "business", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://academy.hubspot.com/courses/inbound", desc: "A free, widely recognised inbound marketing certification.", tags: ["Inbound", "SEO"] },
    { title: "Content Marketing Certification", provider: "HubSpot Academy", short: "HubSpot", accent: "terracotta", category: "business", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://academy.hubspot.com/courses/content-marketing", desc: "Content strategy, storytelling and promotion.", tags: ["Content", "SEO"] },
    { title: "Social Media Marketing", provider: "HubSpot Academy", short: "HubSpot", accent: "terracotta", category: "business", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://academy.hubspot.com/courses/social-media", desc: "Social strategy, listening and paid social.", tags: ["Social", "Strategy"] },

    // ---- Cloud & platforms ----
    { title: "AWS Skill Builder — Cloud Practitioner", provider: "Amazon Web Services", short: "AWS", accent: "gold", category: "cloud", level: "Beginner", duration: "~self-paced", cost: "free-learn", url: "https://skillbuilder.aws/", desc: "Free AWS training covering the Cloud Practitioner fundamentals.", tags: ["AWS", "Cloud"] },
    { title: "Microsoft Learn — Azure Fundamentals (AZ-900)", provider: "Microsoft", short: "MS", accent: "indigo", category: "cloud", level: "Beginner", duration: "~self-paced", cost: "free-learn", url: "https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/", desc: "A free Microsoft Learn path; the exam has a paid-voucher route.", tags: ["Azure", "Cloud"] },
    { title: "Introduction to Kubernetes (LFS158)", provider: "Linux Foundation", short: "Linux", accent: "sage", category: "cloud", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://training.linuxfoundation.org/training/introduction-to-kubernetes/", desc: "A free introduction to Kubernetes from the Linux Foundation.", tags: ["Kubernetes", "Containers"] },
    { title: "Kaggle Learn Micro-courses", provider: "Kaggle", short: "Kaggle", accent: "ok", category: "data", level: "Beginner", duration: "~self-paced", cost: "free-learn", url: "https://www.kaggle.com/learn", desc: "Free, hands-on micro-courses: Python, Pandas, ML, SQL and deep learning.", tags: ["Python", "Pandas", "ML"] },
    { title: "Salesforce Trailhead — Admin Beginner", provider: "Salesforce", short: "SF", accent: "indigo", category: "cloud", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://trailhead.salesforce.com/en/content/learn/trails/administrator_beginner", desc: "Free Salesforce superbadges and structured learning.", tags: ["CRM", "Salesforce"] },
    { title: "Certified in Cybersecurity (CC)", provider: "ISC2", short: "ISC2", accent: "brand", category: "security", level: "Beginner", duration: "~self-paced", cost: "free-cert", url: "https://www.isc2.org/landing/1mcc", desc: "Free self-paced training and exam voucher via the 1M CC program — industry recognised.", tags: ["Security", "Cert"] },
  ];

  const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "web", label: "Web & Software" },
    { id: "data", label: "Data & AI" },
    { id: "cloud", label: "Cloud & DevOps" },
    { id: "security", label: "Cybersecurity" },
    { id: "design", label: "Design & UX" },
    { id: "business", label: "Marketing & Business" },
    { id: "foundations", label: "Foundations" },
  ];

  const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

  let built = false;
  let query = "";
  let category = "all";
  let freeOnly = false;

  function certSafeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value).trim());
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function cardHtml(c) {
    const href = certSafeUrl(c.url);
    const costFree = c.cost === "free-cert";
    const costBadge = costFree
      ? `<span class="cert-cost cert-cost--free"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>Free certificate</span>`
      : `<span class="cert-cost cert-cost--aid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 14.2 9l6.3 1.9-6.3 1.9L12 19.5 9.8 12.8 3.5 10.9 9.8 9z"/></svg>Free via financial aid</span>`;
    const tags = (c.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="cert-tag">${escapeHtml(t)}</span>`)
      .join("");
    const cta = href
      ? `<a class="cert-cta" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Start free <span aria-hidden="true">↗</span></a>`
      : "";
    return `<article class="cert-card" data-accent="${escapeHtml(c.accent)}">
      <div class="cert-top">
        <span class="cert-badge" aria-hidden="true">${escapeHtml(c.short)}</span>
        <span class="cert-provider">${escapeHtml(c.provider)}</span>
        ${costBadge}
      </div>
      <h3 class="cert-title">${escapeHtml(c.title)}</h3>
      <div class="cert-meta">
        <span class="cert-cat">${escapeHtml(CATEGORY_LABEL[c.category] || c.category)}</span>
        <span class="cert-dot">·</span><span>${escapeHtml(c.level)}</span>
        <span class="cert-dot">·</span><span>${escapeHtml(c.duration)}</span>
      </div>
      <p class="cert-desc">${escapeHtml(c.desc)}</p>
      <div class="cert-tags">${tags}</div>
      ${cta}
    </article>`;
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return CERTIFICATES.filter((c) => {
      if (freeOnly && c.cost !== "free-cert") return false;
      if (category !== "all" && c.category !== category) return false;
      if (!q) return true;
      const hay = (c.title + " " + c.provider + " " + (c.tags || []).join(" ") + " " + (CATEGORY_LABEL[c.category] || "")).toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const grid = $("#certGrid");
    const empty = $("#certEmpty");
    const status = $("#certStatus");
    if (!grid) return;

    const items = filtered();
    grid.innerHTML = items.map(cardHtml).join("");
    empty.classList.toggle("hidden", items.length !== 0);

    const total = CERTIFICATES.length;
    const freeCount = CERTIFICATES.filter((c) => c.cost === "free-cert").length;
    status.innerHTML = `<strong>${items.length}</strong> of ${total} certificates shown · <strong>${freeCount}</strong> include a free certificate`;

    const cards = $$(".cert-card", grid);
    if (window.canAnimate && window.canAnimate() && cards.length) {
      cards.forEach((el) => (el.style.opacity = "0"));
      anime({
        targets: cards,
        opacity: [0, 1],
        translateY: [18, 0],
        delay: anime.stagger(35),
        duration: 480,
        easing: "easeOutQuad",
      });
    }
  }

  function buildChips() {
    const wrap = $("#certChips");
    if (!wrap) return;
    wrap.innerHTML = CATEGORIES.map(
      (c) => `<button type="button" class="chip${c.id === category ? " active" : ""}" data-cat="${c.id}" role="tab" aria-selected="${c.id === category}">${escapeHtml(c.label)}</button>`
    ).join("");
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      category = btn.dataset.cat;
      $$(".chip", wrap).forEach((ch) => {
        const on = ch.dataset.cat === category;
        ch.classList.toggle("active", on);
        ch.setAttribute("aria-selected", String(on));
      });
      render();
    });
  }

  function buildControls() {
    const search = $("#certSearch");
    const toggle = $("#certFreeOnly");
    if (search) {
      search.addEventListener("input", () => {
        query = search.value;
        render();
      });
    }
    if (toggle) {
      toggle.addEventListener("change", () => {
        freeOnly = toggle.checked;
        render();
      });
    }
  }

  function loadCertificates() {
    if (!built) {
      buildChips();
      buildControls();
      built = true;
    }
    render();
  }

  window.loadCertificates = loadCertificates;
})();
