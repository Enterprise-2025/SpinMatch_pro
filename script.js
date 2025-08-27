// script.js — SpinMatch Pro (rigorous unlock • real case studies only • next-steps smart • full PDF)
(() => {
  "use strict";

  /* =========================
   *  Costanti, selettori, helper
   * ========================= */
  const LS_KEYS = {
    FORM: "spinmatch_pro_form_v2",
    ONBOARDING_HIDE: "spinmatch_pro_onboarding_hide_v1",
    SURVEY_UNLOCK: "spinmatch_pro_survey_unlock_v1", // NEW: persistenza sblocco Survey
  };

  const URLS = {
    PREVENTIVO: "https://enterprise-2025.github.io/Accesso-preventivatori/",
    BOOKING_FALLBACK: "https://calendar.google.com", // se non imposti data-url/BOOKING_URL
  };

  const PRESENTATION_VIEW_SECONDS = 10; // NEW: tempo minimo viewer aperto per sbloccare la Survey

  const qs  = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const debounce = (fn, ms = 300) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
  const includesAny = (s = "", arr = []) => arr.some((k) => s.includes(k));

  // Root
  const form           = qs("discoveryForm");
  const SCROLLER       = document.querySelector(".form-section");
  const progressBar    = qs("progressBar");
  const toastContainer = qs("toastContainer");
  const matchSummary   = qs("matchSummary");

  // Header / azioni
  const helpBtn           = qs("helpBtn");
  const newSessionBtn     = qs("newSessionBtn");
  const runRecBtn         = qs("runRecBtn");
  const surveySubmitBtn   = qs("surveySubmitBtn");
  const exportPDFBtn      = qs("exportPDF");
  const copyRecapBtn      = qs("copyRecap");
  const emailRecapBtn     = qs("emailRecap");
  const openPreventivoBtn = qs("openPreventivo");
  const bookMeetingBtn    = qs("bookMeeting");

  // Stato lead
  const leadPill  = qs("leadPill");
  const leadBadge = qs("leadBadge");

  // Navigazione step
  const stepLinks     = qsa(".step-link");
  const stepFieldsets = qsa("fieldset.step");
  const navStep5Btn   = document.querySelector('.step-link[data-step="5"]'); // NEW: riferimento link step 5
  const step5Fieldset = qs("step-5");                                       // NEW: fieldset step 5
  const navStep4Btn   = document.querySelector('.step-link[data-step="4"]');

  // Onboarding
  const onboardingOverlay = qs("onboardingOverlay");
  const onboardingNext    = qs("onboardingNext");
  const onboardingPrev    = qs("onboardingPrev");
  const onboardingClose   = qs("onboardingClose");
  const dontShowAgain     = qs("dontShowAgain");
  const onboardingDots    = qsa(".onboarding .dot");
  let onboardingIndex = 0;

  // Modal “Presenta soluzioni” + viewer
  const presentaBtn     = qs("presentaBtn");
  const presentaModal   = qs("presentaModal");
  const presentaClose   = qs("presentaClose");
  const presentaBack    = qs("presentaBack");
  const openGipoBtn     = qs("openGipo");
  const openMioBtn      = qs("openMio");
  const chooser         = qs("presentaChooser");
  const viewerWrap      = qs("docViewer");
  const frame           = qs("docFrame");
  const openInNew       = qs("presentaOpenInNew");
  const presentaTitleEl = qs("presentaTitle");
  let lastFocusEl = null;

  // Timer di sblocco rigoroso
  let surveyUnlockTimer = null;

  // Chart refs
  let pieChart = null, sparklineChart = null, roiChart = null;

  // Stato ultimo match (per next steps su misura)
  let lastRecommendation = null;

  /* =========================
   *  UI util
   * ========================= */
  const toast = (msg = "Operazione completata", t = 1600) => {
    if (!toastContainer) return;
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 220); }, t);
  };

  const openExternal = (url, label = "link") => {
    const href = (url || "").trim();
    if (!href) { toast(`Imposta l’URL (${label})`); return; }
    const win = window.open(href, "_blank", "noopener");
    if (!win) toast("Attiva i pop-up per aprire il link");
  };

  /* =========================
   *  Onboarding
   * ========================= */
  const shouldShowOnboarding = () => localStorage.getItem(LS_KEYS.ONBOARDING_HIDE) !== "1";
  const showOnboarding = () => { onboardingIndex = 0; updateOnboardingDots(); onboardingOverlay?.classList.remove("hidden"); };
  const hideOnboarding = () => { onboardingOverlay?.classList.add("hidden"); if (dontShowAgain?.checked) localStorage.setItem(LS_KEYS.ONBOARDING_HIDE, "1"); };
  const updateOnboardingDots = () => onboardingDots.forEach((d, i) => { d.classList.toggle("active", i === onboardingIndex); d.setAttribute("aria-selected", i === onboardingIndex ? "true" : "false"); });

  /* =========================
   *  Autosave form
   * ========================= */
  const doAutosave = debounce(() => {
    if (!form?.dataset.autosave) return;
    const data = Object.fromEntries(new FormData(form).entries());
    try { localStorage.setItem(LS_KEYS.FORM, JSON.stringify(data)); } catch {}
  }, 450);

  const restoreAutosave = () => {
    const raw = localStorage.getItem(LS_KEYS.FORM);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([k, v]) => {
        const el = form.querySelector(`[name="${CSS.escape(k)}"]`);
        if (el && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) el.value = v;
      });
      initAltroToggles(true);
      toast("Dati ripristinati");
    } catch {}
  };

  /* =========================
   *  Step navigation + progress
   * ========================= */
  function getRelativeTop(el, container) {
    const er = el.getBoundingClientRect(), cr = container.getBoundingClientRect();
    return er.top - cr.top + container.scrollTop;
  }

  function setActiveLink(stepId, fromClick = false) {
    stepLinks.forEach(l => {
      const isActive = l.dataset.step === stepId;
      l.classList.toggle("active", isActive);
      l.setAttribute("aria-current", isActive ? "true" : "false");
      if (isActive && !fromClick) l.scrollIntoView({ block: "nearest" });
    });
  }

  function scrollToStep(stepId, pushHash = true) {
    const el = qs(`step-${stepId}`);
    if (!el) return;
    const y = getRelativeTop(el, SCROLLER) - 8;
    SCROLLER.scrollTo({ top: y, behavior: "smooth" });
    setActiveLink(stepId, true);
    if (pushHash) history.replaceState(null, "", `#step-${stepId}`);
  }

  function initStepNavigation() {
    if (!SCROLLER) return;

    // Blocco navigazione verso step 5 se Survey bloccata
    if (navStep5Btn) {
      navStep5Btn.addEventListener("click", (e) => {
        if (!isSurveyUnlocked()) {
          e.preventDefault();
          toast("Prima presenta le soluzioni (Step 4), poi compila la Survey finale.");
          if (navStep4Btn) navStep4Btn.click(); else scrollToStep("4");
        }
      });
    }

    stepLinks.forEach(btn => btn.addEventListener("click", (e) => { e.preventDefault(); scrollToStep(btn.dataset.step); }));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { const id = e.target.id.split("-")[1]; setActiveLink(id); } });
    }, { root: SCROLLER, rootMargin: "-10% 0px -70% 0px", threshold: 0.01 });

    stepFieldsets.forEach(fs => observer.observe(fs));

    // Guard per hash diretto su #step-5 quando bloccato
    const enforceHashGuard = () => {
      if (location.hash === "#step-5" && !isSurveyUnlocked()) {
        toast("Completa la presentazione delle soluzioni per attivare la Survey finale.");
        history.replaceState(null, "", "#step-4");
        scrollToStep("4", false);
      }
    };

    if (location.hash?.startsWith("#step-")) {
      const initial = location.hash.replace("#step-", "");
      setTimeout(() => {
        if (initial === "5" && !isSurveyUnlocked()) enforceHashGuard();
        else scrollToStep(initial, false);
      }, 80);
    } else setActiveLink("0");

    window.addEventListener("hashchange", enforceHashGuard);
  }

  // “Altro” toggles (select → input)
  function toggleAltroForSelect(selectEl, silent = false) {
    const targetId = selectEl.getAttribute("data-altro-target");
    if (!targetId) return;
    const input = qs(targetId);
    const group = qs(`grp_${targetId}`);
    const isAltro = (selectEl.value || "").toLowerCase() === "altro";
    group?.classList.toggle("hidden", !isAltro);
    if (input) { input.disabled = !isAltro; if (!isAltro && !silent) input.value = ""; }
  }
  function initAltroToggles(silent = false) {
    qsa("select[data-altro-target]", form).forEach(sel => {
      toggleAltroForSelect(sel, true);
      sel.addEventListener("change", () => toggleAltroForSelect(sel, silent));
    });
  }

  // Requisiti step (per progress/flag)
  const MIN_FIELDS = {
    0: ["clinica_nome"],
    1: ["struttura_tipo", "n_medici"],
    2: [], // Step 2: “almeno uno” (vedi ANY_FIELDS)
    3: ["obiettivo_6m"],
    4: ["problema_principale"],
    5: ["consapevolezza", "interesse", "budget", "timeline", "blocco"],
  };
  const ANY_FIELDS = {
    2: ["tempo_compiti", "perdite_stimate", "area_critica", "area_critica_altro"],
  };

  function stepCompleted(stepIndex) {
    const reqAll = MIN_FIELDS[stepIndex] || [];
    const reqAny = ANY_FIELDS[stepIndex] || [];

    if (stepIndex === 5 && !isSurveyUnlocked()) return false; // NEW: finché bloccata, non può essere “completata”

    if (reqAll.length) {
      return reqAll.every(name => {
        const el = form.querySelector(`[name="${name}"]`);
        return !!el && !!(el.value || "").toString().trim();
      });
    }
    if (reqAny.length) {
      // Se “Altro” è selezionato, serve anche il testo
      const selectAltroPairs = [["area_critica", "area_critica_altro"]];
      const hasAny = reqAny.some(name => {
        const el = form.querySelector(`[name="${name}"]`);
        return !!el && !!(el.value || "").toString().trim();
      });
      const failsAltro = selectAltroPairs.some(([selName, altName]) => {
        const sel = form.querySelector(`[name="${selName}"]`);
        if (!sel) return false;
        if ((sel.value || "").toLowerCase() !== "altro") return false;
        const alt = form.querySelector(`[name="${altName}"]`);
        return !alt || !(alt.value || "").toString().trim();
      });
      return hasAny && !failsAltro;
    }
    return false;
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

  /* =========================
   *  Profilo & SmartMatch
   * ========================= */
  function getClinicProfile() {
    const fd = new FormData(form);
    const getAlt = (sel, alt) =>
      (fd.get(sel) === "altro" ? (fd.get(alt) || "").toString().trim() : (fd.get(sel) || "")).toString().trim();

    const struttura_tipo = getAlt("struttura_tipo", "struttura_tipo_altro").toLowerCase();
    const gestionale     = getAlt("gestionale", "gestionale_altro").toLowerCase();
    const canale         = getAlt("prenotazioni_canale", "prenotazioni_canale_altro").toLowerCase();
    const n_medici       = parseInt(fd.get("n_medici") || "0", 10) || 5;
    const areaCritica    = getAlt("area_critica", "area_critica_altro").toLowerCase();
    const obiettivo      = getAlt("obiettivo_6m", "obiettivo_6m_altro").toLowerCase();

    return {
      nome: (fd.get("clinica_nome") || "").toString().trim(),
      citta: (fd.get("clinica_citta") || "").toString().trim(),
      struttura_tipo, n_medici, gestionale, canale, areaCritica, obiettivo,
      perdite: parseFloat(fd.get("perdite_stimate") || "0") || 0,
      ore: parseFloat(fd.get("tempo_compiti") || "0") || 0,
    };
  }

  // === Catalogo: SOLO case study reali (niente fetch, niente fallback) ===
  const REAL_CASES = [
    {
      nome: "CDM111 (Roma)",
      contesto: "Poliambulatorio; focus visibilità + booking + reminder",
      tag: { size: "m", canale: "miodottore", focus: "visibilità", gestionale: "altro", prodotto: "mio" },
      leva: "Profilo ottimizzato, prenotazione online, reminder",
      metrica: { label: "Prenotazioni/anno", delta: "1.700" },
      incremento: 19,
      pdf: "./CDM111 ha gestito 1700 prenotazioni in un anno con MioDottore.pdf"
    },
    {
      nome: "Homedica (Merone)",
      contesto: "Centro medico; integrazione GipoNext + MioDottore",
      tag: { size: "m", canale: "sito web", focus: "visibilità", gestionale: "altro", prodotto: "combo" },
      leva: "Integrazione PMS + spinta domanda",
      metrica: { label: "Recensioni", delta: "+450" },
      incremento: 22,
      pdf: "./Gipo e MioDottore hanno assicurato visibilità e pazienti ad Homedica.pdf"
    },
    {
      nome: "Centro Medico Proxima (Milano)",
      contesto: "Poliambulatorio; integrazione GipoNext + MioDottore",
      tag: { size: "l", canale: "sito web", focus: "prenotazioni", gestionale: "altro", prodotto: "combo" },
      leva: "Online booking integrato + gestione agende",
      metrica: { label: "Prenotazioni online", delta: "≈4.500/anno (35% fuori orario)" },
      incremento: 24,
      pdf: "./Giponext e MioDottore_ Innovazione e Crescita al Centro Medico Proxima.pdf"
    },
    {
      nome: "Check Up Centre (Cavallino)",
      contesto: "Centro; focus MioDottore Phone + efficienza segreteria",
      tag: { size: "m", canale: "telefono", focus: "processi", gestionale: "altro", prodotto: "mio" },
      leva: "Phone + KPI risposta + flussi",
      metrica: { label: "No-show", delta: "≈1% • 1.400+ recensioni" },
      incremento: 16,
      pdf: "./MioDottore Phone facilita il lavoro di segreteria per Check Up Centre.pdf"
    }
  ];

  /* =========================
   *  Motore di MATCH esplicito
   * ========================= */
  function decideProduct(profile) {
    // Taglia
    const small  = profile.n_medici <= 6;
    const medium = profile.n_medici >= 7 && profile.n_medici <= 19;
    const large  = profile.n_medici >= 20;

    // Gestionale (neutro)
    const hasCRM   = profile.gestionale.includes("crm");
    const noGest   = profile.gestionale.includes("nessuno") || profile.gestionale === "";
    const hasOther = profile.gestionale.includes("altro");

    // Obiettivi / criticità / canali
    const wantsProc = includesAny(profile.obiettivo, ["process", "processi", "ottimizzare", "ridurre", "costi"]);
    const wantsAcq  = includesAny(profile.obiettivo, ["pazient", "visib", "acquis"]);

    const agendaIssue = includesAny(profile.areaCritica, ["agenda", "agende", "overbooking", "no-show", "noshow"]);
    const phoneIssue  = includesAny(profile.areaCritica, ["telefono", "telefonate", "chiamate"]);

    const chTel = profile.canale.includes("telefono");
    const chMio = profile.canale.includes("miodottore");
    const chWeb = profile.canale.includes("sito");

    const perditeHigh = profile.perdite >= 2000;
    const oreHigh     = profile.ore >= 1.5;

    // Punteggi
    let scoreGipo  = 0; // GipoNext (PMS)
    let scoreMio   = 0; // MioDottore (CRM+Visibilità)
    let scoreCombo = 0; // GipoNext + Visibilità

    // Size
    if (small)  { scoreMio += 2; scoreCombo += 1; }
    if (medium) { scoreGipo += 2; scoreCombo += 2; scoreMio += 1; }
    if (large)  { scoreCombo += 3; scoreGipo += 2; }

    // Gestionale neutro
    if (noGest)  { if (wantsProc) scoreGipo += 2; if (wantsAcq) scoreMio += 2; scoreCombo += 1; }
    if (hasCRM)  { scoreMio += 2; scoreCombo += 1; }
    if (hasOther){ if (wantsProc) scoreGipo += 1; scoreCombo += 1; }

    // Obiettivi
    if (wantsProc && wantsAcq) scoreCombo += 4;
    else if (wantsProc) { scoreGipo += 3; scoreCombo += 2; }
    else if (wantsAcq)  { scoreMio  += 3; scoreCombo += 2; }

    // Area critica
    if (agendaIssue || phoneIssue) { scoreGipo += 2; scoreCombo += 2; }
    if (includesAny(profile.areaCritica, ["visib", "pazient", "acquis"])) { scoreMio += 2; scoreCombo += 1; }

    // Canali
    if (chTel) { scoreGipo += 2; scoreCombo += 2; scoreMio += 1; }
    if (chMio) { scoreMio  += 2; }
    if (chWeb) { scoreCombo += 2; scoreGipo += 1; }

    // Impatto operativo/economico
    if (perditeHigh) { scoreGipo += 1; scoreCombo += 1; }
    if (oreHigh)     { scoreGipo += 1; scoreCombo += 1; }

    // Scelta finale
    const breakdown = { gipo: scoreGipo, mio: scoreMio, combo: scoreCombo };
    let key = "mio";
    if (scoreCombo >= scoreGipo && scoreCombo >= scoreMio) key = "combo";
    else if (scoreGipo >= scoreMio) key = "gipo";

    // Tie-breaker: medio/grande o segnali PMS forti → preferisci combo
    const strongPMS = (wantsProc ? 2 : 0) + (agendaIssue ? 1 : 0) + (phoneIssue ? 1 : 0) + (oreHigh ? 1 : 0) + (perditeHigh ? 1 : 0);
    if ((medium || large || strongPMS >= 3) && (scoreCombo === Math.max(scoreGipo, scoreMio, scoreCombo))) key = "combo";

    const labelMap = {
      gipo:  "GipoNext (PMS)",
      mio:   "MioDottore (CRM + Visibilità)",
      combo: "GipoNext + Visibilità",
    };

    const benefits = {
      gipo: [
        "Agenda integrata e turni",
        "Reminder automatici (riduce no-show)",
        "Workflow reception & meno telefonate",
        "Report e KPI operativi"
      ],
      mio: [
        "Maggiore visibilità online",
        "Prenotazione online semplice",
        "Recensioni e profili ottimizzati",
        "CRM e follow-up lead"
      ],
      combo: [
        "PMS solido + Booking online",
        "Riduzione telefonate e no-show",
        "Slot riempiti con visibilità",
        "KPI end-to-end (domanda → agenda)"
      ],
    };

    const reasons = [];
    if (wantsProc)   reasons.push("Obiettivo: ottimizzare processi/ridurre costi");
    if (wantsAcq)    reasons.push("Obiettivo: aumentare pazienti/visibilità");
    if (agendaIssue) reasons.push("Area critica: agende/overbooking/no-show");
    if (phoneIssue)  reasons.push("Area critica: troppe telefonate");
    if (chMio)       reasons.push("Canale attuale: MioDottore");
    if (chTel)       reasons.push("Canale attuale: telefono (spostare online)");
    if (chWeb)       reasons.push("Canale attuale: sito (integrare booking)");
    if (small)       reasons.push("Struttura piccola");
    if (medium)      reasons.push("Struttura media");
    if (large)       reasons.push("Struttura grande");
    if (perditeHigh) reasons.push("Perdite economiche elevate");
    if (oreHigh)     reasons.push("Molte ore su compiti manuali");

    return { key, label: labelMap[key], benefits: benefits[key], breakdown, reasons };
  }

  function pickCaseStudies(profile, catalog, productKey) {
    // 1) preferisci case dello stesso prodotto (se ce ne sono almeno 2)
    const preferred = catalog.filter(c => (c.tag?.prodotto || "").toLowerCase() === productKey);
    const pool = preferred.length >= 2 ? preferred : catalog;

    // 2) scoring per affinità (size, canale, gestionale, focus)
    const size = profile.n_medici >= 20 ? "l" : (profile.n_medici >= 7 ? "m" : "s");
    const canaleKey = profile.canale.includes("telefono") ? "telefono"
                    : profile.canale.includes("miodottore") ? "miodottore"
                    : profile.canale ? "sito web" : "";
    const gestKey = profile.gestionale.includes("nessuno") ? "nessuno"
                    : profile.gestionale ? "altro" : "";
    const focus = profile.obiettivo.includes("process") ? "processi"
                : (profile.obiettivo.includes("pazient") || profile.obiettivo.includes("visib")) ? "visibilità"
                : "prenotazioni";

    const score = (item) => (
      (item.tag?.size === size ? 2 : 0) +
      (item.tag?.canale === canaleKey ? 2 : 0) +
      (item.tag?.gestionale === gestKey ? 1 : 0) +
      (item.tag?.focus === focus ? 2 : 0) +
      (item.tag?.prodotto === productKey ? 2 : 0)
    );

    const ranked = pool.map(x => ({ ...x, _s: score(x) })).sort((a,b) => b._s - a._s);

    // 3) prendi max 3 cercando varietà di focus
    const out = []; const usedFocus = new Set();
    for (const item of ranked) {
      if (out.length === 3) break;
      if (!usedFocus.has(item.tag?.focus) || out.length >= 2) {
        out.push(item); usedFocus.add(item.tag?.focus);
      }
    }

    // 4) se mancassero slot, riempi dal catalogo globale (senza duplicati)
    if (out.length < 3) {
      const rest = catalog
        .filter(c => !out.some(o => o.nome === c.nome))
        .map(x => ({ ...x, _s: score(x) }))
        .sort((a,b) => b._s - a._s);
      for (const r of rest) { if (out.length === 3) break; out.push(r); }
    }
    return out;
  }

  function generaRaccomandazione() {
    const profile = getClinicProfile();
    const product = decideProduct(profile);
    const cases   = pickCaseStudies(profile, REAL_CASES, product.key);

    // Impatto stimato dalla media pesata dei case + clamp
    const inc = clamp(Math.round(
      (cases[0]?.incremento ?? 0) * 0.45 +
      (cases[1]?.incremento ?? 0) * 0.35 +
      (cases[2]?.incremento ?? 0) * 0.20
    ), 8, 35);

    const soluzione = product.label;

    // Stime e grafici
    const pazientiPrima = Math.max(100, profile.n_medici * 90);
    const pazientiDopo  = Math.round(pazientiPrima * (1 + inc / 100));
    const serieSparkline = [
      Math.round(pazientiPrima * 0.85),
      Math.round(pazientiPrima * 0.95),
      pazientiPrima,
      Math.round(pazientiDopo * 0.92),
      pazientiDopo
    ];
    const euroRecuperati = Math.round((profile.perdite || 2000) * (inc/100));
    const oreRisparmiate = Math.round((profile.ore || 1) * 22 * 0.4);

    const benefici = product.benefits?.length ? product.benefits : [
      "Riduzione telefonate manuali",
      "Aumento prenotazioni online",
      "Dashboard automatica"
    ];

    return {
      profilo: profile,
      prodotto: product,       // {key,label,benefits,breakdown,reasons}
      soluzione, benefici,
      miglioramento: `+${inc}%`,
      incremento: inc,
      pazientiPrima, pazientiDopo, serieSparkline,
      cases,
      euroRecuperati, oreRisparmiate
    };
  }

  /* =========================
   *  Render risultati
   * ========================= */
  function renderBenefitBadges(list) {
    const box = qs("benefitBadges"); if (!box) return;
    box.innerHTML = list.map(b => `<span class="badge">✔ ${b}</span>`).join("");
  }

  function renderCaseStudies(cases) {
    const grid = qs("caseStudyGrid"); if (!grid) return;
    grid.innerHTML = "";
    cases.forEach(cs => {
      const card = document.createElement("div");
      card.className = "result-item";
      card.dataset.pdf = cs.pdf || "";
      card.innerHTML = `
        <div><strong>${cs.nome}</strong></div>
        <div>${cs.contesto}</div>
        <div>Leva principale: <em>${cs.leva}</em></div>
        <div>${cs.metrica?.label || ""}: <strong>${cs.metrica?.delta || ""}</strong></div>
        ${cs.pdf ? `<div style="margin-top:4px;"><a class="btn-tertiary" href="#" data-open-pdf>Apri PDF</a></div>` : ""}
      `;
      grid.appendChild(card);
    });
  }

  function renderMatchWhy(reasons = []) {
    const box  = qs("matchWhy");
    const list = qs("matchWhyList");
    if (!box || !list) return;
    list.innerHTML = reasons.map(r => `<li>${r}</li>`).join("");
    box.removeAttribute("hidden");
  }

  function renderCharts(out) {
    const pieCtx = qs("pieChart")?.getContext("2d");
    if (pieCtx) {
      if (pieChart) pieChart.destroy();
      pieChart = new Chart(pieCtx, {
        type: "pie",
        data: { labels: ["Perdite attuali", "Recuperato"], datasets: [{ data: [Math.max(0, 100 - out.incremento), out.incremento] }] },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
      });
    }

    const sparkCtx = qs("sparklineChart")?.getContext("2d");
    if (sparkCtx) {
      if (sparklineChart) sparklineChart.destroy();
      sparklineChart = new Chart(sparkCtx, {
        type: "line",
        data: {
          labels: ["T-2","T-1","Oggi","T+1","T+2"],
          datasets: [{ data: out.serieSparkline, fill: true, tension: 0.35, pointRadius: 0, backgroundColor: "rgba(14,165,164,0.12)" }]
        },
        options: { responsive: true, plugins: { legend: { display:false } }, scales:{ x:{ display:false }, y:{ display:false } }, elements:{ line:{ borderWidth:2 } } }
      });
    }

    const roiCtx = qs("roiChart")?.getContext("2d");
    if (roiCtx) {
      if (roiChart) roiChart.destroy();
      roiChart = new Chart(roiCtx, {
        type: "bar",
        data: { labels: ["€ recuperati/mese", "Ore risparmiate/mese"], datasets: [{ data: [out.euroRecuperati, out.oreRisparmiate] }] },
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

    // NEW: memorizza match + mostra i motivi
    lastRecommendation = out;
    renderMatchWhy(out.prodotto?.reasons || []);

    const card = qs("proposalCard");
    card?.classList.add("pulse");
    setTimeout(() => card?.classList.remove("pulse"), 600);
  }

  /* =========================
   *  Survey → stato lead + next steps consulenziali
   * ========================= */
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

  function nextStepsFor(productKey, level, profile, survey) {
    const baseDiscovery = [
      "Conferma i numeri di partenza (pazienti/mese, no-show, telefonate) per misurare il before/after.",
      "Allinea gli stakeholder: direzione, segreteria, referenti IT/marketing.",
      "Definisci un obiettivo SMART a 90 giorni (1 metrica principale + 2 di supporto)."
    ];

    const tracks = {
      gipo: {
        hot: [
          "Pilot 30 giorni su 1 agenda: reminder e conferme attive dal giorno 1.",
          "Mappa flusso reception→agenda; standardizza script chiamate e regole slot.",
          "Micro-formazione 60’ + check settimanale 15’."
        ],
        warm: [
          "Demo operativa con dati reali (turni + reminder).",
          "Mini-ROI: ore/settimana risparmiate + € no-show evitati.",
          "Trial guidato 14 giorni su 1 agenda."
        ],
        cold: [
          "Micro-audit 15’ del flusso telefonate→prenotazione→promemoria.",
          "Checklist ‘Agenda perfetta’ pronta da applicare.",
          "Case study gemello focalizzato su no-show."
        ]
      },
      mio: {
        hot: [
          "Go-live profili + booking (servizi, regole slot, messaggi pre-visita).",
          "Attiva flusso recensioni post-visita e messaggi automatici.",
          "Se chiamate alte: abilita MioDottore Phone + KPI di risposta."
        ],
        warm: [
          "Demo del funnel reale (profilo e sito) fino alla prenotazione.",
          "Campagna ‘Sposta online’ (SMS/email) per ridurre le chiamate.",
          "Target 90 gg: +X% prenotazioni online, +Y recensioni, no-show ≤ Z%."
        ],
        cold: [
          "Guida ‘Profilo che converte’ + video 3’.",
          "3 micro-fix sulla pagina servizi del sito (titoli, CTA, orari).",
          "Test 14 giorni con KPI semplici (prenotazioni online, recensioni)."
        ]
      },
      combo: {
        hot: [
          "Roadmap 3 sprint (2 sett. cad.): 1) PMS+reminder; 2) Booking integrato+sposta online; 3) Recensioni/adv.",
          "Stand-up settimanale 15’ con direzione e champion.",
          "KPI per reparto: % online, no-show, saturazione slot."
        ],
        warm: [
          "Workshop 45’ ‘Journey paziente’ (domanda→prenotazione→visita→review).",
          "Pilot misto 1 reparto: agenda integrata + profilo ottimizzato.",
          "Baseline condivisa: telefonate/g, % online, no-show, saturazione."
        ],
        cold: [
          "Assessment rapido: checklist tecnica PMS + checklist marketing.",
          "2 case study (uno PMS, uno visibilità) stessa taglia.",
          "Pre-pilot 10 giorni con reminder + recensioni (zero migrazioni)."
        ]
      }
    };

    const lane = tracks[productKey] || tracks.combo;
    const list = (lane[level] || lane.warm);

    // ------ Add-on dinamici in base al BLOCCO e al BUDGET ------
    const addons = [];
    const blocco = (survey?.blocco || "").toLowerCase();
    const bloccoAlt = (survey?.blocco_altro || "").trim();
    const budget = (survey?.budget || "").toLowerCase();

    if (blocco === "direzione") {
      addons.push(
        "Add-on: One-Pager decisionale (problema→impatto→soluzione, timeline, owner, rischi/mitigazioni, 3 KPI).",
        "Add-on: Piano stepwise (Pilot→Rollout) con milestone di uscita se l’impatto non c’è."
      );
    } else if (blocco === "roi") {
      addons.push(
        "Add-on: Baseline numerica (no-show, chiamate, ore) + simulazione ROI semplice (€ no-show evitati + costo orario risparmiato).",
        "Add-on: Obiettivo 90 giorni firmato (1 metrica principale, 2 di supporto)."
      );
    } else if (blocco === "pronto") {
      addons.push(
        "Add-on: Kick-off calendarizzato (owner, checklist go-live, tempi).",
        "Add-on: Stand-up settimanale 15’ con report KPI mini."
      );
    } else if (blocco === "altro") {
      addons.push(
        bloccoAlt
          ? `Add-on: Nota blocco — “${bloccoAlt}”. Definisci azione puntuale per sbloccarlo.`
          : "Add-on: Chiarire il blocco con 3 domande guida (cosa frena, chi decide, quale evidenza serve)."
      );
    }

    if (budget === "no" || budget === "decidere") {
      addons.push(
        "Add-on: Opzione scalare (Entry: Pilot, Standard: Rollout 1–2 reparti, Full: struttura intera) con costi e payback stimato."
      );
    }

    return [...baseDiscovery, ...list, ...addons];
  }

  function renderNextSteps(status, productKey, profile, survey) {
    const box = qs("nextStepsList"); if (!box) return;
    box.innerHTML = "";
    nextStepsFor(productKey, status.level, profile, survey).forEach(t => {
      const p = document.createElement("p"); p.innerHTML = `• ${t}`; box.appendChild(p);
    });
  }

  function applyLeadFeedback(status) {
    if (leadPill)  { leadPill.textContent = `• ${status.label}`; leadPill.style.borderColor = status.color; leadPill.style.color = status.color; leadPill.setAttribute("aria-label", `Stato lead: ${status.label}`); }
    if (leadBadge) { leadBadge.textContent = status.label;        leadBadge.style.background = "rgba(0,0,0,0.03)"; leadBadge.style.borderColor = status.color; leadBadge.style.color = status.color; }

    matchSummary.querySelector(".survey-result")?.remove();
    const div = document.createElement("div");
    div.className = "survey-result"; div.style.borderLeftColor = status.color; div.textContent = `Valutazione: ${status.label}`;
    matchSummary.appendChild(div);

    // NEW: prendo blocco + budget dalla survey
    const fd = new FormData(form);
    const survey = {
      blocco: fd.get("blocco") || "",
      blocco_altro: fd.get("survey_blocco_altro") || "",
      budget: fd.get("budget") || ""
    };

    const productKey = lastRecommendation?.prodotto?.key || "combo";
    const profile = getClinicProfile();
    renderNextSteps(status, productKey, profile, survey);

    qs("nextSteps")?.removeAttribute("hidden");
  }

  /* =========================
   *  Export PDF & recap (PDF completo con TUTTI i campi + grafici)
   * ========================= */
  async function exportPDF() {
    try {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) return toast("Errore: jsPDF non caricato");

      // --- Helper: valore visuale (gestisce "Altro" e label option) ---
      const getDisplayValue = (control) => {
        if (!control) return "";
        if (control.tagName === "SELECT") {
          const v = control.value || "";
          const targetId = control.getAttribute("data-altro-target");
          if (v.toLowerCase() === "altro" && targetId) {
            const alt = document.getElementById(targetId);
            const altVal = (alt?.value || "").toString().trim();
            if (altVal) return altVal;
          }
          const opt = control.querySelector(`option[value="${CSS.escape(v)}"]`);
          return (opt?.textContent || v || "").toString().trim();
        }
        return (control.value || "").toString().trim();
      };

      // --- Helper: clona il pannello risultati e sostituisce i canvas con <img> ---
      const cloneSummaryWithChartsAsImages = () => {
        const original = document.getElementById("matchSummary");
        if (!original) return null;
        const clone = original.cloneNode(true);

        const srcCanvases = {
          pie: document.getElementById("pieChart"),
          spark: document.getElementById("sparklineChart"),
          roi: document.getElementById("roiChart"),
        };

        const replaceCanvas = (cloneId, srcCanvas) => {
          if (!srcCanvas) return;
          const dataUrl = srcCanvas.toDataURL("image/png");
          const cClone = clone.querySelector(`#${cloneId}`);
          if (!cClone) return;
          const img = document.createElement("img");
          img.src = dataUrl;
          img.alt = cClone.getAttribute("aria-label") || "Grafico";
          img.style.width = "100%";
          img.style.height = "auto";
          img.style.display = "block";
          cClone.replaceWith(img);
        };

        replaceCanvas("pieChart", srcCanvases.pie);
        replaceCanvas("sparklineChart", srcCanvases.spark);
        replaceCanvas("roiChart", srcCanvases.roi);

        return clone;
      };

      // --- Costruisco il layout "stampabile" ---
      const temp = document.createElement("div");
      temp.style.padding = "18px";
      temp.style.background = "#ffffff";
      temp.style.color = "#111827";
      temp.style.width = "980px"; // ottimo per A4 verticale
      temp.style.fontFamily = "Inter, Arial, sans-serif";
      temp.style.fontSize = "12px";
      temp.id = "printRoot";

      // Header pulito
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.marginBottom = "6px";
      header.innerHTML = `
        <div style="font-weight:900;font-size:18px">SpinMatch Pro — Resume completo</div>
        <div style="color:#64748B">Generato il ${(new Date()).toLocaleString()}</div>
      `;
      temp.appendChild(header);

      // ---- SEZIONE: riepilogo discovery per step (tutti i campi compilati) ----
      const formEl = document.getElementById("discoveryForm");
      const steps = [...formEl.querySelectorAll("fieldset.step")];

      const addStepTable = (fs) => {
        const legendText = fs.querySelector("legend")?.innerText || "Sezione";
        const rows = [];
        fs.querySelectorAll(".form-group").forEach(group => {
          const labelEl = group.querySelector("label");
          const label = (labelEl?.textContent || "").trim();
          if (!label) return;
          const control = group.querySelector("input, select, textarea");
          if (!control) return;
          if (control.disabled) return; // ignora “Altro” disabilitati
          const val = getDisplayValue(control);
          if (val) rows.push([label, val]);
        });

        if (!rows.length) return;

        const section = document.createElement("div");
        section.style.margin = "10px 0 8px";
        section.innerHTML = `<h2 style="margin:6px 0 8px 0;font-size:14px">${legendText}</h2>`;
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        rows.forEach(([k,v]) => {
          const tr = document.createElement("tr");
          const th = document.createElement("th"); const td = document.createElement("td");
          th.textContent = k; td.textContent = v;
          th.style.textAlign="left"; th.style.width="38%"; th.style.padding="6px 8px";
          td.style.padding="6px 8px";
          th.style.border = td.style.border = "1px solid #e5e7eb";
          tr.append(th,td); table.appendChild(tr);
        });
        section.appendChild(table);
        temp.appendChild(section);
      };

      steps.forEach(addStepTable);

      // ---- SEZIONE: pannello risultati completo (con grafici come immagini) ----
      const resultsTitle = document.createElement("h2");
      resultsTitle.style.margin = "12px 0 8px";
      resultsTitle.style.fontSize = "14px";
      resultsTitle.textContent = "Match & risultati";
      temp.appendChild(resultsTitle);

      const summaryClone = cloneSummaryWithChartsAsImages();
      if (summaryClone) {
        summaryClone.querySelector(".export-btns")?.remove();
        summaryClone.querySelectorAll("[hidden]").forEach(el => el.removeAttribute("hidden"));
        temp.appendChild(summaryClone);
      }

      // Monta in DOM per html2canvas
      document.body.appendChild(temp);

      // ---- Rasterizza in pagine A4 ----
      const canvas = await html2canvas(temp, { scale: 2, backgroundColor: "#ffffff" });
      document.body.removeChild(temp);

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW  = pageW - 40; // margini
      const fullH = canvas.height;
      const fullW = canvas.width;
      const ratio = imgW / fullW;
      const pageImgH = (pageH - 40) / ratio; // altezza del "ritaglio" sul canvas source

      let sY = 0;
      while (sY < fullH) {
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width  = fullW;
        pageCanvas.height = Math.min(pageImgH, fullH - sY);
        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(canvas, 0, sY, fullW, pageCanvas.height, 0, 0, fullW, pageCanvas.height);
        const chunkData = pageCanvas.toDataURL("image/png");
        const drawH = pageCanvas.height * ratio;

        pdf.addImage(chunkData, "PNG", 20, 20, imgW, drawH, "", "FAST");
        sY += pageCanvas.height;
        if (sY < fullH) pdf.addPage();
      }

      pdf.save(`SpinMatchPro_Resume_${(new Date()).toISOString().slice(0,10)}.pdf`);
      toast("PDF completo esportato");
    } catch (err) {
      console.error(err);
      toast("Impossibile esportare il PDF");
    }
  }

  function buildRecapText() {
    const p   = getClinicProfile();
    const st  = document.querySelector(".survey-result")?.textContent || "Non valutato";
    const rec = qs("outputRaccomandazione")?.textContent || "-";
    const mig = qs("outputMiglioramento")?.textContent || "-";
    const cs  = qs("outputCasoStudio")?.textContent || "-";
    return [
      `Riepilogo SpinMatch Pro`,
      `Clinica: ${p.nome || "-"}`,
      `Città: ${p.citta || "-"}`,
      `Soluzione consigliata: ${rec}`,
      `Stato lead: ${st}`,
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

  /* =========================
   *  Reset sessione
   * ========================= */
  function resetSessione() {
    try { form?.reset(); localStorage.removeItem(LS_KEYS.FORM); localStorage.removeItem(LS_KEYS.SURVEY_UNLOCK); } catch {}

    ["outputRaccomandazione","outputCasoStudio","outputMiglioramento","benefitBadges"].forEach(id => { const el = qs(id); if (el) el.textContent = ""; });
    qs("caseStudyGrid")?.replaceChildren();
    qs("matchWhyList")?.replaceChildren?.();
    qs("matchWhy")?.setAttribute("hidden","");

    if (pieChart) { pieChart.destroy(); pieChart = null; }
    if (sparklineChart) { sparklineChart.destroy(); sparklineChart = null; }
    if (roiChart) { roiChart.destroy(); roiChart = null; }

    if (leadPill)  { leadPill.textContent = "• Nessuna valutazione"; leadPill.removeAttribute("style"); }
    if (leadBadge) { leadBadge.textContent = "Nessuna valutazione";   leadBadge.removeAttribute("style"); }

    matchSummary.querySelector(".survey-result")?.remove();
    qs("nextStepsList")?.replaceChildren();
    ["proposalCard","caseStudyCard","chartsWrap","nextSteps"].forEach(id => qs(id)?.setAttribute("hidden",""));
    qs("emptyResults")?.removeAttribute("hidden");

    lastRecommendation = null;

    applySurveyVisibility(); // NEW: torna locked
    if (SCROLLER) SCROLLER.scrollTo({ top: 0, behavior: "smooth" });
    updateProgressAndSidebar();
    toast("Nuova sessione pronta");
  }

  /* =========================
   *  Modal “Presenta soluzioni” con viewer (PDF/PPT)
   *  — sblocco rigoroso Survey dopo N secondi di viewer aperto
   * ========================= */
  const toAbsUrl = (u) => new URL(u, window.location.href).href;
  const buildViewerSrc = (absUrl) => {
    const u = absUrl.toLowerCase();
    if (u.endsWith(".pdf")) {
      return absUrl + "#toolbar=1&navpanes=0&view=FitH";
    }
    if (/\.(pptx?|docx?|xlsx?)$/.test(u)) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absUrl)}&wdAr=1.7777777777777777`;
    }
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(absUrl)}`;
  };

  function startPresentationWatch() {
    stopPresentationWatch();
    // Avvia il countdown solo se il viewer è davvero visibile
    const modalVisible  = !presentaModal?.classList.contains("hidden");
    const viewerVisible = modalVisible && !viewerWrap?.classList.contains("hidden");
    if (!viewerVisible) return;
    surveyUnlockTimer = setTimeout(() => {
      if (!isSurveyUnlocked()) {
        unlockSurveyUI();
        toast("Presentazione effettuata — Survey finale sbloccata");
      }
    }, PRESENTATION_VIEW_SECONDS * 1000);
  }
  function stopPresentationWatch() {
    if (surveyUnlockTimer) { clearTimeout(surveyUnlockTimer); surveyUnlockTimer = null; }
  }

  function openDocViewer(docUrl, title){
    if (!docUrl) return toast("URL documento mancante");
    const abs   = toAbsUrl(docUrl);
    const embed = buildViewerSrc(abs);

    chooser?.classList.add("hidden");
    viewerWrap?.classList.remove("hidden");
    presentaBack?.classList.remove("hidden");
    openInNew?.classList.remove("hidden");
    if (presentaTitleEl) presentaTitleEl.textContent = title || "Presentazione";
    if (frame) {
      frame.src = embed;
      // Avvia il timer allo 'load' dell'iframe (viewer effettivamente pronto)
      const onLoad = () => { frame.removeEventListener("load", onLoad); startPresentationWatch(); };
      frame.addEventListener("load", onLoad);
    }
    if (openInNew) openInNew.href = abs; // in nuova scheda apre il file originale
  }

  function backToChooser(){
    stopPresentationWatch();
    if (frame) frame.src = "";
    viewerWrap?.classList.add("hidden");
    chooser?.classList.remove("hidden");
    presentaBack?.classList.add("hidden");
    openInNew?.classList.add("hidden");
    if (presentaTitleEl) presentaTitleEl.textContent = "Presentazioni rapide";
  }

  function openPresenta() {
    if (!presentaModal) return;
    lastFocusEl = document.activeElement;
    backToChooser();
    presentaModal.classList.remove("hidden");
    presentaClose?.focus();
  }

  function closePresenta() {
    stopPresentationWatch();
    if (!presentaModal) return;
    if (frame) frame.src = "";
    presentaModal.classList.add("hidden");
    if (lastFocusEl && lastFocusEl.focus) lastFocusEl.focus();
  }

  function bindPresenta() {
    if (!presentaModal) return;
    presentaBtn?.addEventListener("click", openPresenta);
    presentaClose?.addEventListener("click", closePresenta);
    presentaBack?.addEventListener("click", backToChooser);
    presentaModal.addEventListener("click", (e) => { if (e.target === presentaModal) closePresenta(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !presentaModal.classList.contains("hidden")) closePresenta(); });

    openGipoBtn?.addEventListener("click", () => openDocViewer(openGipoBtn.dataset.docUrl, "GipoNext"));
    openMioBtn?.addEventListener("click", () => openDocViewer(openMioBtn.dataset.docUrl, "MioDottore"));
  }

  /* =========================
   *  Survey: lock/unlock & visibilità
   * ========================= */
  const isSurveyUnlocked = () => localStorage.getItem(LS_KEYS.SURVEY_UNLOCK) === "1";

  function unlockSurveyUI() {
    try { localStorage.setItem(LS_KEYS.SURVEY_UNLOCK, "1"); } catch {}
    applySurveyVisibility();
    // Annuncio ARIA semplice via toast; qui potresti anche usare un'area aria-live dedicata
  }

  function applySurveyVisibility() {
    const unlocked = isSurveyUnlocked();

    // Sidebar: nascondi/mostra voce step 5 (se presente), oppure marcala locked
    if (navStep5Btn) {
      navStep5Btn.style.display = unlocked ? "" : "none"; // “solo dopo” diventa visibile
      navStep5Btn.classList.toggle("locked", !unlocked);
      navStep5Btn.setAttribute("aria-disabled", unlocked ? "false" : "true");
    }

    // Fieldset step 5: visibile solo se unlocked
    if (step5Fieldset) {
      if (unlocked) {
        step5Fieldset.removeAttribute("hidden");
        step5Fieldset.style.display = "";
      } else {
        step5Fieldset.setAttribute("hidden", "true");
        step5Fieldset.style.display = "none";
      }
    }

    // Bottone “Valuta lead” (extra guard)
    if (surveySubmitBtn) surveySubmitBtn.disabled = !unlocked;

    updateProgressAndSidebar();
  }

  /* =========================
   *  Event binding
   * ========================= */
  function bindEvents() {
    ["input","change"].forEach(ev => form?.addEventListener(ev, () => { doAutosave(); updateProgressAndSidebar(); }));
    initAltroToggles();
    updateProgressAndSidebar();

    newSessionBtn?.addEventListener("click", resetSessione);

    runRecBtn?.addEventListener("click", () => {
      const out = generaRaccomandazione();
      applyRecommendation(out);
      toast("Proposta generata");
    });

    surveySubmitBtn?.addEventListener("click", () => {
      if (!isSurveyUnlocked()) { toast("Prima presenta le soluzioni per attivare la Survey."); return; }
      const status = valutaSurvey();
      applyLeadFeedback(status);
      toast("Valutazione lead aggiornata");
    });

    exportPDFBtn?.addEventListener("click", exportPDF);
    copyRecapBtn?.addEventListener("click", copyRecap);
    emailRecapBtn?.addEventListener("click", emailRecap);

    // “Vai al preventivo”
    openPreventivoBtn?.addEventListener("click", (e) => {
      const href = openPreventivoBtn.getAttribute("href");
      if (!href) { e.preventDefault(); openExternal(URLS.PREVENTIVO, "Preventivo"); }
      else toast("Apro il preventivo…");
    });

    // “Fissa appuntamento”
    if (bookMeetingBtn) {
      const url = bookMeetingBtn.dataset.url || window.BOOKING_URL || URLS.BOOKING_FALLBACK;
      bookMeetingBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openExternal(url, "Calendario appuntamenti");
      });
    }

    // Click su card case study → apre PDF originale
    const grid = qs("caseStudyGrid");
    if (grid) {
      grid.addEventListener("click", (e) => {
        const a = e.target.closest("[data-open-pdf]");
        if (!a) return;
        e.preventDefault();
        const card = e.target.closest(".result-item");
        const pdf  = card?.dataset.pdf || "";
        if (pdf) openExternal(encodeURI(toAbsUrl(pdf)), "Case study");
      });
    }

    helpBtn?.addEventListener("click", showOnboarding);
    onboardingClose?.addEventListener("click", hideOnboarding);
    onboardingNext?.addEventListener("click", () => { onboardingIndex = Math.min(4, onboardingIndex + 1); updateOnboardingDots(); });
    onboardingPrev?.addEventListener("click", () => { onboardingIndex = Math.max(0, onboardingIndex - 1); updateOnboardingDots(); });
    onboardingDots.forEach((dot, i) => dot.addEventListener("click", () => { onboardingIndex = i; updateOnboardingDots(); }));

    bindPresenta();
  }

  /* =========================
   *  Init
   * ========================= */
  async function init() {
    restoreAutosave();
    initStepNavigation();
    bindEvents();

    // Applica visibilità iniziale della Survey (bloccata finché non sbloccata)
    applySurveyVisibility();

    if (shouldShowOnboarding()) setTimeout(showOnboarding, 300);
    stepFieldsets.forEach(fs => fs.classList.add("fade-in"));
  }

  document.addEventListener("DOMContentLoaded", init);
})();


