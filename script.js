// script.js — SpinMatch Pro (full, clean, robust)
(() => {
  "use strict";

  const LS_KEYS = {
    FORM: "spinmatch_pro_form_v1",
    ONBOARDING_HIDE: "spinmatch_pro_onboarding_hide_v1",
  };

  // DOM
  const form           = document.getElementById("discoveryForm");
  const matchSummary   = document.getElementById("matchSummary");
  const toastContainer = document.getElementById("toastContainer");
  const progressBar    = document.getElementById("progressBar");

  // Buttons
  const newSessionBtn     = document.getElementById("newSessionBtn");
  const runRecBtn         = document.getElementById("runRecBtn");
  const surveySubmitBtn   = document.getElementById("surveySubmitBtn");
  const exportPDFBtn      = document.getElementById("exportPDF");
  const copyRecapBtn      = document.getElementById("copyRecap");
  const emailRecapBtn     = document.getElementById("emailRecap");
  const openPreventivoBtn = document.getElementById("openPreventivo");
  const helpBtn           = document.getElementById("helpBtn");

  // Lead status UI
  const leadPill  = document.getElementById("leadPill");
  const leadBadge = document.getElementById("leadBadge");

  // Sidebar & sections
  const stepLinks     = [...document.querySelectorAll(".step-link")];
  const stepFieldsets = [...document.querySelectorAll("fieldset.step")];
  const SCROLLER      = document.querySelector(".form-section");

  // Onboarding
  const onboardingOverlay = document.getElementById("onboardingOverlay");
  const onboardingNext    = document.getElementById("onboardingNext");
  const onboardingPrev    = document.getElementById("onboardingPrev");
  const onboardingClose   = document.getElementById("onboardingClose");
  const dontShowAgain     = document.getElementById("dontShowAgain");
  const onboardingDots    = [...document.querySelectorAll(".onboarding .dot")];
  let onboardingIndex = 0;

  // Charts
  let pieChart = null;
  let sparklineChart = null;
  let roiChart = null;

  const qs = (id) => document.getElementById(id);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const debounce = (fn, delay = 300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  };

  const toast = (msg = "Operazione completata", timeout = 1500) => {
    if (!toastContainer) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 250);
    }, timeout);
  };

  /* Onboarding */
  const shouldShowOnboarding = () => localStorage.getItem(LS_KEYS.ONBOARDING_HIDE) !== "1";
  const showOnboarding = () => { onboardingIndex = 0; updateOnboardingDots(); onboardingOverlay?.classList.remove("hidden"); };
  const hideOnboarding = () => { onboardingOverlay?.classList.add("hidden"); if (dontShowAgain?.checked) localStorage.setItem(LS_KEYS.ONBOARDING_HIDE, "1"); };
  const updateOnboardingDots = () => onboardingDots.forEach((d, i) => {
    d.classList.toggle("active", i === onboardingIndex);
    d.setAttribute("aria-selected", i === onboardingIndex ? "true" : "false");
  });

  /* Autosave */
  const doAutosave = debounce(() => {
    if (!form?.dataset.autosave) return;
    const data = Object.fromEntries(new FormData(form).entries());
    try { localStorage.setItem(LS_KEYS.FORM, JSON.stringify(data)); } catch {}
  }, 500);

  const restoreAutosave = () => {
    const raw = localStorage.getItem(LS_KEYS.FORM);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([k, v]) => {
        const el = form.querySelector(`[name="${CSS.escape(k)}"]`);
        if (el && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
          el.value = v;
        }
      });
      initAltroToggles(true);
      toast("Dati ripristinati");
    } catch {}
  };

  /* Scroll-spy + nav */
  function getRelativeTop(el, container) {
    const elRect = el.getBoundingClientRect();
    const cRect  = container.getBoundingClientRect();
    return elRect.top - cRect.top + container.scrollTop;
  }
  function initStepNavigation() {
    if (!SCROLLER) return;

    function setActiveLink(stepId, fromClick = false) {
      stepLinks.forEach(l => {
        const isActive = l.dataset.step === stepId;
        l.classList.toggle("active", isActive);
        l.setAttribute("aria-current", isActive ? "true" : "false");
        if (isActive && !fromClick) l.scrollIntoView({ block: "nearest" });
      });
    }
    function scrollToStep(stepId, pushHash = true) {
      const el = document.getElementById(`step-${stepId}`);
      if (!el) return;
      const y = getRelativeTop(el, SCROLLER) - 8;
      SCROLLER.scrollTo({ top: y, behavior: "smooth" });
      setActiveLink(stepId, true);
      if (pushHash) history.replaceState(null, "", `#step-${stepId}`);
    }
    stepLinks.forEach(btn => btn.addEventListener("click", (e) => { e.preventDefault(); scrollToStep(btn.dataset.step); }));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = e.target.id.split("-")[1];
          setActiveLink(id);
        }
      });
    }, { root: SCROLLER, rootMargin: "-10% 0px -70% 0px", threshold: 0.01 });
    stepFieldsets.forEach(fs => observer.observe(fs));

    if (location.hash?.startsWith("#step-")) {
      const initial = location.hash.replace("#step-", "");
      setTimeout(() => scrollToStep(initial, false), 80);
    } else setActiveLink("0");

    window.addEventListener("hashchange", () => {
      if (location.hash.startsWith("#step-")) {
        const h = location.hash.replace("#step-", "");
        scrollToStep(h, false);
      }
    });
  }

  /* "Altro" toggles */
  function toggleAltroForSelect(selectEl, silent = false) {
    const targetId = selectEl.getAttribute("data-altro-target");
    if (!targetId) return;
    const input = document.getElementById(targetId);
    const group = document.getElementById(`grp_${targetId}`);
    const isAltro = (selectEl.value || "").toLowerCase() === "altro";
    group?.classList.toggle("hidden", !isAltro);
    if (input) { input.disabled = !isAltro; if (!isAltro && !silent) input.value = ""; }
  }
  function initAltroToggles(silent = false) {
    const selects = form.querySelectorAll("select[data-altro-target]");
    selects.forEach(sel => {
      toggleAltroForSelect(sel, true);
      sel.addEventListener("change", () => toggleAltroForSelect(sel, silent));
    });
  }

  /* Step completion + progress */
  const MIN_FIELDS = {
    0: ["clinica_nome"],
    1: ["struttura_tipo", "n_medici"],
    2: [],
    3: ["obiettivo_6m"],
    4: ["problema_principale"],
    5: ["consapevolezza", "interesse", "budget", "timeline", "blocco"],
  };
  function stepCompleted(stepIndex) {
    const req = MIN_FIELDS[stepIndex] || [];
    return req.every(name => {
      const el = form.querySelector(`[name="${name}"]`);
      return !!el && !!(el.value || "").toString().trim();
    });
  }
  function updateProgressAndSidebar() {
    let completed = 0;
    Object.keys(MIN_FIELDS).forEach(k => { if (stepCompleted(+k)) completed++; });
    const total = Object.keys(MIN_FIELDS).length;
    const pct = Math.round((completed / total) * 100);
    if (progressBar) progressBar.style.width = pct + "%";

    stepLinks.forEach(btn => {
      const step = +btn.dataset.step;
      btn.classList.toggle("completed", stepCompleted(step));
    });
  }

  /* Profilo clinica + SmartMatch */
  function getClinicProfile() {
    const fd = new FormData(form);
    const getAlt = (sel, alt) => (fd.get(sel) === "altro" ? (fd.get(alt) || "").toString().trim() : (fd.get(sel) || "")).toString().trim();

    const struttura_tipo = getAlt("struttura_tipo","struttura_tipo_altro").toLowerCase();
    const gestionale     = getAlt("gestionale","gestionale_altro").toLowerCase();
    const canale         = getAlt("prenotazioni_canale","prenotazioni_canale_altro").toLowerCase();

    const n_medici = parseInt(fd.get("n_medici") || "0", 10) || 5;

    const areaCritica = getAlt("area_critica","area_critica_altro").toLowerCase();
    const obiettivo   = getAlt("obiettivo_6m","obiettivo_6m_altro").toLowerCase();

    return {
      nome: (fd.get("clinica_nome") || "").toString().trim(),
      citta: (fd.get("clinica_citta") || "").toString().trim(),
      struttura_tipo, n_medici, gestionale, canale, areaCritica, obiettivo,
      perdite: parseFloat(fd.get("perdite_stimate") || "0") || 0,
      ore: parseFloat(fd.get("tempo_compiti") || "0") || 0
    };
  }

  const defaultCatalog = [
    { nome: "Poliambulatorio Iris", contesto: "Poliambulatorio multi-specialistico, 12 medici",
      tag: { size: "m", canale: "sito web", focus: "prenotazioni", gestionale:"gipo" },
      leva: "Agenda integrata + reminder automatici", metrica: { label: "No-show", delta: "-28%" }, incremento: 18 },
    { nome: "Centro Medico Alfa", contesto: "Centro diagnostico, 24 medici",
      tag: { size: "l", canale: "telefono", focus: "processi", gestionale:"altro" },
      leva: "Workflow reception + prenotazioni online", metrica: { label: "Tempo front-office", delta: "-35%" }, incremento: 22 },
    { nome: "Studio Salute+", contesto: "Studio privato, 4 medici",
      tag: { size: "s", canale: "miodottore", focus: "visibilità", gestionale:"nessuno" },
      leva: "CRM smart + visibilità profili", metrica: { label: "Pazienti/mese", delta: "+27%" }, incremento: 20 },
    { nome: "Clinica Borgo", contesto: "Poliambulatorio specialistico, 15 medici",
      tag: { size: "m", canale: "telefono", focus: "prenotazioni", gestionale:"gipo" },
      leva: "Online booking + conferme SMS", metrica: { label: "Prenotazioni online", delta: "+32%" }, incremento: 24 },
    { nome: "CDT Emilia", contesto: "Diagnostica per immagini, 8 medici",
      tag: { size: "m", canale: "sito web", focus: "processi", gestionale:"altro" },
      leva: "Dashboard turni + auto-assegnazione slot", metrica: { label: "Slot riempiti", delta: "+21%" }, incremento: 16 },
    { nome: "Studio Viale", contesto: "Studio privato, 6 medici",
      tag: { size: "s", canale: "telefono", focus: "visibilità", gestionale:"nessuno" },
      leva: "Campagne locali + pagina servizi", metrica: { label: "Lead qualificati", delta: "+19%" }, incremento: 14 }
  ];

  async function loadCatalog() {
    try {
      const res = await fetch("./data/cases.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("no cases file");
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error("empty cases");
      return data;
    } catch {
      return defaultCatalog;
    }
  }

  function pickCaseStudies(profile, catalog) {
    const size = profile.n_medici >= 20 ? "l" : (profile.n_medici >= 7 ? "m" : "s");
    const canaleKey = profile.canale.includes("telefono") ? "telefono"
                    : profile.canale.includes("miodottore") ? "miodottore"
                    : profile.canale ? "sito web" : "";
    const gestKey = profile.gestionale.includes("gipo") ? "gipo"
                    : profile.gestionale.includes("nessuno") ? "nessuno"
                    : profile.gestionale ? "altro" : "";
    const focus = profile.obiettivo.includes("process") ? "processi"
                : (profile.obiettivo.includes("pazient") || profile.obiettivo.includes("visib")) ? "visibilità"
                : "prenotazioni";

    function score(item) {
      let s = 0;
      if (item.tag.size === size) s += 2;
      if (item.tag.canale === canaleKey) s += 2;
      if (item.tag.gestionale === gestKey) s += 1;
      if (item.tag.focus === focus) s += 2;
      return s;
    }

    const ranked = catalog.map(x => ({ ...x, _s: score(x) })).sort((a,b) => b._s - a._s);
    const out = [];
    const usedFocus = new Set();
    for (const item of ranked) {
      if (out.length === 3) break;
      if (!usedFocus.has(item.tag.focus) || out.length >= 2) {
        out.push(item);
        usedFocus.add(item.tag.focus);
      }
    }
    return out;
  }

  function generaRaccomandazione(catalog) {
    const profile = getClinicProfile();
    const cases = pickCaseStudies(profile, catalog);

    const inc = clamp(Math.round(
      (cases[0]?.incremento ?? 0) * 0.45 +
      (cases[1]?.incremento ?? 0) * 0.35 +
      (cases[2]?.incremento ?? 0) * 0.20
    ), 8, 35);

    const usaCRM = profile.gestionale.includes("gipo") || profile.gestionale.includes("crm");
    const soluzione = usaCRM
      ? "CRM + Visibilità online + Agenda integrata"
      : "Visibilità online + Agenda integrata";

    const pazientiPrima = Math.max(100, profile.n_medici * 90);
    const pazientiDopo  = Math.round(pazientiPrima * (1 + inc / 100));

    const beneficiBase = ["Riduzione telefonate manuali","Aumento prenotazioni online","Dashboard automatica"];
    const benefici = profile.obiettivo.includes("process")
      ? ["Riduzione tempi front-office", "Riduzione errori agenda", ...beneficiBase]
      : (profile.obiettivo.includes("visib") || profile.obiettivo.includes("pazient"))
      ? ["Più lead qualificati", "Miglior conversione", ...beneficiBase]
      : beneficiBase;

    const serieSparkline = [
      Math.round(pazientiPrima * 0.85),
      Math.round(pazientiPrima * 0.95),
      pazientiPrima,
      Math.round(pazientiDopo * 0.92),
      pazientiDopo
    ];

    const euroRecuperati = Math.round((profile.perdite || 2000) * (inc/100));
    const oreRisparmiate = Math.round((profile.ore || 1) * 22 * 0.4);

    return {
      soluzione, benefici,
      miglioramento: `+${inc}%`,
      incremento: inc,
      pazientiPrima, pazientiDopo, serieSparkline,
      cases,
      euroRecuperati, oreRisparmiate
    };
  }

  /* Render */
  function renderBenefitBadges(list) {
    const box = qs("benefitBadges");
    if (!box) return;
    box.innerHTML = list.map(b => `<span class="badge">✔ ${b}</span>`).join("");
  }
  function renderCaseStudies(cases) {
    const grid = qs("caseStudyGrid");
    if (!grid) return;
    grid.innerHTML = "";
    cases.forEach(cs => {
      const card = document.createElement("div");
      card.className = "result-item";
      card.innerHTML = `
        <div><strong>${cs.nome}</strong></div>
        <div>${cs.contesto}</div>
        <div>Leva principale: <em>${cs.leva}</em></div>
        <div>${cs.metrica.label}: <strong>${cs.metrica.delta}</strong></div>
      `;
      grid.appendChild(card);
    });
  }
  function renderCharts(out) {
    const pieCtx = qs("pieChart")?.getContext("2d");
    if (pieCtx) {
      if (pieChart) pieChart.destroy();
      pieChart = new Chart(pieCtx, {
        type: "pie",
        data: { labels: ["Perdite attuali", "Recuperato"],
          datasets: [{ data: [Math.max(0, 100 - out.incremento), out.incremento] }] },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
      });
    }
    const sparkCtx = qs("sparklineChart")?.getContext("2d");
    if (sparkCtx) {
      if (sparklineChart) sparklineChart.destroy();
      sparklineChart = new Chart(sparkCtx, {
        type: "line",
        data: { labels: ["T-2","T-1","Oggi","T+1","T+2"],
          datasets: [{ data: out.serieSparkline, fill: true, tension: 0.35, pointRadius: 0,
                       backgroundColor: 'rgba(14,165,164,0.12)' }] },
        options: { responsive: true, plugins: { legend: { display:false } },
                   scales:{ x:{ display:false }, y:{ display:false } },
                   elements:{ line:{ borderWidth:2 } } }
      });
    }
    const roiCtx = qs("roiChart")?.getContext("2d");
    if (roiCtx) {
      if (roiChart) roiChart.destroy();
      roiChart = new Chart(roiCtx, {
        type: "bar",
        data: { labels: ["€ recuperati/mese", "Ore risparmiate/mese"],
          datasets: [{ data: [out.euroRecuperati, out.oreRisparmiate] }] },
        options: { responsive: true, plugins: { legend: { display:false } } }
      });
    }
  }
  function showResults() {
    qs("emptyResults")?.setAttribute("hidden","");
    ["proposalCard","caseStudyCard","chartsWrap","nextSteps"].forEach(id => qs(id)?.removeAttribute("hidden"));
  }
  function applyRecommendation(out) {
    qs("outputRaccomandazione").textContent = out.soluzione;
    renderBenefitBadges(out.benefici);
    qs("outputCasoStudio").textContent = `${out.pazientiPrima} → ${out.pazientiDopo} pazienti/mese`;
    qs("outputMiglioramento").textContent = out.miglioramento;

    renderCaseStudies(out.cases);
    renderCharts(out);
    showResults();

    qs("proposalCard")?.classList.add("pulse");
    setTimeout(() => qs("proposalCard")?.classList.remove("pulse"), 600);
  }

  /* Survey → lead + next steps */
  function valutaSurvey() {
    const fd = new FormData(form);
    let score = 0;
    const map = {
      consapevolezza: { alta: 2, media: 1, bassa: 0 },
      interesse:      { alta: 2, media: 1, bassa: 0 },
      budget:         { si: 2, decidere: 1, no: 0 },
      timeline:       { "1m": 2, "3m": 1, oltre: 0 },
      blocco:         { pronto: 2, direzione: 1, roi: 1, altro: 0 }
    };
    Object.entries(map).forEach(([k, m]) => { score += m[fd.get(k)] ?? 0; });

    if (score >= 8) return { level: "hot",   label: "Lead caldo 🔥",  color: "var(--lead-hot)" };
    if (score >= 4) return { level: "warm",  label: "Lead tiepido 🌤️", color: "var(--lead-warm)" };
    return { level: "cold", label: "Lead freddo 🧊", color: "var(--lead-cold)" };
  }
  function nextStepsFor(level) {
    if (level === "hot") {
      return [
        "Ricapitola in 2 minuti i benefici concordati e invia un preventivo **firmabile subito**.",
        "Blocca una data d’avvio: *“Partiamo lunedì e non perdiamo le richieste della prossima settimana.”*",
        "Concorda i primi 3 KPI e chi prepara i materiali (loghi, indirizzi, servizi)."
      ];
    }
    if (level === "warm") {
      return [
        "Fai una **demo mirata** su 2–3 casi che li toccano da vicino (no generici).",
        "Porta una **mini-stima ROI**: un numero memorabile (es. *‘~+18% pazienti in 90 giorni’*).",
        "Coinvolgi il decisore: proponi un **pilot di 30 giorni** con obiettivo chiaro."
      ];
    }
    return [
      "Non forzare. Invia un contenuto **utile** (case study gemello o guida pratica) e chiedi feedback tra 2 settimane.",
      "Proponi un **micro-impegno**: audit di 15 minuti su agenda o no-show, senza parlare di prezzo.",
      "Resta presente: una nota LinkedIn o email breve con un consiglio pratico vale più di 3 follow-up standard."
    ];
  }
  function renderNextSteps(status) {
    const box = qs("nextStepsList"); if (!box) return;
    box.innerHTML = "";
    nextStepsFor(status.level).forEach(t => {
      const p = document.createElement("p"); p.innerHTML = `• ${t}`; box.appendChild(p);
    });
  }
  function applyLeadFeedback(status) {
    if (leadPill) {
      leadPill.textContent = `• ${status.label}`;
      leadPill.style.borderColor = status.color;
      leadPill.style.color = status.color;
      leadPill.setAttribute("aria-label", `Stato lead: ${status.label}`);
    }
    if (leadBadge) {
      leadBadge.textContent = status.label;
      leadBadge.style.background = "rgba(0,0,0,0.03)";
      leadBadge.style.borderColor = status.color;
      leadBadge.style.color = status.color;
    }
    matchSummary.querySelector(".survey-result")?.remove();
    const div = document.createElement("div");
    div.className = "survey-result";
    div.style.borderLeftColor = status.color;
    div.textContent = `Valutazione: ${status.label}`;
    matchSummary.appendChild(div);

    renderNextSteps(status);
    qs("nextSteps")?.removeAttribute("hidden");
  }

  /* PDF export */
  async function exportPDF() {
    try {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) return toast("Errore: jsPDF non caricato");

      const temp = document.createElement("div");
      temp.style.padding = "18px";
      temp.style.background = "#ffffff";
      temp.style.color = "#111827";
      temp.style.width = "980px";
      temp.style.fontFamily = "Inter, Arial, sans-serif";

      const headerClone = document.querySelector(".header")?.cloneNode(true);
      headerClone?.querySelectorAll("button")?.forEach(b => b.remove());
      if (headerClone) temp.appendChild(headerClone);

      const summary = document.createElement("div");
      summary.style.margin = "12px 0 8px";
      summary.innerHTML = `<h2 style="margin:6px 0 8px 0;font-size:18px">Riepilogo discovery</h2>`;
      const fd = new FormData(form);
      const getVal = (name, alt) => (fd.get(name) === "altro" ? (fd.get(alt) || "") : (fd.get(name) || ""));

      const rows = [
        ["Nome clinica", fd.get("clinica_nome")],
        ["Città", fd.get("clinica_citta")],
        ["Indirizzo", fd.get("clinica_indirizzo")],
        ["Telefono", fd.get("clinica_tel")],
        ["Referente", fd.get("referente_nome")],
        ["Ruolo", fd.get("referente_ruolo")],
        ["Mail", fd.get("referente_mail")],

        ["Tipo struttura", getVal("struttura_tipo","struttura_tipo_altro")],
        ["N. medici", fd.get("n_medici")],
        ["Gestionale", getVal("gestionale","gestionale_altro")],
        ["Canale prenotazioni", getVal("prenotazioni_canale","prenotazioni_canale_altro")],

        ["Tempo compiti (h/g)", fd.get("tempo_compiti")],
        ["Perdite stimate (€/mese)", fd.get("perdite_stimate")],
        ["Area critica", getVal("area_critica","area_critica_altro")],

        ["Obiettivo 6 mesi", getVal("obiettivo_6m","obiettivo_6m_altro")],
        ["Miglioramento più utile", getVal("miglioramento_top","miglioramento_top_altro")],

        ["Problema principale", getVal("problema_principale","problema_principale_altro")],
        ["Implicazioni", getVal("implicazioni","implicazioni_altro")],
        ["Situazione ideale", getVal("situazione_ideale","situazione_ideale_altro")],

        ["Note iniziali", fd.get("note_iniziali")]
      ].filter(r => r[1]);
      const table = document.createElement("table");
      table.style.width = "100%"; table.style.borderCollapse = "collapse"; table.style.fontSize = "12px";
      rows.forEach(([k,v]) => {
        const tr = document.createElement("tr");
        const th = document.createElement("th"); const td = document.createElement("td");
        th.textContent = k; td.textContent = v;
        th.style.textAlign="left"; th.style.width="35%"; th.style.padding="6px 8px";
        td.style.padding="6px 8px"; th.style.border = td.style.border = "1px solid #e5e7eb";
        tr.append(th,td); table.appendChild(tr);
      });
      summary.appendChild(table); temp.appendChild(summary);

      const resClone = matchSummary.cloneNode(true);
      temp.appendChild(resClone);

      document.body.appendChild(temp);
      const canvas = await html2canvas(temp, { scale: 2, backgroundColor: "#ffffff" });
      document.body.removeChild(temp);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW  = pageW - 40;
      const imgH  = (canvas.height * imgW) / canvas.width;

      if (imgH < pageH - 40) {
        pdf.addImage(imgData, "PNG", 20, 20, imgW, imgH, "", "FAST");
      } else {
        let sY = 0;
        const chunkH = (canvas.width * (pageH - 40)) / imgW;
        while (sY < canvas.height) {
          const pageCanvas = document.createElement("canvas");
          const ctx = pageCanvas.getContext("2d");
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(chunkH, canvas.height - sY);
          ctx.drawImage(canvas, 0, sY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
          const chunkData = pageCanvas.toDataURL("image/png");
          pdf.addImage(chunkData, "PNG", 20, 20, imgW, (pageCanvas.height * imgW) / canvas.width, "", "FAST");
          sY += pageCanvas.height;
          if (sY < canvas.height) pdf.addPage();
        }
      }
      const filename = `SpinMatchPro_${(new Date()).toISOString().slice(0,10)}.pdf`;
      pdf.save(filename);
      toast("PDF esportato");
    } catch (err) { console.error(err); toast("Impossibile esportare il PDF"); }
  }

  /* Recap */
  function buildRecapText() {
    const p = getClinicProfile();
    const status = document.querySelector(".survey-result")?.textContent || "Non valutato";
    const rec   = qs("outputRaccomandazione")?.textContent || "-";
    const mig   = qs("outputMiglioramento")?.textContent || "-";
    const cs    = qs("outputCasoStudio")?.textContent || "-";
    return [
      `Riepilogo SpinMatch Pro`,
      `Clinica: ${p.nome || "-"}`,
      `Città: ${p.citta || "-"}`,
      `Stato lead: ${status}`,
      `Proposta: ${rec}`,
      `Miglioramento stimato: ${mig}`,
      `Stima pazienti: ${cs}`
    ].join("\n");
  }
  async function copyRecap() {
    try { await navigator.clipboard.writeText(buildRecapText()); toast("Recap copiato"); }
    catch { toast("Impossibile copiare il recap"); }
  }
  function emailRecap() {
    const subject = encodeURIComponent("Riepilogo incontro — SpinMatch Pro");
    const body = encodeURIComponent(buildRecapText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  /* Reset */
  function resetSessione() {
    try { form?.reset(); localStorage.removeItem(LS_KEYS.FORM); } catch {}
    ["outputRaccomandazione","outputCasoStudio","outputMiglioramento","benefitBadges"]
      .forEach(id => { const el = qs(id); if (el) el.textContent = ""; });
    qs("caseStudyGrid")?.replaceChildren();

    if (pieChart) { pieChart.destroy(); pieChart = null; }
    if (sparklineChart) { sparklineChart.destroy(); sparklineChart = null; }
    if (roiChart) { roiChart.destroy(); roiChart = null; }

    if (leadPill)  { leadPill.textContent = "• Nessuna valutazione"; leadPill.removeAttribute("style"); }
    if (leadBadge) { leadBadge.textContent = "Nessuna valutazione";   leadBadge.removeAttribute("style"); }

    matchSummary.querySelector(".survey-result")?.remove();
    qs("nextStepsList")?.replaceChildren();
    ["proposalCard","caseStudyCard","chartsWrap","nextSteps"].forEach(id => qs(id)?.setAttribute("hidden",""));
    qs("emptyResults")?.removeAttribute("hidden");

    if (SCROLLER) SCROLLER.scrollTo({ top: 0, behavior: "smooth" });
    updateProgressAndSidebar();
    toast("Nuova sessione pronta");
  }

  /* Events */
  function bindEvents(catalog) {
    ["input","change"].forEach(ev => form?.addEventListener(ev, () => { doAutosave(); updateProgressAndSidebar(); }));

    initAltroToggles();
    updateProgressAndSidebar();

    newSessionBtn?.addEventListener("click", resetSessione);

    runRecBtn?.addEventListener("click", () => {
      const out = generaRaccomandazione(catalog);
      applyRecommendation(out);
      toast("Proposta generata");
    });

    surveySubmitBtn?.addEventListener("click", () => {
      const status = valutaSurvey();
      applyLeadFeedback(status);
      toast("Valutazione lead aggiornata");
    });

    exportPDFBtn?.addEventListener("click", exportPDF);
    copyRecapBtn?.addEventListener("click", copyRecap);
    emailRecapBtn?.addEventListener("click", emailRecap);

    openPreventivoBtn?.addEventListener("click", () => {
      toast("Apro il preventivo…");
    });

    helpBtn?.addEventListener("click", showOnboarding);
    onboardingClose?.addEventListener("click", hideOnboarding);
    onboardingNext?.addEventListener("click", () => { onboardingIndex = Math.min(4, onboardingIndex + 1); updateOnboardingDots(); });
    onboardingPrev?.addEventListener("click", () => { onboardingIndex = Math.max(0, onboardingIndex - 1); updateOnboardingDots(); });
    onboardingDots.forEach((dot, i) => dot.addEventListener("click", () => { onboardingIndex = i; updateOnboardingDots(); }));
  }

  /* Init */
  async function init() {
    restoreAutosave();
    initStepNavigation();
    const catalog = await loadCatalog();
    bindEvents(catalog);
    if (shouldShowOnboarding()) setTimeout(showOnboarding, 300);
    stepFieldsets.forEach(fs => fs.classList.add("fade-in"));
  }
  document.addEventListener("DOMContentLoaded", init);
})();