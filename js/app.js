/* 
 * UNIVERSAL ENTERPRISE PARTSCOMPARE & SOURCING INTELLIGENCE PLATFORM
 * Main UI Application Controller & Routing Engine
 * Interfaces with window.PC_API (adapter.js) and window.PC_AI (ai.js)
 */
(function () {
  const API = window.PC_API;
  const $app = document.getElementById('app');
  const $nav = document.getElementById('nav');
  const $who = document.getElementById('who');
  const $themeToggle = document.getElementById('theme-toggle');

  let me = null;
  let ed = null;   // list editor state
  let cmp = null;  // comparison page state
  let offerForm = null; // catalog offer form state
  let catalogFilter = 'ALL'; // active filter state
  let catalogSupplierFilter = 'ALL'; // active supplier filter state
  let catalogWorkspaceView = 'GLOBAL'; // 'GLOBAL' | 'SUPPLIER' | 'COMBINED'
  let selectedSupplierDashId = null; // selected supplier ID for Dedicated Supplier CSV Dashboard
  let supplierDashSearch = ''; // search input inside Dedicated Supplier Dashboard
  let supplierForceAssignAll = true; // attribute all uploaded CSV rows to selected supplier
  let parsedAiRows = []; // parsed AI CSV lines state
  let parsedAiQuoteItems = []; // parsed AI supplier quotation items state

  // Dynamic Enterprise Business Profile Cache
  let companyProfile = {
    id: 1,
    business_name: 'AMGC Airconditioning Services',
    business_type: 'Commercial & Industrial HVAC Services',
    location: 'V.V. Soliven Ave. II, Cainta, Rizal, Philippines',
    contact_number: '+63 (02) 8655-2491 / +63 917 123 4567',
    currency_code: 'PHP',
    currency_symbol: '₱',
    max_quote_age_days: 14,
    required_supplier_quotes: 3,
    mcda_cost_weight: 40,
    mcda_stock_weight: 30,
    mcda_freshness_weight: 20,
    mcda_consolidation_weight: 10
  };

  /* ---------------- Safe Theme Initializer ---------------- */
  try {
    const savedTheme = localStorage.getItem('pc_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    if ($themeToggle) {
      $themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
      $themeToggle.onclick = function () {
        const cur = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('pc_theme', next);
        $themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
      };
    }
  } catch (err) {
    console.error('Theme toggle init error:', err);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (minor, cur) => {
    const currencyStr = cur || (companyProfile && companyProfile.currency_code) || 'PHP';
    return minor == null ? 'Not available'
      : esc(currencyStr) + ' ' + (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const computeVat = (minor) => {
    if (minor == null) return { net: null, vat: null, gross: null };
    const gross = minor;
    const net = Math.round(gross / 1.12);
    const vat = gross - net;
    return { net, vat, gross };
  };
  const fmtDate = (d) => d ? esc(d) : 'Not recorded';
  const fmtTime = (iso) => new Date(iso).toLocaleString();

  const REASONS = {
    MISSING_DATA: 'Missing price, quantity, date or source',
    INACTIVE: 'Offer or part is inactive',
    UNIT_MISMATCH: 'Unit does not match',
    CURRENCY_MISMATCH: 'Currency does not match the policy',
    PRICE_BASIS_MISMATCH: 'Price is not per single piece',
    FUTURE_DATE: 'Checked date is in the future',
    STALE: 'Checked date is older than the freshness limit',
    INSUFFICIENT_QUANTITY: 'Recorded quantity is below the quantity needed',
  };
  const UNRESOLVED = {
    NO_RECORDED_OFFER: 'No offer recorded for this part',
    NO_ELIGIBLE_OFFER: 'No eligible offer from accredited suppliers',
    NO_SELECTION: 'Eligible offers exist. Choose one.',
  };
  const badge = (cls, text) => '<span class="badge ' + cls + '">' + text + '</span>';
  const alertBox = (cls, html, role) => '<div class="alert ' + cls + '"' + (role ? ' role="' + role + '"' : '') + '><div>' + html + '</div></div>';
  const fe = (errors, key, id) => errors && errors[key] ? '<div class="err" id="' + id + '">' + esc(errors[key]) + '</div>' : '';

  function priceTrendBadge(o) {
    if (!o || o.price_minor == null || o.prev_price_minor == null) return '';
    const diff = o.price_minor - o.prev_price_minor;
    const histTip = Array.isArray(o.price_history) && o.price_history.length > 1
      ? 'Price history: ' + o.price_history.map((h) => '₱' + (h.price_minor / 100).toFixed(2) + ' (' + (h.date || '') + ')').join(' → ')
      : 'Previous price: ₱' + (o.prev_price_minor / 100).toFixed(2);
    if (diff < 0) {
      return '<div class="small po-trend-down" title="' + esc(histTip) + '">▼ -₱' + (Math.abs(diff) / 100).toFixed(2) + '</div>';
    }
    if (diff > 0) {
      return '<div class="small po-trend-up" title="' + esc(histTip) + '">▲ +₱' + (diff / 100).toFixed(2) + '</div>';
    }
    return '<div class="small" style="color:var(--mute);font-size:11px;" title="' + esc(histTip) + '">━ Stable</div>';
  }

  function validatePasswordComplexity(pass) {
    const p = String(pass || '');
    const hasLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNum = /\d/.test(p);
    const hasSym = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p);
    const valid = hasLen && hasUpper && hasLower && hasNum && hasSym;
    return { valid, hasLen, hasUpper, hasLower, hasNum, hasSym };
  }

  function updatePasswordComplexityUI(pass, prefix = 'reg') {
    const c = validatePasswordComplexity(pass);
    const setChk = (id, ok, text) => {
      const el = document.getElementById(prefix + '-chk-' + id);
      if (!el) return;
      el.innerHTML = (ok ? '✓ ' : '○ ') + text;
      el.style.color = ok ? '#10B981' : 'var(--mute)';
      el.style.fontWeight = ok ? '600' : 'normal';
    };
    setChk('len', c.hasLen, '8+ Characters');
    setChk('upper', c.hasUpper, 'Uppercase (A-Z)');
    setChk('lower', c.hasLower, 'Lowercase (a-z)');
    setChk('num', c.hasNum, 'Number (0-9)');
    setChk('sym', c.hasSym, 'Symbol (!@#$...)');

    const badgeEl = document.getElementById(prefix + '-pass-status-badge');
    if (badgeEl) {
      if (c.valid) {
        badgeEl.className = 'badge ok';
        badgeEl.textContent = '✓ Strong & Compliant';
        badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
        badgeEl.style.color = '#10B981';
        badgeEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      } else {
        badgeEl.className = 'badge bad';
        badgeEl.textContent = 'Incomplete';
        badgeEl.style.background = 'rgba(239, 68, 68, 0.12)';
        badgeEl.style.color = '#EF4444';
        badgeEl.style.border = '1px solid rgba(239, 68, 68, 0.25)';
      }
    }
    return c.valid;
  }

  function go(hash) { 
    if (location.hash === hash) route(); 
    else location.hash = hash; 
  }

  function isAdminUser() {
    return me && (me.role === 'admin' || me.role === 'administrator');
  }

  /* ---------- MODULE 1: DYNAMIC BRANDING & SHELL ---------- */
  function applyBranding(p) {
    if (!p) return;
    companyProfile = Object.assign({}, companyProfile, p);

    // 1. Update <title>
    document.title = `${esc(companyProfile.business_name)} — PartsCompare Enterprise`;

    // 2. Update Top Bar Brand Banner
    const banner = document.querySelector('.banner');
    if (banner) {
      banner.innerHTML = `${esc(companyProfile.business_name)} &bull; ${esc(companyProfile.business_type)} &bull; Sourcing Intelligence &amp; BOM Comparison`;
    }

    // 3. Update Footer Brand Text & Location (using &bull; for bullet separators)
    const footBrandDesc = document.querySelector('.foot-brand-col p');
    if (footBrandDesc) {
      footBrandDesc.innerHTML = `Universal Bill of Materials Comparison System using curated supplier quotations. Configured for <strong>${esc(companyProfile.business_name)}</strong> &bull; ${esc(companyProfile.location)}.`;
    }

    const footContactLoc = document.getElementById('footerLocationText');
    if (footContactLoc) {
      footContactLoc.textContent = companyProfile.location;
    }

    const footContactPhone = document.getElementById('footerContactPhone');
    if (footContactPhone && companyProfile.contact_number) {
      footContactPhone.textContent = companyProfile.contact_number;
    }

    const footBottom = document.querySelector('.foot-pro-bottom-in span');
    if (footBottom) {
      footBottom.innerHTML = `&copy; 2026 PartsCompare &bull; Project Nexus (CEDT) &bull; ${esc(companyProfile.business_name)}.`;
    }

    // 4. Update Landing Page Hero Pill
    const heroPill = document.getElementById('heroCompanyPill');
    if (heroPill) {
      heroPill.textContent = `${companyProfile.business_name} • ${companyProfile.location}`;
    }
  }

  async function loadInitialCompanyProfile() {
    try {
      if (API.getCompanyProfile) {
        const p = await API.getCompanyProfile();
        if (p) applyBranding(p);
      }
    } catch (e) {
      console.warn('Initial company profile fetch error:', e);
    }
  }

  const SECURITY_QUESTIONS = [
    'What city or municipality were you born in?',
    'What was the name of your first elementary school?',
    'What is your mother\'s maiden name?',
    'What was the name of your first pet?',
    'What is your employee ID badge or favorite HVAC tool?'
  ];

  let fpState = null; // forgot password modal state

  let landing = false;
  function renderShell() {
    document.body.classList.toggle('landing', landing);
    if (!me) {
      const curHash = location.hash || '#/';
      $nav.innerHTML = [
        ['how', 'How it works'],
        ['try', 'Interactive Simulator'],
        ['#/about', 'About System'],
        ['#/faqs', 'FAQs']
      ].map(([t, l]) => t.startsWith('#')
        ? '<a href="' + t + '"' + (curHash === t ? ' aria-current="page"' : '') + '>' + l + '</a>'
        : '<button type="button" class="navbtn" data-action="scroll" data-target="' + t + '">' + l + '</button>'
      ).join('');
      $who.innerHTML = '<a class="btn primary" href="#/login" data-action="open-login" data-guide-key="auth-staff-login" style="font-weight:700;">🔑 Sign In / Staff Portal</a>';
      return;
    }
    const links = [];
    if (me) {
      if (isAdminUser()) {
        links.push(['#/', 'Administration Console', 'nav-admin']);
      }
      if (me.capabilities && me.capabilities.includes('lists')) {
        links.push(['#/lists', 'Preparer Workspace', 'nav-preparer'], ['#/summaries', 'Saved Summaries', 'nav-summaries']);
      }
      if (me.capabilities && me.capabilities.includes('catalog')) {
        links.push(['#/catalog', 'Offer Catalog', 'nav-catalog']);
      }
      if (me.capabilities && me.capabilities.includes('orders') && window.PC_ORDERS) {
        links.push(['#/orders', 'Purchase Orders', 'nav-orders']);
      }
    }
    const cur = location.hash || '#/';
    const isActive = (h) => cur === h
      || (h === '#/lists' && cur.startsWith('#/compare'))
      || (h === '#/orders' && (cur.startsWith('#/orders/') || cur === '#/tracking' || cur === '#/inventory' || cur === '#/analytics'));
    $nav.innerHTML = links.map(([h, t, k]) => '<a href="' + h + '"' + (k ? ' data-guide-key="' + k + '"' : '') + (isActive(h) ? ' aria-current="page"' : '') + '>' + t + '</a>').join('');
    
    const isSim = (me && me.is_simulation) || (API.isSimulationMode && API.isSimulationMode());
    const simBadge = isSim 
      ? '<span class="badge" data-guide-key="nav-simulation-badge" style="background:#0F766E; color:#2DD4BF; font-weight:700; font-size:11px; padding:3px 8px; border:1px solid #2DD4BF; margin-right:4px; cursor:help;">🎮 SIMULATION SANDBOX</span>'
      : '';
    $who.innerHTML = me ? simBadge + '<span class="pill">' + esc(me.name) + ' (' + esc(me.role) + ')</span>' + (isSim ? '<button type="button" class="btn" style="background:#EF4444; color:#fff; border:none; padding:4px 10px; font-size:12px; font-weight:700;" data-action="exit-simulation" title="Exit simulation sandbox">Exit Sandbox</button>' : '<button type="button" class="btn" style="padding:0 10px; font-size:12.5px;" data-action="open-my-security-modal" data-guide-key="nav-security-pin" title="Manage 6-Digit Recovery PIN &amp; Security Question">🛡️ Recovery PIN</button><button type="button" data-action="logout">Sign out</button>') : '';
  }

  function setMain(html, preserveScroll = false) { 
    const prevY = preserveScroll ? (window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0) : 0;
    landing = false; 

    const isSim = (me && me.is_simulation) || (API.isSimulationMode && API.isSimulationMode());
    const simBanner = isSim
      ? '<div class="simulation-banner" style="background:linear-gradient(90deg, #0F172A, #064E3B); border-bottom:2px solid #2DD4BF; color:#F8FAFC; padding:10px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">'
        + '<div style="display:flex; align-items:center; gap:10px;"><span style="font-size:20px;">🎮</span>'
        + '<div><strong style="color:#2DD4BF; font-size:13.5px;">SIMULATION DEMO SANDBOX ACTIVE</strong>'
        + '<div style="color:#CBD5E1; font-size:12px; margin-top:1px;">You are exploring with isolated sample data. Real AMGC company records &amp; Supabase Cloud are completely protected.</div></div></div>'
        + '<button type="button" class="btn" data-action="exit-simulation" style="background:#EF4444; color:#fff; border:none; font-weight:700; font-size:12px; padding:6px 14px; cursor:pointer; border-radius:6px;">🔒 Exit Simulation Mode</button>'
        + '</div>'
      : '';

    $app.innerHTML = simBanner + html; 
    renderShell(); 
    applyBranding(companyProfile);
    if (preserveScroll) {
      window.scrollTo(0, prevY);
      if (window.PC_SMOOTH_SCROLL) window.PC_SMOOTH_SCROLL.sync(prevY);
      requestAnimationFrame(() => {
        window.scrollTo(0, prevY);
        if (window.PC_SMOOTH_SCROLL) window.PC_SMOOTH_SCROLL.sync(prevY);
      });
    } else {
      window.scrollTo(0, 0); 
      if (window.PC_SMOOTH_SCROLL) window.PC_SMOOTH_SCROLL.sync(0);
    }
  }

  function loading(msg) { 
    setMain('<div class="card stack"><div class="row" style="align-items:center;gap:12px"><div class="spinner" aria-hidden="true"></div><span>' + esc(msg || 'Loading...') + '</span></div></div>'); 
  }

  function errorPage(e) {
    setMain('<div class="card stack"><h1>Something went wrong</h1>' 
      + alertBox('bad', '<strong>' + esc(e.code || 'ERROR') + '</strong>: ' + esc(e.message || 'An unexpected error occurred.'), 'alert') 
      + '<div><a class="btn" href="#/">Back to start</a></div></div>');
  }

  /* ---------- DEDICATED PAGE: ABOUT US ---------- */
  function pageAbout() {
    removeExistingModal();
    setMain(
      '<div class="page-container">' +
        '<div class="row between" style="align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">' +
          '<a class="btn" href="#/">← Back to Home / Sourcing Platform</a>' +
          '<div class="row" style="gap:8px;flex-wrap:wrap;">' +
            '<button type="button" class="btn" data-action="scroll" data-target="try">🎮 Interactive Simulator</button>' +
            '<button type="button" class="btn" data-action="scroll" data-target="how">📖 How It Works</button>' +
            '<a class="btn primary" href="#/login">🔑 Sign In to Portal</a>' +
          '</div>' +
        '</div>' +

        '<div class="page-hero-banner">' +
          '<div>' +
            '<div class="pill" style="margin-bottom:8px;background:rgba(45,212,191,0.15);color:#0D9488;border:1px solid rgba(45,212,191,0.3);font-weight:600">Enterprise Decision-Support System &middot; Project Nexus</div>' +
            '<h1>About PartsCompare &amp; ' + esc(companyProfile.business_name) + '</h1>' +
            '<p class="sub">A universal Bill of Materials comparison system powered by verified supplier quotations, reproducible eligibility rules, and immutable sourcing summaries.</p>' +
          '</div>' +
        '</div>' +

        '<div class="grid2" style="margin-top:20px;">' +
          '<div class="card stack">' +
            '<h2>Enterprise Sourcing Foundation</h2>' +
            '<p class="small" style="line-height:1.7;">' +
              'Tailored for <strong>' + esc(companyProfile.business_name) + '</strong> (' + esc(companyProfile.location) + '), this system eliminates informal unstandardized phone quotes, scattered messaging receipts, and inaccurate spreadsheets. ' +
              'Project Nexus provides exact-part cataloging, configurable freshness thresholds, dynamic Multi-Criteria Decision Analysis (MCDA), and immutable sourcing snapshots.' +
            '</p>' +
            '<div class="row" style="gap:10px;margin-top:8px;">' +
              '<span class="badge ok">✓ Active Business Profile</span>' +
              '<span class="badge gray">' + esc(companyProfile.business_type) + '</span>' +
            '</div>' +
          '</div>' +

          '<div class="card stack">' +
            '<h2>Accredited Suppliers</h2>' +
            '<p class="small" style="line-height:1.7;">' +
              'Quotations are curated from verified, accredited supplier depots with recorded check dates and verifiable invoice references:' +
            '</p>' +
            '<ul class="small" style="margin:0;padding-left:18px;line-height:1.6;">' +
              '<li><strong>Everwell Parts &amp; Equipment Corp.:</strong> Direct importer of OEM capacitors, fan motors, and universal control kits.</li>' +
              '<li><strong>C&amp;C Airconditioning Supply:</strong> Major wholesaler of heavy-duty contactors, sealed R410A refrigerants, and thermistors.</li>' +
              '<li><strong>Manco Refrigeration Supply:</strong> Specialized refrigeration depot for commercial HVAC valves and sensor probes.</li>' +
            '</ul>' +
          '</div>' +
        '</div>' +

        '<div class="card stack" style="margin-top:24px;text-align:center;padding:24px;background:var(--card-subtle);">' +
          '<h3 style="margin:0 0 6px;">Ready to evaluate supplier quotations?</h3>' +
          '<p class="small" style="color:var(--mute);margin:0 0 16px;">Test component pricing rules in real-time or sign into your role workspace.</p>' +
          '<div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap;">' +
            '<button type="button" class="btn primary" data-action="scroll" data-target="try">🎮 Launch Interactive Simulator</button>' +
            '<button type="button" class="btn" data-action="scroll" data-target="how">📖 How It Works</button>' +
            '<a class="btn" href="#/faqs">❓ Frequently Asked Questions</a>' +
            '<a class="btn primary" href="#/login">🔑 Sign In to Workspace</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- DEDICATED PAGE: FAQS ---------- */
  function pageFaqs() {
    removeExistingModal();
    const faqData = [
      {
        q: 'What makes a supplier offer "Eligible" for a Bill of Materials line?',
        a: 'An offer is eligible only when it satisfies all policy criteria: it must match the exact part identifier, possess complete unit pricing and stock data, be dated within the agreed freshness window, and have a recorded quantity equal to or greater than the line requirement.'
      },
      {
        q: 'Why are unresolved parts not counted as zero (₱0.00)?',
        a: 'In engineering procurement, treating an uncosted part as ₱0.00 creates dangerous budget deficits. PartsCompare omits uncosted lines from the subtotal and clearly flags the summary as partial until an accredited supplier is selected.'
      },
      {
        q: 'What is the Quote Validity & Freshness Policy?',
        a: 'Supplier quotes older than the configured age limit (e.g. 14 days) are marked as "Stale" and excluded from automatic selection to prevent cost overruns from market fluctuations.'
      },
      {
        q: 'How is Philippine 12% Value Added Tax (VAT) computed?',
        a: 'PartsCompare supports official BIR 12% VAT auditing. Quotations can be viewed in Dual Mode (showing both VAT-Inclusive and Net of VAT), Gross mode (12% tax included), or Net mode (excl. 12% VAT), with explicit output tax itemization.'
      },
      {
        q: 'How does the Dynamic MCDA Procurement Engine work?',
        a: 'The Multi-Criteria Decision Analysis engine dynamically ranks offers based on 4 configurable enterprise weights: Lowest Unit Cost (default 40%), Stock Buffer Ratio (default 30%), Quote Freshness (default 20%), and Supplier Consolidation (default 10%).'
      },
      {
        q: 'How does Supabase Cloud integration work?',
        a: 'The system synchronizes enterprise profile settings, catalog offers, BOM lists, and frozen summaries to Supabase PostgreSQL (https://xahcgiwwyaskazgbgejh.supabase.co) while maintaining instantaneous local-first caching.'
      },
      {
        q: 'How do I register a new supplier and upload their designated catalog price list?',
        a: '<strong>Step 1: Register Supplier:</strong> In the Administration Console (<code>#/</code>), scroll to <em>Accredited Supplier Network &amp; Vendor Directory</em> and click <code>+ Add Accredited Supplier</code>.<br><strong>Step 2: Attribute Catalog Offers:</strong> In <em>Offer Catalog Workspace</em> (<code>#/catalog</code>), click <code>CSV Template</code> to download the official format. Fill in your prices and place the exact registered supplier name in the <code>source</code> column (or click <code>+ Add New Offer</code> to select them from the dropdown).<br><strong>Step 3: View Designated Catalog:</strong> Use the <code>Filter by Supplier</code> dropdown in the Offer Catalog or click <code>📦 View Catalog</code> on the supplier\'s directory row to isolate and audit that vendor\'s price list.'
      }
    ];

    setMain(
      '<div class="page-container">' +
        '<div class="row between" style="align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">' +
          '<a class="btn" href="#/">← Back to Home / Sourcing Platform</a>' +
          '<div class="row" style="gap:8px;flex-wrap:wrap;">' +
            '<button type="button" class="btn" data-action="scroll" data-target="try">🎮 Interactive Simulator</button>' +
            '<button type="button" class="btn" data-action="scroll" data-target="how">📖 How It Works</button>' +
            '<a class="btn primary" href="#/login">🔑 Sign In to Portal</a>' +
          '</div>' +
        '</div>' +

        '<div class="page-hero-banner">' +
          '<h1>Frequently Asked Questions</h1>' +
          '<p class="sub">Auditing standards, eligibility rules, and enterprise governance principles.</p>' +
        '</div>' +
        '<div class="stack" style="gap:14px;margin-top:20px;">' +
          faqData.map(f => '<div class="card stack"><h3 style="font-size:16px;margin:0 0 6px;">' + esc(f.q) + '</h3><p class="small" style="line-height:1.6;color:var(--ink);margin:0;">' + esc(f.a) + '</p></div>').join('') +
        '</div>' +

        '<div class="card stack" style="margin-top:24px;text-align:center;padding:24px;background:var(--card-subtle);">' +
          '<h3 style="margin:0 0 6px;">Have more questions about our sourcing workflow?</h3>' +
          '<p class="small" style="color:var(--mute);margin:0 0 16px;">Test component pricing rules in real-time or contact our administration team.</p>' +
          '<div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap;">' +
            '<button type="button" class="btn primary" data-action="scroll" data-target="try">🎮 Launch Interactive Simulator</button>' +
            '<button type="button" class="btn" data-action="scroll" data-target="how">📖 How It Works</button>' +
            '<a class="btn" href="#/about">🏛️ About Project Nexus</a>' +
            '<a class="btn primary" href="#/login">🔑 Sign In to Workspace</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- LOGIN SLIDER ---------- */
  function pageLogin(err, username) {
    removeExistingModal();
    setMain(
      '<div class="login-slider-container" id="loginSlider">' +
        '<div class="form-panel signin-panel">' +
          '<div class="form-panel-inner stack">' +
            '<h1 style="font-size: 28px; font-weight: 700;">Sign in</h1>' +
            '<p class="sub" style="margin-bottom: 4px;">Access ' + esc(companyProfile.business_name) + ' BOM comparison lists.</p>' +
            (err ? alertBox('bad', esc(err), 'alert') : '') +
            '<form id="login" class="stack" novalidate autocomplete="off" style="margin-top: 4px;">' +
              '<div><label for="u">Username</label><input id="u" name="u" autocomplete="off" placeholder="Enter staff username" value="' + esc(username || '') + '" required></div>' +
              '<div>' +
                '<div class="row between" style="align-items:baseline;">' +
                  '<label for="p" style="margin-bottom:4px;">Password</label>' +
                  '<button type="button" class="navbtn-link" data-action="open-forgot-password" data-guide-key="auth-forgot-password" style="background:none;border:none;padding:0;height:auto;font-size:12.5px;color:var(--teal);font-weight:600;cursor:pointer;">Forgot password?</button>' +
                '</div>' +
                '<input id="p" name="p" type="password" autocomplete="new-password" placeholder="Enter password" value="" readonly onfocus="this.removeAttribute(\'readonly\');" required>' +
              '</div>' +
              '<button class="primary" type="submit" data-guide-key="auth-staff-login" style="margin-top: 4px; height: 46px; font-size: 15px;">Sign in</button>' +
              '<button type="button" class="btn mobile-only-auth-btn" id="mobileRequestAccountBtn" style="font-size: 13px; width: 100%;">Request New Account →</button>' +
            '</form>' +
            '<div class="stack" style="margin-top: 14px; padding-top:12px; border-top:1px dashed var(--line);">' +
              '<div class="small" style="font-weight: 600; color:var(--ink);">Staff Username Quick-Fill:</div>' +
              '<div class="row" style="gap: 8px; flex-wrap:wrap; margin-top:4px;">' +
                '<button type="button" class="btn" style="flex: 1; min-width: 120px; font-size: 12px;" data-action="fill-login" data-u="dave_pm" data-guide-key="auth-quick-fill">👤 Dave (Preparer)</button>' +
                '<button type="button" class="btn" style="flex: 1; min-width: 120px; font-size: 12px;" data-action="fill-login" data-u="pearl_dba" data-guide-key="auth-quick-fill">🔧 Pearl (Maintainer)</button>' +
                '<button type="button" class="btn" style="flex: 1; min-width: 120px; font-size: 12px;" data-action="fill-login" data-u="karen_admin" data-guide-key="auth-quick-fill">⚙️ Karen (Admin)</button>' +
              '</div>' +
            '</div>' +
            '<div class="stack" style="margin-top: 12px; padding:10px 12px; background:var(--card-subtle); border-radius:8px; border:1px solid var(--line);">' +
              '<div class="small" style="font-weight: 700; color:#2DD4BF;">🎮 Guest or Demo Evaluator?</div>' +
              '<p class="small" style="color:var(--mute); margin:2px 0 6px;">Test-drive the sourcing engine in an isolated simulation sandbox without real credentials:</p>' +
              '<div class="row" style="gap:6px; flex-wrap:wrap;">' +
                '<button type="button" class="btn" style="flex:1; font-size:11.5px; padding:5px;" data-action="start-simulation" data-role="preparer">Demo Preparer</button>' +
                '<button type="button" class="btn" style="flex:1; font-size:11.5px; padding:5px;" data-action="start-simulation" data-role="maintainer">Demo Maintainer</button>' +
                '<button type="button" class="btn" style="flex:1; font-size:11.5px; padding:5px;" data-action="start-simulation" data-role="admin">Demo Admin</button>' +
              '</div>' +
            '</div>' +
            '<div style="margin-top: 10px;">' + alertBox('info', '🛡️ <strong>Enterprise Access Portal</strong> &bull; Authenticated AMGC personnel only.') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-panel signup-panel">' +
          '<div class="form-panel-inner stack" style="gap: 8px;">' +
            '<div>' +
              '<h1 style="font-size: 24px; font-weight: 700; margin: 0 0 2px;">New Account</h1>' +
              '<p class="sub" style="margin: 0;">Request credentials from the system administrator.</p>' +
            '</div>' +
            '<div class="signup-tabs" role="tablist" aria-label="Account Registration Steps">' +
              '<button type="button" class="signup-tab-btn active" id="signup-tab-1" role="tab" aria-selected="true">1. Account Details</button>' +
              '<button type="button" class="signup-tab-btn" id="signup-tab-2" role="tab" aria-selected="false">2. Security PIN &amp; Question</button>' +
            '</div>' +
            '<div id="signup-alert-box"></div>' +
            '<form id="signup-request" class="stack" novalidate style="gap: 8px;">' +
              '<div id="signup-step-1" class="stack" style="gap: 8px;">' +
                '<div><label for="req-name" style="font-size:12.5px; font-weight:600;">Full Name</label><input id="req-name" placeholder="Enter staff name (e.g. Engr. Marco Santos)"></div>' +
                '<div><label for="req-user" style="font-size:12.5px; font-weight:600;">Desired Username</label><input id="req-user" placeholder="Enter desired username (e.g. marco_hvac)"></div>' +
                '<div><label for="req-role" style="font-size:12.5px; font-weight:600;">Requested Role</label>' +
                  '<select id="req-role">' +
                    '<option value="preparer">Preparer / Field Technician (BOM Maker)</option>' +
                    '<option value="maintainer">Catalog Maintainer (Quotes &amp; Suppliers)</option>' +
                  '</select>' +
                '</div>' +
                '<div class="signup-pass-grid">' +
                  '<div><label for="req-pass" style="font-size:12.5px; font-weight:600;">Set Account Password</label><input id="req-pass" type="password" placeholder="Min 8 chars (complex)"></div>' +
                  '<div><label for="req-pass-confirm" style="font-size:12.5px; font-weight:600;">Confirm Password</label><input id="req-pass-confirm" type="password" placeholder="Re-type password"></div>' +
                '</div>' +
                '<div id="reg-pass-complexity" class="pass-complexity-box" style="margin-top:2px; padding:7px 10px; background:rgba(15, 23, 42, 0.4); border-radius:6px; border:1px solid var(--line); font-size:11.5px; line-height:1.4;">' +
                  '<div style="font-weight:600; color:var(--ink); margin-bottom:3px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<span>🛡️ Enterprise Password Policy:</span>' +
                    '<span id="reg-pass-status-badge" class="badge bad" style="font-size:10px; padding:1px 6px;">Incomplete</span>' +
                  '</div>' +
                  '<div style="display:grid; grid-template-columns:1fr 1fr; gap:2px 8px;">' +
                    '<span id="reg-chk-len" style="color:var(--mute); transition:color 0.15s ease;">○ 8+ Characters</span>' +
                    '<span id="reg-chk-upper" style="color:var(--mute); transition:color 0.15s ease;">○ Uppercase (A-Z)</span>' +
                    '<span id="reg-chk-lower" style="color:var(--mute); transition:color 0.15s ease;">○ Lowercase (a-z)</span>' +
                    '<span id="reg-chk-num" style="color:var(--mute); transition:color 0.15s ease;">○ Number (0-9)</span>' +
                    '<span id="reg-chk-sym" style="grid-column:span 2; color:var(--mute); transition:color 0.15s ease;">○ Special symbol (!@#$%^&*...)</span>' +
                  '</div>' +
                '</div>' +
                '<button class="primary" type="button" id="btn-next-signup-step" style="margin-top: 2px; height: 42px; font-size: 14px;">Next: Security PIN &amp; Question →</button>' +
                '<button type="button" class="btn mobile-only-auth-btn" id="mobileBackToSignIn" style="margin-top: 2px; font-size: 13px; width: 100%;">← Back to Sign In</button>' +
              '</div>' +

              '<div id="signup-step-2" class="stack" style="gap: 8px; display: none;">' +
                '<div class="small" style="padding: 8px 10px; border-radius: 8px; background: rgba(45, 212, 191, 0.1); border: 1px solid rgba(45, 212, 191, 0.28); color: var(--ink); line-height: 1.4;">' +
                  '🛡️ <strong>Anti-Impostor Protection:</strong> Your 6-digit PIN and Security Question verify your identity before any password reset request is accepted.' +
                '</div>' +
                '<div class="alert warn" style="padding: 10px 12px; border-radius: 8px; border-left: 4px solid #F59E0B; background: rgba(245, 158, 11, 0.12); color: var(--ink); line-height: 1.45; font-size: 12px;">' +
                  '⚠️ <strong>ONE-TIME SETUP DISCLAIMER:</strong><br>' +
                  '<strong>Remember your PIN and answer to security question because this is one time.</strong> These credentials are configured once during registration and cannot be recovered or changed without formal System Administrator intervention.' +
                '</div>' +
                '<div>' +
                  '<label for="req-pin" style="font-size:12.5px; font-weight:600;">6-Digit Security PIN</label>' +
                  '<input id="req-pin" type="password" inputmode="numeric" maxlength="6" class="pin-input-mono" placeholder="••••••">' +
                  '<div class="small" style="color:var(--mute); font-size:11.5px; margin-top:2px;">Exactly 6 digits (0–9). Avoid simple sequences like 123456 or 000000.</div>' +
                '</div>' +
                '<div>' +
                  '<label for="req-sec-q" style="font-size:12.5px; font-weight:600;">Unique Security Question</label>' +
                  '<select id="req-sec-q">' +
                    SECURITY_QUESTIONS.map(q => '<option value="' + esc(q) + '">' + esc(q) + '</option>').join('') +
                  '</select>' +
                '</div>' +
                '<div>' +
                  '<label for="req-sec-a" style="font-size:12.5px; font-weight:600;">Secret Answer</label>' +
                  '<input id="req-sec-a" type="text" placeholder="Enter memorable answer (case-insensitive)">' +
                '</div>' +
                '<div style="margin-top: 4px; padding: 6px 0; border-top: 1px solid var(--line);">' +
                  '<label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; cursor:pointer; line-height:1.4;">' +
                    '<input type="checkbox" id="req-terms" style="margin-top:2px;">' +
                    '<span>I have read and agree to the <a href="javascript:void(0)" id="linkViewTerms" data-action="open-terms-modal" style="color:var(--teal); font-weight:600; text-decoration:underline;">Terms and Conditions</a> and Enterprise Sourcing Policy.</span>' +
                  '</label>' +
                '</div>' +
                '<div class="row" style="gap: 8px; margin-top: 2px;">' +
                  '<button type="button" class="btn" id="btn-prev-signup-step" style="height: 42px; padding: 0 14px;">← Back</button>' +
                  '<button class="primary" type="submit" id="btn-submit-signup" style="flex: 1; height: 42px; font-size: 14px;">Submit Account Request</button>' +
                '</div>' +
              '</div>' +
            '</form>' +
            '<div style="margin-top: 2px;">' + alertBox('warn', 'Public signup is restricted per enterprise governance. Accounts require administrative setup.') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="overlay-panel-container">' +
          '<div class="overlay-panel">' +
            '<div class="overlay-circuit-bg">' + window.PC_ART.circuit() + '</div>' +
            '<div class="overlay-content overlay-left">' +
              '<div class="overlay-chip-art">' + window.PC_ART.chip('#0B3C43', '#7CD3CF') + '</div>' +
              '<h2>Already registered?</h2>' +
              '<p>Sign in to open and compare component parts lists and supplier offers.</p>' +
              '<button type="button" class="btn ghost" id="signInBtn">Back to Sign in</button>' +
            '</div>' +
            '<div class="overlay-content overlay-right">' +
              '<div class="overlay-chip-art">' + window.PC_ART.chip('#0B3C43', '#7CD3CF') + '</div>' +
              '<h2>' + esc(companyProfile.business_name) + '</h2>' +
              '<p>Need access or new account credentials? Submit an authorized staff provisioning request.</p>' +
              '<button type="button" class="btn ghost" id="signUpBtn" data-guide-key="auth-request-account">Request Account</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    const container = document.getElementById('loginSlider');
    const signUpBtn = document.getElementById('signUpBtn');
    const signInBtn = document.getElementById('signInBtn');
    const backBtn = document.getElementById('mobileBackToSignIn');
    const mobReqBtn = document.getElementById('mobileRequestAccountBtn');
    const tab1Btn = document.getElementById('signup-tab-1');
    const tab2Btn = document.getElementById('signup-tab-2');
    const step1El = document.getElementById('signup-step-1');
    const step2El = document.getElementById('signup-step-2');
    const nextStepBtn = document.getElementById('btn-next-signup-step');
    const prevStepBtn = document.getElementById('btn-prev-signup-step');

    const setSignupStep = (stepNum) => {
      if (!step1El || !step2El || !tab1Btn || !tab2Btn) return;
      const isStep2 = stepNum === 2;
      step1El.style.display = isStep2 ? 'none' : 'flex';
      step2El.style.display = isStep2 ? 'flex' : 'none';
      tab1Btn.classList.toggle('active', !isStep2);
      tab2Btn.classList.toggle('active', isStep2);
      tab1Btn.setAttribute('aria-selected', String(!isStep2));
      tab2Btn.setAttribute('aria-selected', String(isStep2));
      const sp = container ? container.querySelector('.signup-panel') : null;
      if (sp) sp.scrollTop = 0;
    };
    window.__setSignupStep = setSignupStep;

    const validateStep1AndAdvance = () => {
      const nameVal = (document.getElementById('req-name').value || '').trim();
      const userVal = (document.getElementById('req-user').value || '').trim();
      const passVal = document.getElementById('req-pass').value || '';
      const passConfVal = document.getElementById('req-pass-confirm').value || '';
      const alertBoxEl = document.getElementById('signup-alert-box');
      if (!nameVal || !userVal) {
        if (alertBoxEl) alertBoxEl.innerHTML = alertBox('bad', 'Please fill in your Full Name and Desired Username first.', 'alert');
        return false;
      }
      const passCheck = validatePasswordComplexity(passVal);
      if (!passCheck.valid) {
        if (alertBoxEl) alertBoxEl.innerHTML = alertBox('bad', 'Password must satisfy all 5 enterprise criteria: 8+ characters, uppercase (A-Z), lowercase (a-z), numbers (0-9), and special symbols (!@#$%...).', 'alert');
        const reqPassEl = document.getElementById('req-pass');
        if (reqPassEl) reqPassEl.focus();
        return false;
      }
      if (passVal !== passConfVal) {
        if (alertBoxEl) alertBoxEl.innerHTML = alertBox('bad', 'Passwords do not match. Please verify and re-type your password.', 'alert');
        return false;
      }
      if (alertBoxEl) alertBoxEl.innerHTML = '';
      setSignupStep(2);
      setTimeout(() => { const pinEl = document.getElementById('req-pin'); if (pinEl) pinEl.focus(); }, 80);
      return true;
    };

    const reqPassInput = document.getElementById('req-pass');
    if (reqPassInput) {
      reqPassInput.addEventListener('input', () => {
        updatePasswordComplexityUI(reqPassInput.value, 'reg');
      });
    }

    if (tab1Btn) tab1Btn.onclick = () => setSignupStep(1);
    if (tab2Btn) tab2Btn.onclick = () => validateStep1AndAdvance();
    if (nextStepBtn) nextStepBtn.onclick = () => validateStep1AndAdvance();
    if (prevStepBtn) prevStepBtn.onclick = () => setSignupStep(1);

    const showSignUp = () => {
      if (!container) return;
      container.classList.add('right-panel-active');
      const sp = container.querySelector('.signup-panel');
      if (sp) sp.scrollTop = 0;
      setTimeout(() => { const rn = document.getElementById('req-name'); if (rn) rn.focus(); }, 120);
    };
    const showSignIn = () => {
      if (!container) return;
      container.classList.remove('right-panel-active');
      const sip = container.querySelector('.signin-panel');
      if (sip) sip.scrollTop = 0;
      setTimeout(() => { const uEl = document.getElementById('u'); if (uEl) uEl.focus(); }, 120);
    };
    if (signUpBtn) signUpBtn.onclick = showSignUp;
    if (mobReqBtn) mobReqBtn.onclick = showSignUp;
    if (signInBtn) signInBtn.onclick = showSignIn;
    if (backBtn) backBtn.onclick = showSignIn;
    const u = document.getElementById('u');
    if (u) u.focus();
    const clearP = () => {
      const pEl = document.getElementById('p');
      if (pEl) pEl.value = '';
    };
    clearP();
    setTimeout(clearP, 60);
    setTimeout(clearP, 300);
  }

  /* ---------- MODULE 1, 2, 3, 4: ADMINISTRATOR WORKSPACE CONSOLE ---------- */
  async function pageAdmin(noticeMsg = '') {
    removeExistingModal();
    loading('Loading Administration Console & Audit Ledger...');
    try {
      const [curPolicy, profile, staffList, mcdaWeights, auditLogs, accountRequests, passwordResetRequests, suppliers, offers, allSummaries, supplierRequests] = await Promise.all([
        API.getPolicy(),
        API.getCompanyProfile(),
        API.listStaff(),
        API.getMcdaWeights(),
        API.listAuditLogs(),
        API.listAccountRequests(),
        API.listPasswordResetRequests(),
        API.listSuppliers(),
        API.listOffers(),
        API.listSummaries(),
        API.listSupplierRequests()
      ]);

      if (profile) applyBranding(profile);

      const totalWeights = (mcdaWeights.cost || 0) + (mcdaWeights.stock || 0) + (mcdaWeights.freshness || 0) + (mcdaWeights.consolidation || 0);
      const isWeightValid = totalWeights === 100;
      const pendingCount = (accountRequests || []).filter(r => r.status === 'PENDING').length;
      const pendingResetCount = (passwordResetRequests || []).filter(r => r.status === 'PENDING').length;
      const pendingSupplierRequestsCount = (supplierRequests || []).filter(r => r.status === 'PENDING').length;
      const pendingApprovalCount = (allSummaries || []).filter(s => s.approval_status !== 'APPROVED').length;
      const requiredQuotes = profile.required_supplier_quotes || 3;

      setMain(
        '<div class="stack" style="gap:20px;">' +
          '<!-- ADMIN HEADER PROFILE -->' +
          '<div class="row between" style="align-items:flex-end;">' +
            '<div>' +
              '<div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">' +
                '<h1 style="font-size:26px; font-weight:700; margin:0;">Enterprise Administration Console</h1>' +
                '<span class="badge ok">Role: Administrator (Auditor)</span>' +
              '</div>' +
              '<p class="sub">Configure enterprise business profile, adjust dynamic MCDA utility weights, manage staff account succession, and audit immutable event records.</p>' +
            '</div>' +
            '<div class="row" style="gap:8px;">' +
              '<button type="button" class="btn primary" onclick="document.getElementById(\'prof-name\').focus();" data-guide-key="admin-edit-profile">Edit Business Profile</button>' +
            '</div>' +
          '</div>' +

          (noticeMsg ? alertBox('ok', esc(noticeMsg), 'status') : '') +

          (pendingApprovalCount > 0 
            ? '<div class="alert warn" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:4px; background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.3);">'
              + '<div><strong style="color:#CA8A04;">⏳ Management Action Required:</strong> There are <strong>' + pendingApprovalCount + '</strong> Sourcing Summaries pending your administrative acknowledgment &amp; sign-off before purchase orders can be released.</div>'
              + '<a class="btn primary" href="#/summaries" style="background:#059669; border-color:#047857; color:#fff; font-weight:700; padding:6px 14px; font-size:12px;">Review &amp; Sign Summaries →</a>'
              + '</div>'
            : '') +

          '<!-- 4 METRIC STATS CARDS -->' +
          '<div class="preparer-metrics-grid">' +
            '<div class="metric-card"><div class="metric-icon">🏢</div><div><div class="metric-number" style="font-size:18px;">' + esc(profile.business_name) + '</div><div class="metric-label">Enterprise Business Profile</div></div></div>' +
            '<div class="metric-card"><div class="metric-icon">⏱️</div><div><div class="metric-number">' + curPolicy.max_age_days + ' Days</div><div class="metric-label">Max Quote Age Policy</div></div></div>' +
            '<div class="metric-card"><div class="metric-icon">🏬</div><div><div class="metric-number">' + suppliers.length + ' Vendors (Min ' + requiredQuotes + ')</div><div class="metric-label">Supplier Canvass Quorum</div></div></div>' +
            '<div class="metric-card"><div class="metric-icon">⚖️</div><div><div class="metric-number">' + mcdaWeights.cost + '% / ' + mcdaWeights.stock + '% / ' + mcdaWeights.freshness + '% / ' + mcdaWeights.consolidation + '%</div><div class="metric-label">MCDA Weights Ratio (Cost/Stock/Fresh/Cons)</div></div></div>' +
          '</div>' +

          '<!-- MODULE 1: ENTERPRISE BUSINESS PROFILE CARD -->' +
          '<section class="card stack" id="admin-profile-card" style="border-left:4px solid var(--teal); background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">🏢</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">Enterprise Business Profile &amp; Universal Branding</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Dynamically updates headers, footers, print job sheets, and document titles across all devices.</p>' +
                '</div>' +
              '</div>' +
              '<span class="badge ok">Dynamic Branding Active</span>' +
            '</div>' +

            '<form id="company-profile-form" class="stack" novalidate style="margin-top:10px;">' +
              '<div class="row" style="gap:12px;">' +
                '<div style="flex:2;">' +
                  '<label for="prof-name">Business / Company Name</label>' +
                  '<input id="prof-name" value="' + esc(profile.business_name) + '" required placeholder="e.g. AMGC Airconditioning Services">' +
                '</div>' +
                '<div style="flex:2;">' +
                  '<label for="prof-type">Industry / Trade Type</label>' +
                  '<input id="prof-type" value="' + esc(profile.business_type) + '" required placeholder="e.g. Commercial & Industrial HVAC Services">' +
                '</div>' +
              '</div>' +

              '<div class="row" style="gap:12px;">' +
                '<div style="flex:2;">' +
                  '<label for="prof-location">Headquarters Location / Official Address</label>' +
                  '<input id="prof-location" value="' + esc(profile.location) + '" required placeholder="e.g. V.V. Soliven Ave. II, Cainta, Rizal, Philippines">' +
                  '<div class="small" style="color:var(--mute); margin-top:2px;">Special characters will be formatted cleanly in footers and job sheets.</div>' +
                '</div>' +
                '<div style="flex:1.5;">' +
                  '<label for="prof-contact">Company Contact / Official Hotline</label>' +
                  '<input id="prof-contact" value="' + esc(profile.contact_number || '+63 (02) 8655-2491 / +63 917 123 4567') + '" required placeholder="e.g. +63 (02) 8655-2491 / +63 917 123 4567">' +
                  '<div class="small" style="color:var(--mute); margin-top:2px;">Printed on official BOM job sheets and headers.</div>' +
                '</div>' +
              '</div>' +

              '<div class="row" style="gap:12px;">' +
                '<div style="flex:1;">' +
                  '<label for="prof-curr-code">Currency Code</label>' +
                  '<input id="prof-curr-code" value="' + esc(profile.currency_code || 'PHP') + '" maxlength="3" required style="text-transform:uppercase;">' +
                '</div>' +
                '<div style="flex:1;">' +
                  '<label for="prof-curr-symbol">Currency Symbol</label>' +
                  '<input id="prof-curr-symbol" value="' + esc(profile.currency_symbol || '₱') + '" maxlength="4" required>' +
                '</div>' +
                '<div style="flex:1.5;">' +
                  '<label for="prof-age">Max Quote Age Threshold (Days)</label>' +
                  '<input id="prof-age" type="number" min="1" max="90" value="' + profile.max_quote_age_days + '" required>' +
                '</div>' +
                '<div style="flex:1.5;">' +
                  '<label for="prof-min-suppliers">Required Supplier Quotes</label>' +
                  '<input id="prof-min-suppliers" type="number" min="1" max="20" value="' + requiredQuotes + '" required title="Minimum competing supplier bids required for procurement audit compliance">' +
                '</div>' +
              '</div>' +

              '<div class="row" style="margin-top:4px;">' +
                '<button class="primary" type="button" data-action="save-company-profile">Save Enterprise Business Profile</button>' +
              '</div>' +
            '</form>' +
          '</section>' +

          '<!-- MODULE 1B: ACCREDITED SUPPLIER NETWORK DIRECTORY -->' +
          '<section class="card stack" id="admin-suppliers-card" style="border-left:4px solid #0D9488; background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">🏬</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">Accredited Supplier Network &amp; Vendor Directory (' + suppliers.length + ' Registered)</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Enterprise procurement network. Add and manage approved component vendors, regional depots, and wholesale distributors.</p>' +
                '</div>' +
              '</div>' +
              '<button type="button" class="btn primary" data-action="open-add-supplier-modal" data-guide-key="admin-add-supplier" style="font-weight:700;">+ Add Accredited Supplier</button>' +
            '</div>' +

            '<div class="tbl" style="margin-top:6px;">' +
              '<table>' +
                '<thead><tr><th>Supplier / Organization</th><th>Depot / Branch Location</th><th>Contact / Reference</th><th class="num">Curated Quotes</th><th>Accreditation</th><th>Actions</th></tr></thead>' +
                '<tbody>' +
                  (suppliers && suppliers.length ? suppliers.map(sup => {
                    const quoteCount = (offers || []).filter(o => o.supplier_id === sup.id).length;
                    const isAccredited = sup.accredited !== false;
                    return '<tr>' +
                      '<td><strong style="color:var(--ink);">' + esc(sup.name) + '</strong></td>' +
                      '<td class="small" style="color:var(--mute);">' + esc(sup.location || 'Philippines') + '</td>' +
                      '<td class="small" style="color:var(--mute);">' + esc(sup.contact || 'Accredited Depot') + '</td>' +
                      '<td class="num font-mono"><strong>' + quoteCount + '</strong> offers</td>' +
                      '<td>' + (isAccredited ? badge('ok', '✓ Accredited') : badge('gray', 'Suspended')) + '</td>' +
                      '<td>' +
                        '<div class="row" style="gap:6px; flex-wrap:wrap; align-items:center;">' +
                          '<a class="link small" href="#/catalog" onclick="window.__pendingCatalogSupplierFilter=\'' + esc(sup.id) + '\'">📦 View Catalog (' + quoteCount + ')</a>' +
                          '<button type="button" class="link small" data-action="edit-supplier" data-id="' + esc(sup.id) + '">✏️ Edit</button>' +
                          '<button type="button" class="btn ' + (isAccredited ? 'ghost' : 'primary') + '" style="padding:3px 8px; font-size:11.5px;" data-action="toggle-supplier-status" data-id="' + esc(sup.id) + '">' + (isAccredited ? 'Suspend' : 'Accredit') + '</button>' +
                          '<button type="button" class="btn btn-sm" style="padding:3px 8px; font-size:11.5px; background:rgba(239,68,68,0.15); color:#EF4444; border:1px solid rgba(239,68,68,0.3); font-weight:600;" data-action="delete-supplier" data-id="' + esc(sup.id) + '" data-name="' + esc(sup.name) + '" title="Permanently delete supplier">🗑️ Delete</button>' +
                        '</div>' +
                      '</td>' +
                    '</tr>';
                  }).join('') : '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--mute);">No suppliers registered yet. Click "+ Add Accredited Supplier" to register vendor partners.</td></tr>') +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</section>' +

          '<!-- MODULE 1C: SUPPLIER ACCREDITATION & VENDOR VETTING REQUESTS (GOVERNANCE QUEUE) -->' +
          '<section class="card stack" id="admin-supplier-requests-card" data-guide-key="admin-supplier-requests" style="border-left:4px solid #0D9488; background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:8px;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">🏢</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">Supplier Accreditation &amp; Vendor Due Diligence Requests</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Segregation of Duties (SoD) gate: Review, approve, or reject vendor accreditation proposals submitted by Catalog Maintainers before materials can be purchased.</p>' +
                '</div>' +
              '</div>' +
              '<span class="badge ' + (pendingSupplierRequestsCount > 0 ? 'warn' : 'ok') + '" id="sup-req-pending-badge">' + 
                (pendingSupplierRequestsCount > 0 ? (pendingSupplierRequestsCount + ' Pending Accreditation') : '✓ All Reviewed') + 
              '</span>' +
            '</div>' +

            (supplierRequests && supplierRequests.length ? (
              '<div class="tbl" style="margin-top:6px;">' +
                '<table>' +
                  '<thead><tr><th>Proposed Supplier &amp; Depot</th><th>Contact / Channel</th><th>Proposed By</th><th>Business Justification &amp; Terms</th><th>Status</th><th>Administrative Actions</th></tr></thead>' +
                  '<tbody>' +
                    supplierRequests.map(r => {
                      const isPending = r.status === 'PENDING';
                      const isApproved = r.status === 'APPROVED';
                      const isRejected = r.status === 'REJECTED';
                      return '<tr>' +
                        '<td><strong style="color:var(--ink);">' + esc(r.name) + '</strong><div class="small" style="color:var(--mute);">' + esc(r.location) + '</div></td>' +
                        '<td><span class="small">' + esc(r.contact) + '</span></td>' +
                        '<td><strong style="color:var(--ink);">' + esc(r.requested_by_name || r.requested_by) + '</strong><div class="small mono">@' + esc(r.requested_by) + '</div><div class="small" style="color:var(--mute);">' + esc(fmtTime(r.created_at)) + '</div></td>' +
                        '<td class="small" style="max-width:240px; line-height:1.35;">' + esc(r.notes || 'No justification specified.') + (r.reason ? '<div class="small" style="color:#EF4444; margin-top:3px; font-weight:600;">Declined: ' + esc(r.reason) + '</div>' : '') + '</td>' +
                        '<td>' + (isPending ? badge('warn', '⏳ Pending') : isApproved ? badge('ok', '✓ Accredited') : badge('bad', '✕ Rejected')) + '</td>' +
                        '<td>' +
                          (isPending ? (
                            '<div class="row" style="gap:6px; flex-wrap:wrap;">' +
                              '<button type="button" class="btn primary" style="padding:4px 12px; font-size:12px; background:var(--teal);" data-action="approve-supplier-request" data-id="' + esc(r.id) + '">✓ Approve &amp; Accredit</button>' +
                              '<button type="button" class="btn" style="padding:4px 10px; font-size:12px; border-color:#EF4444; color:#EF4444;" data-action="reject-supplier-request" data-id="' + esc(r.id) + '">✕ Reject</button>' +
                            '</div>'
                          ) : isApproved ? (
                            '<span class="small" style="color:var(--teal); font-weight:600;">✓ Active in Supplier Directory &middot; Approved by ' + esc(r.reviewed_by || 'Admin') + '</span>'
                          ) : (
                            '<span class="small" style="color:var(--mute);">Declined &middot; Reviewed by ' + esc(r.reviewed_by || 'Admin') + '</span>'
                          )) +
                        '</td>' +
                      '</tr>';
                    }).join('') +
                  '</tbody>' +
                '</table>' +
              '</div>'
            ) : (
              '<div class="card" style="text-align:center; padding:18px; background:var(--card-bg); margin-top:8px;">' +
                '<p class="small" style="color:var(--mute); margin:0;">No supplier accreditation requests pending. When catalog maintainers discover and propose new regional vendors, they will appear here for management due diligence.</p>' +
              '</div>'
            )) +
          '</section>' +

          '<!-- MODULE 3: INTERACTIVE MCDA UTILITY WEIGHT ENGINE -->' +
          '<section class="card stack" id="admin-mcda-card" data-guide-key="admin-mcda-engine" style="border-left:4px solid #8B5CF6; background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">⚖️</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">AI Procurement Engine Settings (MCDA Utility Weights)</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Adjust multi-criteria optimization ratios applied when ranking candidate quotations. Sum must equal exactly 100%.</p>' +
                '</div>' +
              '</div>' +
              '<span class="badge ' + (isWeightValid ? 'ok' : 'bad') + '" id="mcda-total-badge">' + (isWeightValid ? 'Total: 100% ✓ Balanced' : 'Total: ' + totalWeights + '% ⚠️ Must equal 100%') + '</span>' +
            '</div>' +

            '<div class="grid2" style="margin-top:10px; gap:14px;">' +
              '<div class="field">' +
                '<label for="mcda-cost">1. Lowest Unit Cost Weight (%): <strong id="mcda-cost-val">' + mcdaWeights.cost + '%</strong></label>' +
                '<input id="mcda-cost" data-guide-key="admin-mcda-cost" type="range" min="0" max="100" step="5" value="' + mcdaWeights.cost + '" data-bind="mcda-input">' +
                '<div class="small" style="color:var(--mute);">Maximizes fiscal savings per piece.</div>' +
              '</div>' +

              '<div class="field">' +
                '<label for="mcda-stock">2. Stock Buffer / Surplus Ratio (%): <strong id="mcda-stock-val">' + mcdaWeights.stock + '%</strong></label>' +
                '<input id="mcda-stock" data-guide-key="admin-mcda-stock" type="range" min="0" max="100" step="5" value="' + mcdaWeights.stock + '" data-bind="mcda-input">' +
                '<div class="small" style="color:var(--mute);">Protects against stockouts and order delays.</div>' +
              '</div>' +

              '<div class="field">' +
                '<label for="mcda-freshness">3. Quote Freshness / Recency (%): <strong id="mcda-freshness-val">' + mcdaWeights.freshness + '%</strong></label>' +
                '<input id="mcda-freshness" data-guide-key="admin-mcda-freshness" type="range" min="0" max="100" step="5" value="' + mcdaWeights.freshness + '" data-bind="mcda-input">' +
                '<div class="small" style="color:var(--mute);">Favors verified contemporary pricing.</div>' +
              '</div>' +

              '<div class="field">' +
                '<label for="mcda-consolidation">4. Supplier Multi-line Consolidation (%): <strong id="mcda-consolidation-val">' + mcdaWeights.consolidation + '%</strong></label>' +
                '<input id="mcda-consolidation" data-guide-key="admin-mcda-consolidation" type="range" min="0" max="100" step="5" value="' + mcdaWeights.consolidation + '" data-bind="mcda-input">' +
                '<div class="small" style="color:var(--mute);">Minimizes logistical and purchase order fragmentation.</div>' +
              '</div>' +
            '</div>' +

            '<div class="row between" data-guide-key="admin-mcda-presets" style="align-items:center; flex-wrap:wrap; gap:8px; margin-top:12px; padding:10px 14px; background:var(--card-bg); border-radius:8px; border:1px solid var(--line);">' +
              '<div class="small" style="font-weight:600; color:var(--mute);">Automatic Presets (100% Balanced):</div>' +
              '<div class="row" style="gap:6px; flex-wrap:wrap;">' +
                '<button type="button" class="btn" data-action="set-mcda-preset" data-cost="40" data-stock="30" data-freshness="20" data-consolidation="10" style="font-size:11.5px; padding:3px 8px;">Standard AMGC (40/30/20/10)</button>' +
                '<button type="button" class="btn" data-action="set-mcda-preset" data-cost="25" data-stock="25" data-freshness="25" data-consolidation="25" style="font-size:11.5px; padding:3px 8px;">Balanced (25/25/25/25)</button>' +
                '<button type="button" class="btn" data-action="set-mcda-preset" data-cost="55" data-stock="20" data-freshness="15" data-consolidation="10" style="font-size:11.5px; padding:3px 8px;">Cost Focus (55/20/15/10)</button>' +
                '<button type="button" class="btn" data-action="set-mcda-preset" data-cost="20" data-stock="45" data-freshness="25" data-consolidation="10" style="font-size:11.5px; padding:3px 8px;">Stock Buffer (20/45/25/10)</button>' +
              '</div>' +
            '</div>' +

            '<div class="row" style="margin-top:10px; gap:10px;">' +
              '<button class="primary" type="button" data-action="save-mcda-weights" id="saveMcdaBtn"' + (isWeightValid ? '' : ' disabled') + ' data-guide-key="admin-mcda-save" style="font-weight:700;">Save MCDA Utility Weights</button>' +
              '<button type="button" class="btn" data-action="auto-balance-mcda" data-guide-key="admin-mcda-autobalance" style="font-size:13px;">⚡ Auto-Balance to 100%</button>' +
            '</div>' +
          '</section>' +

          '<!-- MODULE 2B: STAFF ACCOUNT ACCESS & PROVISIONING REQUESTS -->' +
          '<section class="card stack" id="admin-requests-card" data-guide-key="admin-account-requests" style="border-left:4px solid #06B6D4; background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">👥</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">Staff Account Access &amp; Provisioning Requests</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Review, approve, or reject employee registration requests and issue role credentials.</p>' +
                '</div>' +
              '</div>' +
              '<span class="badge ' + (pendingCount > 0 ? 'warn' : 'ok') + '" id="req-pending-badge">' + (pendingCount > 0 ? (pendingCount + ' Pending Review') : '✓ All Reviewed') + '</span>' +
            '</div>' +

            (accountRequests && accountRequests.length ? (
              '<div class="tbl" style="margin-top:6px;">' +
                '<table>' +
                  '<thead><tr><th>Applicant / Username</th><th>Requested Role</th><th>Submitted Time</th><th>Review Status</th><th>Administrative Actions</th></tr></thead>' +
                  '<tbody>' +
                    accountRequests.map(r => {
                      const isPending = r.status === 'PENDING';
                      const isApproved = r.status === 'APPROVED';
                      const isRejected = r.status === 'REJECTED';
                      return '<tr>' +
                        '<td><strong style="color:var(--ink);">' + esc(r.name) + '</strong><div class="small mono">@' + esc(r.username) + '</div></td>' +
                        '<td><span class="badge ' + (r.role === 'maintainer' ? 'info' : 'ok') + '">' + esc(r.role) + '</span>' + ((r.recovery_pin || r.security_question) ? '<div class="small" style="color:var(--teal); margin-top:3px;">🛡️ PIN &amp; Sec. Q Set</div>' : '') + '</td>' +
                        '<td><span class="small">' + esc(fmtTime(r.created_at)) + '</span></td>' +
                        '<td>' + (isPending ? badge('warn', '⏳ Pending Review') : isApproved ? badge('ok', '✓ Approved &amp; Active') : badge('bad', '✕ Rejected')) + '</td>' +
                        '<td>' +
                          (isPending ? (
                            '<div class="row" style="gap:6px; flex-wrap:wrap;">' +
                              '<button type="button" class="btn primary" style="padding:4px 12px; font-size:12px; background:var(--teal);" data-action="approve-account-request" data-id="' + esc(r.id) + '">✓ Approve &amp; Activate</button>' +
                              '<button type="button" class="btn" style="padding:4px 10px; font-size:12px; border-color:#EF4444; color:#EF4444;" data-action="reject-account-request" data-id="' + esc(r.id) + '">✕ Reject</button>' +
                            '</div>'
                          ) : isApproved ? (
                            '<span class="small" style="color:var(--teal); font-weight:600;">✓ Active in Staff Directory &middot; Approved by ' + esc(r.reviewed_by || 'Admin') + '</span>'
                          ) : (
                            '<span class="small" style="color:var(--mute);">Declined &middot; Reviewed by ' + esc(r.reviewed_by || 'Admin') + '</span>'
                          )) +
                        '</td>' +
                      '</tr>';
                    }).join('') +
                  '</tbody>' +
                '</table>' +
              '</div>'
            ) : (
              '<div class="card" style="text-align:center; padding:18px; background:var(--card-bg); margin-top:8px;">' +
                '<p class="small" style="color:var(--mute); margin:0;">No account provisioning requests submitted yet. When technicians or catalog maintainers request an account at the Sign In portal, their submissions will appear here for administrator authorization.</p>' +
              '</div>'
            )) +
          '</section>' +

          '<!-- MODULE 2C: IDENTITY-VERIFIED PASSWORD RESET REQUESTS (ANTI-IMPOSTOR QUEUE) -->' +
          '<section class="card stack" id="admin-password-resets-card" data-guide-key="admin-password-resets" style="border-left:4px solid #F59E0B; background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">🔑</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">Identity-Verified Password Reset Requests</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Only staff requests that passed anti-impostor 6-Digit PIN &amp; Security Question verification reach this queue. Unverified / impostor attempts are blocked &amp; logged.</p>' +
                '</div>' +
              '</div>' +
              '<span class="badge ' + (pendingResetCount > 0 ? 'warn' : 'ok') + '" id="pwr-pending-badge">' + (pendingResetCount > 0 ? (pendingResetCount + ' Pending Approval') : '✓ All Clear') + '</span>' +
            '</div>' +

            (passwordResetRequests && passwordResetRequests.length ? (
              '<div class="tbl" style="margin-top:6px;">' +
                '<table>' +
                  '<thead><tr><th>Staff Member / Username</th><th>Role</th><th>Anti-Impostor Proof</th><th>Submitted Time</th><th>Status</th><th>Administrative Actions</th></tr></thead>' +
                  '<tbody>' +
                    passwordResetRequests.map(r => {
                      const isPending = r.status === 'PENDING';
                      const isApproved = r.status === 'APPROVED';
                      return '<tr>' +
                        '<td><strong style="color:var(--ink);">' + esc(r.name) + '</strong><div class="small mono">@' + esc(r.username) + '</div></td>' +
                        '<td><span class="badge ' + (r.role === 'maintainer' ? 'info' : 'ok') + '">' + esc(r.role) + '</span></td>' +
                        '<td><span class="badge ok">🛡️ Verified: ' + esc(r.verification_method || 'PIN / Sec. Question') + '</span></td>' +
                        '<td><span class="small">' + esc(fmtTime(r.created_at)) + '</span></td>' +
                        '<td>' + (isPending ? badge('warn', '⏳ Pending Approval') : isApproved ? badge('ok', '✓ Password Updated') : badge('bad', '✕ Declined')) + '</td>' +
                        '<td>' +
                          (isPending ? (
                            '<div class="row" style="gap:6px; flex-wrap:wrap;">' +
                              '<button type="button" class="btn primary" style="padding:4px 12px; font-size:12px; background:var(--teal);" data-action="approve-password-reset" data-id="' + esc(r.id) + '">✓ Approve Reset</button>' +
                              '<button type="button" class="btn" style="padding:4px 10px; font-size:12px; border-color:#EF4444; color:#EF4444;" data-action="reject-password-reset" data-id="' + esc(r.id) + '">✕ Reject</button>' +
                            '</div>'
                          ) : isApproved ? (
                            '<span class="small" style="color:var(--teal); font-weight:600;">✓ Password Activated &middot; Approved by ' + esc(r.reviewed_by || 'Admin') + '</span>'
                          ) : (
                            '<span class="small" style="color:var(--mute);">' + esc(r.reason || 'Declined') + ' &middot; Reviewed by ' + esc(r.reviewed_by || 'Admin') + '</span>'
                          )) +
                        '</td>' +
                      '</tr>';
                    }).join('') +
                  '</tbody>' +
                '</table>' +
              '</div>'
            ) : (
              '<div class="card" style="text-align:center; padding:18px; background:var(--card-bg); margin-top:8px;">' +
                '<p class="small" style="color:var(--mute); margin:0;">No pending password reset requests. When BOM Preparers or Catalog Maintainers verify their 6-Digit PIN or Security Question via <strong>Forgot password?</strong>, their verified reset appears here for approval. Administrators can self-recover immediately using 2-Factor (PIN + Security Question).</p>' +
              '</div>'
            )) +
          '</section>' +

          '<!-- MODULE 2: AUTHORIZED STAFF LIFECYCLE & SUCCESSION -->' +
          '<section class="card stack" id="admin-staff-card" data-guide-key="admin-staff-lifecycle">' +
            '<div class="row between" style="align-items:center;">' +
              '<div>' +
                '<h2 style="font-size:18px; font-weight:700;">Authorized Staff Lifecycle &amp; Role Succession</h2>' +
                '<p class="small" style="color:var(--mute);">Manage role handovers and soft deactivations without compromising historical audit foreign keys.</p>' +
              '</div>' +
              '<span class="badge ok">Strict RBAC</span>' +
            '</div>' +

            '<div class="tbl" style="margin-top:6px;">' +
              '<table>' +
                '<thead><tr><th>Staff Member / Username</th><th>Assigned Role</th><th>Account Status</th><th>Succession &amp; Access Actions</th></tr></thead>' +
                '<tbody>' +
                  staffList.map(u => {
                    const isAdmin = u.role === 'administrator' || u.role === 'admin';
                    return '<tr>' +
                      '<td><strong style="color:var(--ink);">' + esc(u.name) + '</strong><div class="small mono">@' + esc(u.username) + '</div></td>' +
                      '<td><span class="badge ' + (isAdmin ? 'warn' : 'ok') + '">' + esc(u.role) + '</span></td>' +
                      '<td>' + (u.is_active ? badge('ok', '✓ Active') : badge('bad', '⚠️ Deactivated')) + '</td>' +
                      '<td>' +
                        '<div class="row" style="gap:6px; flex-wrap:wrap;">' +
                          (!isAdmin ? '<button type="button" class="btn" style="padding:4px 10px; font-size:12px;" data-action="promote-staff" data-id="' + esc(u.id) + '">👑 Promote to Admin</button>' : '<span class="small" style="color:var(--mute); padding:4px 0;">Primary Auditor</span>') +
                          '<button type="button" class="btn ' + (u.is_active ? 'ghost' : 'primary') + '" style="padding:4px 10px; font-size:12px;" data-action="toggle-staff-status" data-id="' + esc(u.id) + '">' + (u.is_active ? 'Deactivate' : 'Reactivate') + '</button>' +
                          (!isAdmin ? '<button type="button" class="btn btn-sm" style="padding:4px 8px; font-size:12px; background:rgba(239,68,68,0.12); color:#EF4444; border:1px solid rgba(239,68,68,0.25);" data-action="delete-staff" data-id="' + esc(u.id) + '" data-name="' + esc(u.name) + '" title="Permanently delete test/mistaken account">🗑️ Delete</button>' : '') +
                        '</div>' +
                      '</td>' +
                    '</tr>';
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>' +
            '<div class="alert info" style="font-size:12.5px; line-height:1.5; margin-top:8px;">' +
              '<strong>Soft Deactivation Policy:</strong> Resigned or departed employees are marked as Deactivated rather than deleted. Deactivated staff cannot log in, create BOMs, or freeze estimates, while past snapshots maintain foreign-key integrity.' +
            '</div>' +
          '</section>' +

          '<!-- MODULE 4: IMMUTABLE AUDIT EVENT LEDGER TABLE -->' +
          '<section class="card stack" id="admin-audit-ledger-card" data-guide-key="admin-audit-ledger">' +
            '<div class="row between" style="align-items:center;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">📜</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">Immutable Audit Event Ledger</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Cryptographically attributable provenance trail synchronized with Supabase PostgreSQL.</p>' +
                '</div>' +
              '</div>' +
              '<button type="button" class="btn" data-action="refresh-audit-logs">🔄 Refresh Ledger</button>' +
            '</div>' +

            '<div class="tbl" style="margin-top:6px; max-height:360px; overflow-y:auto;">' +
              '<table>' +
                '<thead><tr><th>Timestamp</th><th>Actor / Role</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>' +
                '<tbody>' +
                  (auditLogs && auditLogs.length ? auditLogs.map(l => {
                    let actionBadge = badge('gray', esc(l.action));
                    if (l.action === 'PROFILE_UPDATE') actionBadge = badge('ok', 'PROFILE_UPDATE');
                    else if (l.action === 'STAFF_STATUS_CHANGE') actionBadge = badge('warn', 'STAFF_CHANGE');
                    else if (l.action === 'POLICY_UPDATE') actionBadge = badge('ok', 'POLICY_UPDATE');
                    else if (l.action === 'SUMMARY_SAVE') actionBadge = badge('ok', 'SUMMARY_SAVE');
                    else if (l.action === 'SECURITY_RESET_FAILED' || l.action === 'SECURITY_ACCOUNT_LOCKOUT' || l.action === 'PASSWORD_RESET_REJECTED') actionBadge = badge('bad', esc(l.action));
                    else if (l.action === 'PASSWORD_RESET_REQUESTED') actionBadge = badge('warn', 'PASSWORD_RESET_REQUESTED');
                    else if (l.action === 'PASSWORD_RESET_APPROVED' || l.action === 'ADMIN_PASSWORD_RECOVERED' || l.action === 'SECURITY_CREDENTIALS_UPDATED') actionBadge = badge('ok', esc(l.action));

                    return '<tr>' +
                      '<td class="small mono" style="white-space:nowrap;">' + esc(l.timestamp || fmtTime(l.created_at)) + '</td>' +
                      '<td><strong style="color:var(--ink); font-size:13px;">' + esc(l.actor || l.performed_by || 'System') + '</strong></td>' +
                      '<td>' + actionBadge + '</td>' +
                      '<td class="small mono" style="color:var(--mute);">' + esc(l.target || 'System') + '</td>' +
                      '<td class="small" style="color:var(--ink);">' + esc(l.details || '') + '</td>' +
                    '</tr>';
                  }).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--mute);">No audit events recorded yet.</td></tr>') +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</section>' +

          '<!-- SUPABASE CLOUD SYNC & STATUS CARD -->' +
          '<section class="card stack" style="border-left:4px solid #10B981; background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">☁️</span>' +
                '<div>' +
                  '<h2 style="font-size:18px; font-weight:700; margin:0;">Supabase Cloud PostgreSQL Database</h2>' +
                  '<p class="small" style="color:var(--mute); margin:0;">Live Cloud Backend &middot; <span class="mono">https://xahcgiwwyaskazgbgejh.supabase.co</span></p>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span class="badge ok" id="cloudStatusBadge">🟢 Cloud Connected</span>' +
                '<span class="badge ok" id="supabaseRealtimeBadge">⚡ Realtime Synchronized</span>' +
              '</div>' +
            '</div>' +
            '<div class="row" style="gap:10px; margin-top:8px;">' +
              '<button type="button" class="btn" data-action="test-cloud-connection" data-guide-key="admin-test-latency">⚡ Test Supabase Latency</button>' +
              '<button type="button" class="btn primary" data-action="sync-cloud-data" data-guide-key="admin-supabase-sync">🔄 Sync Local Catalog &amp; BOMs to Supabase</button>' +
            '</div>' +
            '<div id="cloudStatusOutput" class="small mono" style="margin-top:6px; color:var(--mute);">Ready to sync catalog_offers, bom_items, company_settings, and audit_logs.</div>' +
          '</section>' +
        '</div>'
      );
    } catch (e) { errorPage(e); }
  }

  function pageHome() {
    if (isAdminUser()) return pageAdmin();
    if (me && me.capabilities && me.capabilities.includes('lists')) return go('#/lists');
    if (me && me.capabilities && me.capabilities.includes('catalog')) return go('#/catalog');
    pageLanding();
  }

  function pageLanding() {
    landing = true;
    $app.innerHTML = window.PC_LANDING.html();
    renderShell();
    window.PC_LANDING.mount();
    applyBranding(companyProfile);
    if (window.__pendingScrollTarget) {
      const tgt = window.__pendingScrollTarget;
      window.__pendingScrollTarget = null;
      setTimeout(() => {
        const el = document.getElementById(tgt);
        if (el) {
          if (window.PC_SMOOTH_SCROLL) window.PC_SMOOTH_SCROLL.scrollToElement(el);
          else el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
      }, 100);
    } else {
      window.scrollTo(0, 0);
      if (window.PC_SMOOTH_SCROLL) window.PC_SMOOTH_SCROLL.sync(0);
    }
  }

  /* ---------- CATALOG WORKSPACE (MAINTAINER & ADMIN) ---------- */
  function canManageCatalog() {
    return me && (me.role === 'maintainer' || me.role === 'admin' || me.role === 'administrator' || (me.capabilities && me.capabilities.includes('catalog')));
  }

  async function pageCatalog(search) {
    if (!me) return go('#/login');
    if (!canManageCatalog()) return go('#/lists');
    removeExistingModal();
    loading('Loading catalog...');
    try {
      const [parts, offers, sups, uploadLogs, supReqs] = await Promise.all([
        API.listParts(),
        API.listOffers(),
        API.listSuppliers(),
        API.listSupplierUploadLogs(),
        API.listSupplierRequests()
      ]);
      window.__cat = { parts, offers, sups, uploadLogs: uploadLogs || [], supReqs: supReqs || [] };
      if (window.__pendingCatalogSupplierFilter) {
        catalogSupplierFilter = window.__pendingCatalogSupplierFilter;
        selectedSupplierDashId = window.__pendingCatalogSupplierFilter;
        catalogWorkspaceView = 'SUPPLIER';
        window.__pendingCatalogSupplierFilter = null;
      }
      if (!selectedSupplierDashId || !sups.some((s) => s.id === selectedSupplierDashId)) {
        selectedSupplierDashId = (sups[0] && sups[0].id) || null;
      }
      drawCatalog(search || '');
    } catch (e) { errorPage(e); }
  }

  function getOfferAgeDays(checkedDate) {
    if (!checkedDate) return 999;
    const baseDate = new Date();
    const checkDate = new Date(checkedDate + 'T12:00:00Z');
    const diff = Math.floor((baseDate - checkDate) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  }

  function removeExistingModal() {
    const ids = [
      'offerModalOverlay',
      'aiImportModalOverlay',
      'aiQuoteIngestModalOverlay',
      'forgotPasswordModalOverlay',
      'mySecurityModalOverlay',
      'supplierModalOverlay',
      'supplierRequestModalOverlay',
      'viewSupplierRequestsModalOverlay',
      'termsModalOverlay',
      'newPoModalOverlay',
      'poActionModalOverlay'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.catalog-modal-overlay, .modal-overlay').forEach(el => el.remove());
  }
  window.removeExistingModal = removeExistingModal;

  /* ---------- TERMS AND CONDITIONS MODAL ---------- */
  function renderTermsModal() {
    removeExistingModal();
    const overlay = document.createElement('div');
    overlay.id = 'termsModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:680px;">
        <div class="catalog-modal-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:22px;">📜</span>
              <h2 style="font-size:20px; font-weight:700; margin:0;">Terms &amp; Conditions &amp; Governance Policy</h2>
            </div>
            <p class="small" style="color:var(--mute); margin-top:2px;">AMGC Airconditioning Services &middot; ICCT Colleges Project Nexus (CEDT)</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-terms-modal" aria-label="Close modal">&times;</button>
        </div>

        <div class="terms-content-box">
          <h3>1. Purpose &amp; Procurement Authorization</h3>
          <p>PartsCompare is an auditable procurement intelligence and multi-criteria BOM reconciliation platform configured exclusively for authorized personnel of AMGC Airconditioning Services and ICCT Colleges Project Nexus. Any unauthorized access, scraping, or manipulation of pricing data is strictly prohibited.</p>

          <h3>2. 14-Day Quotation Freshness Compliance</h3>
          <p>Per enterprise sourcing policy, all supplier price bids must have a verified checked date within fourteen (14) calendar days. Stale quotations are automatically excluded from BOM evaluations to ensure real-time purchasing integrity.</p>

          <h3>3. Full Line Coverage &amp; Anti-Split-Shipment Policy</h3>
          <p>Component line items must be fulfilled 100% by a single accredited supplier per line. Split orders across multiple vendors for the same part number are prohibited to maintain warranty coverage and minimize logistics overhead.</p>

          <h3>4. Confidentiality of 6-Digit PIN &amp; Anti-Impostor Security</h3>
          <p>Your 6-digit Security PIN and secret security question are configured <strong>ONE TIME</strong> during registration. They serve as cryptographic identity verification for self-service password recovery. You are responsible for preserving their confidentiality. If lost, account recovery requires physical verification with the System Administrator.</p>

          <h3>5. Immutable Snapshot Auditing</h3>
          <p>Every saved BOM sourcing summary is frozen with an SHA-256 cryptographic review fingerprint. Once frozen, the prices, supplier assignments, and AI executive explanations cannot be altered, providing a legally auditable permanent record for Philippine tax (BIR RA 9337) and accounting compliance.</p>
        </div>

        <div class="row" style="gap:10px; margin-top:10px;">
          <button type="button" class="btn primary" data-action="accept-terms-modal" style="flex:1; height:42px; font-weight:700;">✓ I Understand and Accept</button>
          <button type="button" class="btn" data-action="close-terms-modal" style="height:42px;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) removeExistingModal();
    });
  }

  function renderForgotPasswordModal() {
    removeExistingModal();
    if (!fpState) return;

    const ch = fpState.challenge;
    const isAdmin = ch && ch.is_admin;
    const vMode = isAdmin ? 'both' : (fpState.verifyMode || 'both');
    const showPin = vMode === 'both' || vMode === 'pin';
    const showQuestion = vMode === 'both' || vMode === 'question';

    let bodyHtml = '';
    if (fpState.step === 1) {
      bodyHtml = `
        <div class="alert info" style="font-size:12.5px; line-height:1.45;">
          <strong>Anti-Impostor Identity Recovery:</strong> Enter your registered username to verify your identity via your <strong>6-Digit Recovery PIN</strong> and/or <strong>Unique Security Question</strong> (no external email required).
        </div>
        ${fpState.error ? alertBox('bad', esc(fpState.error), 'alert') : ''}
        <form id="fp-lookup-form" class="stack" novalidate style="gap:12px; margin-top:4px;">
          <div>
            <label for="fp-username">Registered Username</label>
            <input id="fp-username" placeholder="e.g. dave_pm, pearl_dba, or karen_admin" value="${esc(fpState.username || '')}" autocomplete="username" required>
          </div>
          <div class="row" style="gap:8px; justify-content:flex-end;">
            <button type="button" class="btn" data-action="close-forgot-password">Cancel</button>
            <button type="submit" class="btn primary" id="btn-fp-lookup">Verify Account &amp; Continue →</button>
          </div>
        </form>
        <details style="margin-top:6px; font-size:12px; color:var(--mute); background:var(--card-subtle); padding:8px 12px; border-radius:8px; border:1px solid var(--line);">
          <summary style="cursor:pointer; font-weight:600; color:var(--ink);">🧪 Pre-configured Demo PINs &amp; Security Answers (Testing Reference)</summary>
          <div class="stack" style="gap:4px; margin-top:6px; line-height:1.4;">
            <div>• <strong>@dave_pm</strong> (BOM Preparer): PIN <code class="mono">240811</code> &middot; Question: <em>Favorite HVAC Tool</em> &middot; Answer: <code class="mono">manifold gauge</code></div>
            <div>• <strong>@pearl_dba</strong> (Catalog Maintainer): PIN <code class="mono">350922</code> &middot; Question: <em>First Elementary School</em> &middot; Answer: <code class="mono">san roque elementary</code></div>
            <div>• <strong>@karen_admin</strong> (Administrator &middot; 2FA): PIN <code class="mono">890415</code> &middot; Question: <em>Birthplace City</em> &middot; Answer: <code class="mono">manila</code></div>
          </div>
        </details>
      `;
    } else if (fpState.step === 2 && ch) {
      bodyHtml = `
        <div class="row between" style="align-items:center; background:var(--card-subtle); padding:10px 12px; border-radius:8px; border:1px solid var(--line);">
          <div>
            <strong style="color:var(--ink);">${esc(ch.name)}</strong>
            <span class="small mono" style="color:var(--mute); margin-left:6px;">@${esc(ch.username)}</span>
            <span class="badge ${isAdmin ? 'warn' : 'ok'}" style="margin-left:6px;">${esc(ch.role)}</span>
          </div>
          <button type="button" class="link small" data-action="fp-change-user">Change user</button>
        </div>

        ${isAdmin ? `
          <div class="alert warn" style="font-size:12.5px; line-height:1.45;">
            🛡️ <strong>Administrator 2-Factor Self-Recovery:</strong> Administrator accounts require <strong>BOTH</strong> your 6-Digit Recovery PIN and your Unique Security Question Answer to recover access immediately.
          </div>
        ` : `
          <div class="alert info" style="font-size:12.5px; line-height:1.45;">
            🛡️ <strong>Anti-Impostor Gate:</strong> Verify your identity below. Only verified requests reach the Admin Console for approval; wrong attempts are blocked and lock after 5 tries.
          </div>
          <div class="signup-tabs" role="tablist" aria-label="Verification Method" style="margin-bottom:2px;">
            <button type="button" class="signup-tab-btn ${vMode === 'both' ? 'active' : ''}" data-action="fp-set-verify-mode" data-mode="both">Both (2FA)</button>
            <button type="button" class="signup-tab-btn ${vMode === 'pin' ? 'active' : ''}" data-action="fp-set-verify-mode" data-mode="pin">6-Digit PIN</button>
            <button type="button" class="signup-tab-btn ${vMode === 'question' ? 'active' : ''}" data-action="fp-set-verify-mode" data-mode="question">Security Question</button>
          </div>
        `}

        ${fpState.error ? alertBox('bad', esc(fpState.error), 'alert') : ''}

        <form id="forgot-password-form" class="stack" novalidate style="gap:10px;">
          ${showPin ? `
            <div>
              <label for="fp-pin">6-Digit Security PIN</label>
              <input id="fp-pin" type="password" inputmode="numeric" maxlength="6" class="pin-input-mono" placeholder="••••••" value="${esc(fpState.pin || '')}" autocomplete="off">
            </div>
          ` : ''}

          ${showQuestion ? `
            <div style="background:var(--card-subtle); padding:8px 12px; border-radius:8px; border:1px solid var(--line);">
              <div class="small" style="color:var(--mute); font-weight:600;">Registered Security Question:</div>
              <div style="font-size:13.5px; font-weight:700; color:var(--ink); margin-top:2px;" id="fp-question-text">${esc(ch.security_question)}</div>
            </div>
            <div>
              <label for="fp-sec-answer">Secret Security Answer</label>
              <input id="fp-sec-answer" type="text" placeholder="Enter your secret answer (case-insensitive)" value="${esc(fpState.secAnswer || '')}" autocomplete="off">
            </div>
          ` : ''}

          <div class="row" style="gap:10px;">
            <div class="field" style="flex:1;">
              <label for="fp-new-pass">New Password</label>
              <input id="fp-new-pass" type="password" placeholder="Min 8 chars (complex)" value="${esc(fpState.newPass || '')}" autocomplete="new-password">
            </div>
            <div class="field" style="flex:1;">
              <label for="fp-confirm-pass">Confirm New Password</label>
              <input id="fp-confirm-pass" type="password" placeholder="Re-type password" value="${esc(fpState.confirmPass || '')}" autocomplete="new-password">
            </div>
          </div>

          <div id="fp-pass-complexity" class="pass-complexity-box" style="margin-top:2px; padding:7px 10px; background:rgba(15, 23, 42, 0.4); border-radius:6px; border:1px solid var(--line); font-size:11.5px; line-height:1.4;">
            <div style="font-weight:600; color:var(--ink); margin-bottom:3px; display:flex; justify-content:space-between; align-items:center;">
              <span>🛡️ Enterprise Password Policy:</span>
              <span id="fp-pass-status-badge" class="badge bad" style="font-size:10px; padding:1px 6px;">Incomplete</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:2px 8px;">
              <span id="fp-chk-len" style="color:var(--mute); transition:color 0.15s ease;">○ 8+ Characters</span>
              <span id="fp-chk-upper" style="color:var(--mute); transition:color 0.15s ease;">○ Uppercase (A-Z)</span>
              <span id="fp-chk-lower" style="color:var(--mute); transition:color 0.15s ease;">○ Lowercase (a-z)</span>
              <span id="fp-chk-num" style="color:var(--mute); transition:color 0.15s ease;">○ Number (0-9)</span>
              <span id="fp-chk-sym" style="grid-column:span 2; color:var(--mute); transition:color 0.15s ease;">○ Special symbol (!@#$%^&*...)</span>
            </div>
          </div>

          <div class="row" style="gap:8px; justify-content:flex-end; margin-top:4px;">
            <button type="button" class="btn" data-action="close-forgot-password">Cancel</button>
            <button type="submit" class="btn primary" id="btn-fp-submit">${isAdmin ? 'Verify 2FA &amp; Recover Admin Password' : 'Verify Identity &amp; Submit Reset Request'}</button>
          </div>
        </form>
      `;
    } else if (fpState.step === 3) {
      bodyHtml = `
        ${alertBox('ok', esc(fpState.successMsg || 'Password recovery processed.'), 'status')}
        <div class="small" style="color:var(--mute); line-height:1.5;">
          ${fpState.mode === 'IMMEDIATE_ADMIN_RESET'
            ? 'Your Administrator credentials have been updated immediately via 2-Factor Verification. You may now sign in with your new password.'
            : 'Your identity-verified request is now queued under <strong>Identity-Verified Password Reset Requests</strong> in the Enterprise Administration Console. Once an Administrator clicks <strong>Approve Reset</strong>, your new password will become active.'}
        </div>
        <div class="row" style="justify-content:flex-end; margin-top:6px;">
          <button type="button" class="btn primary" id="btn-fp-done" data-action="close-forgot-password">Back to Sign In</button>
        </div>
      `;
    }

    const overlay = document.createElement('div');
    overlay.id = 'forgotPasswordModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:520px;">
        <div class="catalog-modal-header">
          <div>
            <h2 style="font-size:20px; font-weight:700; margin:0;">🔑 Forgot Password &amp; Identity Recovery</h2>
            <p class="small" style="color:var(--mute); margin-top:2px;">Anti-impostor verification for Staff &amp; Administrators</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-forgot-password" aria-label="Close modal">&times;</button>
        </div>
        ${bodyHtml}
      </div>
    `;
    document.body.appendChild(overlay);

    if (fpState.step === 2) {
      const npEl = document.getElementById('fp-new-pass');
      if (npEl) {
        updatePasswordComplexityUI(npEl.value, 'fp');
        npEl.addEventListener('input', () => {
          updatePasswordComplexityUI(npEl.value, 'fp');
        });
      }
    }
  }

  async function renderMySecurityModal(err = '', okMsg = '') {
    removeExistingModal();
    if (!me) return;
    let info;
    try {
      info = await API.getMySecuritySettings();
    } catch (e) {
      alert(e.message);
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'mySecurityModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:500px;">
        <div class="catalog-modal-header">
          <div>
            <h2 style="font-size:20px; font-weight:700; margin:0;">🛡️ Recovery PIN &amp; Security Question</h2>
            <p class="small" style="color:var(--mute); margin-top:2px;">Update anti-impostor recovery credentials for <strong>@${esc(info.username)}</strong> (${esc(info.role)})</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-my-security-modal" aria-label="Close modal">&times;</button>
        </div>

        ${err ? alertBox('bad', esc(err), 'alert') : ''}
        ${okMsg ? alertBox('ok', esc(okMsg), 'status') : ''}

        <form id="my-security-form" class="stack" novalidate style="gap:10px; margin-top:4px;">
          <div>
            <label for="sec-cur-pass">Current Account Password (Required to Authorize Changes)</label>
            <input id="sec-cur-pass" type="password" placeholder="Enter your current password" autocomplete="current-password" required>
          </div>
          <div>
            <label for="sec-new-pin">New 6-Digit Security PIN</label>
            <input id="sec-new-pin" type="password" inputmode="numeric" maxlength="6" class="pin-input-mono" placeholder="6 digits (avoid 123456 / 000000)" autocomplete="off" required>
          </div>
          <div>
            <label for="sec-new-q">Unique Security Question</label>
            <select id="sec-new-q">
              ${SECURITY_QUESTIONS.map(q => `<option value="${esc(q)}"${q === info.security_question ? ' selected' : ''}>${esc(q)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="sec-new-a">Secret Security Answer</label>
            <input id="sec-new-a" type="text" placeholder="Enter secret answer (case-insensitive, min 2 chars)" autocomplete="off" required>
          </div>
          <div class="row" style="gap:8px; justify-content:flex-end; margin-top:6px;">
            <button type="button" class="btn" data-action="close-my-security-modal">Close</button>
            <button type="submit" class="btn primary" id="btn-save-my-security">Save Recovery Credentials</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  let supplierForm = null;

  function renderSupplierModal() {
    removeExistingModal();
    if (!supplierForm || !supplierForm.isOpen) return;
    const f = supplierForm;
    const overlay = document.createElement('div');
    overlay.id = 'supplierModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:520px;">
        <div class="catalog-modal-header">
          <div>
            <h2 style="font-size:20px; font-weight:700; margin:0;">${f.id ? 'Edit Accredited Supplier' : 'Register Accredited Supplier'}</h2>
            <p class="small" style="color:var(--mute); margin-top:2px;">Enterprise vendor partner for competitive quotation evaluations.</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-supplier-modal" aria-label="Close modal">&times;</button>
        </div>

        ${f.error ? alertBox('bad', esc(f.error), 'alert') : ''}

        <form id="supplier-form" class="stack" novalidate style="gap:12px; margin-top:4px;">
          <div>
            <label for="sup-name">Supplier / Company Name</label>
            <input id="sup-name" placeholder="e.g. Apex Industrial Cold Supply Corp." value="${esc(f.name || '')}" required>
          </div>
          <div>
            <label for="sup-location">Depot / Branch Location</label>
            <input id="sup-location" placeholder="e.g. Mandaluyong &amp; Pasig City, Metro Manila" value="${esc(f.location || '')}" required>
          </div>
          <div>
            <label for="sup-contact">Contact Person / Invoice Notes</label>
            <input id="sup-contact" placeholder="e.g. Engr. Santos &bull; (02) 8888-1234 &bull; Net 30 terms" value="${esc(f.contact || '')}">
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="sup-accredited" ${f.accredited !== false ? 'checked' : ''} style="width:auto; cursor:pointer;">
            <label for="sup-accredited" style="margin:0; cursor:pointer;">Accredited Vendor Partner (Eligible for BOM Quoting)</label>
          </div>

          <div class="row" style="gap:8px; justify-content:flex-end; margin-top:6px;">
            <button type="button" class="btn" data-action="close-supplier-modal">Cancel</button>
            <button type="submit" class="btn primary" id="btn-save-supplier">${f.id ? 'Update Supplier' : 'Register Supplier'}</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
      const el = document.getElementById('sup-name');
      if (el) el.focus();
    }, 60);
  }

  let supplierRequestForm = null;

  function renderSupplierRequestModal() {
    removeExistingModal();
    if (!supplierRequestForm || !supplierRequestForm.isOpen) return;
    const f = supplierRequestForm;
    const overlay = document.createElement('div');
    overlay.id = 'supplierRequestModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:540px;">
        <div class="catalog-modal-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">🏢</span>
              <h2 style="font-size:20px; font-weight:700; margin:0;">Propose New Accredited Supplier</h2>
            </div>
            <p class="small" style="color:var(--mute); margin-top:2px;">Submit vendor accreditation request for Administrative review and corporate due diligence.</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-supplier-request-modal" onclick="removeExistingModal()" aria-label="Close modal">&times;</button>
        </div>

        ${f.error ? alertBox('bad', esc(f.error), 'alert') : ''}

        <div class="alert info" style="font-size:12px; line-height:1.4;">
          🛡️ <strong>Enterprise Governance &amp; SoD</strong>: Maintainers discover potential distributors in the market. To ensure compliance, an Administrator must verify trade accreditation (BIR 2303, DTI/SEC, warranty terms) before vendor materials can be evaluated.
        </div>

        <form id="supplier-request-form" class="stack" novalidate style="gap:11px; margin-top:4px;">
          <div>
            <label for="req-sup-name" style="font-weight:600; font-size:12.5px;">Supplier / Company Name *</label>
            <input id="req-sup-name" placeholder="e.g. Apex Refrigeration &amp; Industrial Supply" value="${esc(f.name || '')}" required>
          </div>
          <div>
            <label for="req-sup-location" style="font-weight:600; font-size:12.5px;">Depot / Branch Location *</label>
            <input id="req-sup-location" placeholder="e.g. Km. 19 Ortigas Ave. Ext., Pasig City" value="${esc(f.location || '')}" required>
          </div>
          <div>
            <label for="req-sup-contact" style="font-weight:600; font-size:12.5px;">Contact Person &amp; Phone / Email *</label>
            <input id="req-sup-contact" placeholder="e.g. Engr. Arnold Mendoza (+63 917 555 4892 / sales@apex.ph)" value="${esc(f.contact || '')}" required>
          </div>
          <div>
            <label for="req-sup-notes" style="font-weight:600; font-size:12.5px;">Business Justification &amp; Accreditation Reason *</label>
            <textarea id="req-sup-notes" rows="3" style="width:100%; font-family:inherit; font-size:13px; padding:8px 10px; border-radius:6px; border:1px solid var(--line); background:var(--input-bg); color:var(--ink);" placeholder="Explain why AMGC should accredit this vendor (e.g. OEM authorized distributor, exclusive trade discount, warranty policy, delivery coverage)..." required>${esc(f.notes || '')}</textarea>
          </div>

          <div class="row" style="gap:8px; justify-content:flex-end; margin-top:6px;">
            <button type="button" class="btn" data-action="close-supplier-request-modal" onclick="removeExistingModal()">Cancel</button>
            <button type="submit" class="btn primary" id="btn-submit-supplier-request" style="font-weight:700;">Submit for Admin Accreditation &rarr;</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        supplierRequestForm = null;
        removeExistingModal();
      }
    });
    setTimeout(() => {
      const el = document.getElementById('req-sup-name');
      if (el) el.focus();
    }, 60);
  }

  function renderViewSupplierRequestsModal(reqs) {
    removeExistingModal();
    const overlay = document.createElement('div');
    overlay.id = 'viewSupplierRequestsModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    const list = reqs || [];
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:760px; width:92%;">
        <div class="catalog-modal-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">📋</span>
              <h2 style="font-size:20px; font-weight:700; margin:0;">Supplier Accreditation Requests Tracker</h2>
            </div>
            <p class="small" style="color:var(--mute); margin-top:2px;">Track status of regional vendor proposals submitted for administrative due diligence.</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-view-supplier-requests-modal" onclick="removeExistingModal()" aria-label="Close modal">&times;</button>
        </div>

        <div class="row between" style="align-items:center;">
          <span class="small" style="color:var(--mute);">Total Proposals: <strong>${list.length}</strong></span>
          <button type="button" class="btn primary btn-sm" data-action="open-request-supplier-modal" style="font-size:12px; font-weight:700;">+ Propose Another Supplier</button>
        </div>

        ${list.length ? `
          <div class="tbl" style="max-height:360px; overflow-y:auto; margin-top:6px;">
            <table>
              <thead><tr><th>Supplier / Location</th><th>Contact</th><th>Business Justification</th><th>Status</th></tr></thead>
              <tbody>
                ${list.map(r => {
                  const isPending = r.status === 'PENDING';
                  const isApproved = r.status === 'APPROVED';
                  return `<tr>
                    <td>
                      <strong style="color:var(--ink);">${esc(r.name)}</strong>
                      <div class="small" style="color:var(--mute);">${esc(r.location)}</div>
                      <div class="small mono" style="color:var(--teal); font-size:11px;">Submitted ${esc(fmtTime(r.created_at))}</div>
                    </td>
                    <td class="small">${esc(r.contact)}</td>
                    <td class="small" style="max-width:240px; line-height:1.3;">
                      ${esc(r.notes || 'No notes.')}
                      ${r.reviewed_by ? `<div class="small" style="color:var(--mute); margin-top:4px; font-style:italic;">Reviewed by ${esc(r.reviewed_by)} ${r.reason ? `("${esc(r.reason)}")` : ''}</div>` : ''}
                    </td>
                    <td>
                      ${isPending ? badge('warn', '⏳ Pending Review') : isApproved ? badge('ok', '✓ Accredited') : badge('bad', '✕ Rejected')}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="card" style="text-align:center; padding:24px; background:var(--card-bg); margin-top:8px;">
            <p class="small" style="color:var(--mute); margin:0;">No supplier accreditation requests recorded yet. Click "+ Propose Another Supplier" to submit a new vendor proposal.</p>
          </div>
        `}

        <div class="row" style="justify-content:flex-end; margin-top:10px;">
          <button type="button" class="btn" data-action="close-view-supplier-requests-modal" onclick="removeExistingModal()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        removeExistingModal();
      }
    });
  }

  function renderSupplierCsvDashboardSection(maxAge) {
    const { parts, offers, sups } = window.__cat || { parts: [], offers: [], sups: [] };
    const uploadLogs = (window.__cat && window.__cat.uploadLogs) || [];

    if (!sups || !sups.length) {
      return (
        '<section class="card stack" style="border-left:4px solid #059669; background:var(--card-subtle);">' +
          '<div class="row between" style="align-items:center;">' +
            '<div>' +
              '<h2 style="font-size:19px; font-weight:700; margin:0;">🏢 Dedicated Supplier CSV &amp; Materials Dashboard</h2>' +
              '<p class="small" style="color:var(--mute); margin:0;">Register an accredited supplier first to manage their materials and upload bulk CSV price sheets.</p>' +
            '</div>' +
            '<button type="button" class="btn primary" data-action="open-add-supplier-modal" style="font-weight:700;">+ Register Accredited Supplier</button>' +
          '</div>' +
        '</section>'
      );
    }

    if (!selectedSupplierDashId || !sups.some((s) => s.id === selectedSupplierDashId)) {
      selectedSupplierDashId = sups[0].id;
    }

    const activeSup = sups.find((s) => s.id === selectedSupplierDashId) || sups[0];
    const supOffers = offers.filter((o) => o.supplier_id === activeSup.id);
    const supLogs = uploadLogs.filter((l) => l.supplier_id === activeSup.id);
    const supAddedLogs = supLogs.filter((l) => l.action === 'ADDED');
    const supUpdatedLogs = supLogs.filter((l) => l.action === 'UPDATED');

    let supFresh = 0;
    let supStale = 0;
    let supIncomplete = 0;
    supOffers.forEach((o) => {
      const missing = o.price_minor == null || o.recorded_quantity == null || !o.checked_date || !o.source_reference;
      const days = getOfferAgeDays(o.checked_date);
      if (missing) supIncomplete++;
      else if (days > maxAge) supStale++;
      else supFresh++;
    });

    const sq = (supplierDashSearch || '').trim().toLowerCase();
    const filteredSupOffers = supOffers.filter((o) => {
      if (!sq) return true;
      const part = parts.find((p) => p.id === o.part_id) || {};
      return (
        (part.exact_id || '').toLowerCase().includes(sq) ||
        (part.description || '').toLowerCase().includes(sq) ||
        (o.source_reference || '').toLowerCase().includes(sq)
      );
    });

    const isAccredited = activeSup.accredited !== false;

    return (
      '<div class="stack" id="dedicated-supplier-dashboard" style="gap:18px;">' +
        /* 1. SUPPLIER SELECTOR HEADER CARD */
        '<section class="card stack" style="border-left:4px solid #059669; background:var(--card-subtle);">' +
          '<div class="row between" style="align-items:flex-start; flex-wrap:wrap; gap:12px;">' +
            '<div>' +
              '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                '<span style="font-size:22px;">🏢</span>' +
                '<h2 style="font-size:20px; font-weight:700; margin:0;">Supplier Material CSV &amp; Update Dashboard</h2>' +
                '<span class="badge ok">Per-Supplier Bulk Update &amp; What\'s Added</span>' +
              '</div>' +
              '<p class="small" style="color:var(--mute); margin:4px 0 0;">Select a specific supplier below to upload a CSV file of all materials to be updated or added, and audit everything newly added on the same dashboard.</p>' +
            '</div>' +
            '<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;">' +
              '<label for="sup-dash-select" class="small" style="margin:0; font-weight:700; color:var(--ink);">Active Supplier:</label>' +
              '<select id="sup-dash-select" data-bind="sup-dash-select" style="min-width:240px; font-weight:600;">' +
                sups.map((s) => {
                  const cnt = offers.filter((o) => o.supplier_id === s.id).length;
                  const addCnt = uploadLogs.filter((l) => l.supplier_id === s.id && l.action === 'ADDED').length;
                  return '<option value="' + esc(s.id) + '"' + (s.id === activeSup.id ? ' selected' : '') + '>' +
                    esc(s.name) + ' (' + cnt + ' materials' + (addCnt ? ', +' + addCnt + ' added' : '') + ')' +
                  '</option>';
                }).join('') +
              '</select>' +
              (isAdminUser() 
                ? '<button type="button" class="btn" data-action="open-add-supplier-modal" style="font-weight:600;">+ Add Supplier</button>' 
                : '<button type="button" class="btn" data-action="open-request-supplier-modal" data-guide-key="catalog-request-supplier" style="font-weight:600; color:var(--teal);">🏢 Request Supplier</button>'
              ) +
            '</div>' +
          '</div>' +

          '<div class="supplier-selector-grid" style="margin-top:8px;">' +
            sups.map((s) => {
              const sOffs = offers.filter((o) => o.supplier_id === s.id);
              const sAdded = uploadLogs.filter((l) => l.supplier_id === s.id && l.action === 'ADDED').length;
              const sUpdated = uploadLogs.filter((l) => l.supplier_id === s.id && l.action === 'UPDATED').length;
              const isAct = s.id === activeSup.id;
              return (
                '<button type="button" class="supplier-select-card' + (isAct ? ' active' : '') + '" data-action="select-dash-supplier" data-id="' + esc(s.id) + '">' +
                  '<div class="row between" style="width:100%; align-items:center; gap:6px;">' +
                    '<strong style="font-size:14px; color:var(--ink);">🏬 ' + esc(s.name) + '</strong>' +
                    (isAct ? '<span class="badge ok" style="background:#059669; color:#fff;">Selected</span>' : '') +
                  '</div>' +
                  '<div class="small" style="color:var(--mute);">📍 ' + esc(s.location || 'Philippines') + '</div>' +
                  '<div class="row" style="gap:6px; flex-wrap:wrap; margin-top:2px;">' +
                    '<span class="badge info">' + sOffs.length + ' Materials</span>' +
                    (sAdded > 0 ? '<span class="badge ok" style="background:#10B981; color:#fff;">🆕 +' + sAdded + ' Added</span>' : '') +
                    (sUpdated > 0 ? '<span class="badge info">🔄 ' + sUpdated + ' Updated</span>' : '') +
                  '</div>' +
                '</button>'
              );
            }).join('') +
          '</div>' +
        '</section>' +

        /* 2. SELECTED SUPPLIER KPI METRICS */
        '<div class="preparer-metrics-grid">' +
          '<div class="metric-card">' +
            '<div class="metric-icon">📦</div>' +
            '<div>' +
              '<div class="metric-number">' + supOffers.length + '</div>' +
              '<div class="metric-label">Materials Listed (' + esc(activeSup.name.split(' ')[0]) + ')</div>' +
            '</div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-icon">✓</div>' +
            '<div>' +
              '<div class="metric-number" style="color:var(--ok);">' + supFresh + '</div>' +
              '<div class="metric-label">Fresh Materials (≤' + maxAge + 'd) &middot; ' + supStale + ' Stale</div>' +
            '</div>' +
          '</div>' +
          '<div class="metric-card" style="border-color:rgba(16,185,129,0.45);">' +
            '<div class="metric-icon">🆕</div>' +
            '<div>' +
              '<div class="metric-number" style="color:#059669;">' + supAddedLogs.length + '</div>' +
              '<div class="metric-label">What\'s Added (New Materials)</div>' +
            '</div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-icon">🔄</div>' +
            '<div>' +
              '<div class="metric-number" style="color:#0EA5E9;">' + supUpdatedLogs.length + '</div>' +
              '<div class="metric-label">Materials Updated via CSV</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* 3. DEDICATED SUPPLIER BULK CSV UPLOAD PANEL */
        '<section class="card stack" style="border:1.5px solid rgba(5, 150, 105, 0.38);">' +
          '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:10px;">' +
            '<div>' +
              '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                '<h3 style="font-size:17.5px; font-weight:700; margin:0;">📁 Upload CSV to Update / Add All Materials — ' + esc(activeSup.name) + '</h3>' +
                (isAccredited ? badge('ok', '✓ Accredited Vendor') : badge('gray', 'Suspended')) +
              '</div>' +
              '<p class="small" style="color:var(--mute); margin:3px 0 0;">Upload a supplier material CSV sheet to bulk-update prices &amp; stock for existing materials and automatically register any new materials under <strong>' + esc(activeSup.name) + '</strong>.</p>' +
            '</div>' +
            '<div class="row" style="gap:8px; flex-wrap:wrap;">' +
              '<button type="button" class="btn" onclick="exportSupplierMaterialsCsv(\'' + esc(activeSup.id) + '\')" style="font-weight:600;" title="Export this supplier\'s current materials to CSV for editing">📥 Export Current Materials CSV</button>' +
              '<button type="button" class="btn" onclick="downloadSupplierSampleUpdateCsv(\'' + esc(activeSup.id) + '\')" style="font-weight:600;" title="Download a ready-to-upload sample CSV with material updates + new items">🧪 Sample Update + New Materials CSV</button>' +
            '</div>' +
          '</div>' +

          '<input type="file" id="sup-specific-csv-input" accept=".csv" style="display:none;" onchange="handleDedicatedSupplierCsvUpload(event)">' +

          '<div class="supplier-csv-dropzone" id="sup-csv-dropzone" ' +
            'onclick="document.getElementById(\'sup-specific-csv-input\').click()" ' +
            'ondragover="handleSupDropzoneDragOver(event)" ' +
            'ondragleave="handleSupDropzoneDragLeave(event)" ' +
            'ondrop="handleSupDropzoneDrop(event)">' +
            '<div style="font-size:28px; margin-bottom:4px;">📄⬆️</div>' +
            '<div style="font-size:15px; font-weight:700; color:var(--ink);">Click to choose a CSV file or drag &amp; drop here for <span style="color:#059669;">' + esc(activeSup.name) + '</span></div>' +
            '<div class="small" style="color:var(--mute); margin-top:4px;">Columns supported: <code class="mono">part_id</code>, <code class="mono">description</code>, <code class="mono">unit_price</code> (or <code class="mono">price</code>), <code class="mono">stock</code> (or <code class="mono">qty</code>), and optional <code class="mono">attributed_source</code>. No supplier column needed!</div>' +
            '<div style="margin-top:12px;">' +
              '<button type="button" class="btn primary" onclick="event.stopPropagation(); document.getElementById(\'sup-specific-csv-input\').click();" style="background:#059669; border-color:#047857; color:#fff; font-weight:700; padding:8px 18px;">📁 Select CSV File &amp; Update Materials</button>' +
            '</div>' +
          '</div>' +

          '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:8px; padding-top:2px;">' +
            '<label style="display:inline-flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer; margin:0; font-weight:500;">' +
              '<input type="checkbox" data-bind="sup-force-assign" ' + (supplierForceAssignAll ? 'checked' : '') + ' style="width:auto; margin:0;">' +
              '<span>Automatically attribute all material rows in uploaded CSV to <strong>' + esc(activeSup.name) + '</strong></span>' +
            '</label>' +
            '<button type="button" class="btn" data-action="open-add-offer-for-supplier" data-sup="' + esc(activeSup.id) + '" style="font-size:12.5px; font-weight:600;">+ Add Single Material Manually</button>' +
          '</div>' +
        '</section>' +

        /* 4. WHAT'S ADDED — NEWLY ADDED MATERIALS ON THE SAME DASHBOARD */
        '<section class="card stack" id="supplier-whats-added-section" style="border-left:4px solid #10B981; background:var(--card-bg);">' +
          '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:10px;">' +
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
              '<span style="font-size:20px;">🆕</span>' +
              '<div>' +
                '<h3 style="font-size:17.5px; font-weight:700; margin:0;">What\'s Added — Newly Added Materials for ' + esc(activeSup.name) + ' (' + supAddedLogs.length + ')</h3>' +
                '<p class="small" style="color:var(--mute); margin:2px 0 0;">Live ledger of all new materials and first-time supplier quotes added under ' + esc(activeSup.name) + '.</p>' +
              '</div>' +
            '</div>' +
            '<div class="row" style="gap:8px; align-items:center;">' +
              '<span class="badge ok" style="background:#10B981; color:#fff; font-weight:700;">+' + supAddedLogs.length + ' Added Material' + (supAddedLogs.length === 1 ? '' : 's') + '</span>' +
              (supLogs.length > 0 ? '<button type="button" class="btn" data-action="clear-supplier-logs" data-sup="' + esc(activeSup.id) + '" style="font-size:12px; padding:4px 10px;">Clear Activity Log</button>' : '') +
            '</div>' +
          '</div>' +

          (supAddedLogs.length ? (
            '<div class="tbl" style="margin-top:6px;">' +
              '<table>' +
                '<thead><tr><th>Addition Type</th><th>Exact Part ID &amp; Material Description</th><th class="num">Unit Price</th><th class="num">Added Stock</th><th>CSV File / Reference</th><th>Added Timestamp</th></tr></thead>' +
                '<tbody>' +
                  supAddedLogs.map((log) => {
                    return (
                      '<tr class="row-newly-added">' +
                        '<td>' +
                          (log.is_new_part
                            ? '<span class="badge ok" style="background:#059669; color:#fff; font-weight:700;">🆕 New Part &amp; Quote</span>'
                            : '<span class="badge ok" style="font-weight:700;">🆕 New Supplier Quote</span>') +
                        '</td>' +
                        '<td><div class="mono" style="font-weight:700; color:var(--ink);">' + esc(log.part_id) + '</div><div class="small" style="color:var(--mute);">' + esc(log.description || '') + '</div></td>' +
                        '<td class="num font-mono" style="font-weight:700;">' + money(log.new_price_minor, companyProfile.currency_code) + '</td>' +
                        '<td class="num font-mono"><strong>' + esc(log.new_stock != null ? log.new_stock : 0) + '</strong> pcs</td>' +
                        '<td class="small"><strong>' + esc(log.file_name || 'CSV Upload') + '</strong><div style="color:var(--mute); font-size:11.5px;">' + esc(log.source_reference || '') + '</div></td>' +
                        '<td class="small">' + esc(fmtTime(log.timestamp)) + '<div style="color:var(--mute); font-size:11px;">by ' + esc(log.uploaded_by || 'Maintainer') + '</div></td>' +
                      '</tr>'
                    );
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>'
          ) : (
            '<div style="padding:18px; border-radius:10px; border:1px dashed var(--line); background:var(--card-subtle); text-align:center;">' +
              '<div style="font-weight:600; color:var(--ink); font-size:13.5px;">No new materials added yet for ' + esc(activeSup.name) + '</div>' +
              '<div class="small" style="color:var(--mute); margin-top:4px;">Upload a CSV containing new <code class="mono">part_id</code> rows (try clicking <strong>🧪 Sample Update + New Materials CSV</strong> above and uploading it) or click <strong>+ Add Single Material Manually</strong> to see newly added materials listed here immediately.</div>' +
            '</div>'
          )) +
        '</section>' +

        /* 5. UPDATED MATERIALS — BEFORE -> AFTER DIFFS ON THE SAME DASHBOARD */
        (supUpdatedLogs.length ? (
          '<section class="card stack" id="supplier-whats-updated-section" style="border-left:4px solid #0EA5E9; background:var(--card-bg);">' +
            '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:10px;">' +
              '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:20px;">🔄</span>' +
                '<div>' +
                  '<h3 style="font-size:17px; font-weight:700; margin:0;">Updated Materials — Price &amp; Stock Revisions (' + supUpdatedLogs.length + ')</h3>' +
                  '<p class="small" style="color:var(--mute); margin:2px 0 0;">Existing materials for ' + esc(activeSup.name) + ' updated via CSV upload or manual revision.</p>' +
                '</div>' +
              '</div>' +
              '<span class="badge info">' + supUpdatedLogs.length + ' Material' + (supUpdatedLogs.length === 1 ? '' : 's') + ' Updated</span>' +
            '</div>' +
            '<div class="tbl" style="margin-top:6px;">' +
              '<table>' +
                '<thead><tr><th>Status</th><th>Exact Part ID &amp; Description</th><th>Unit Price Revision (Before &rarr; After)</th><th>Stock Revision (Before &rarr; After)</th><th>CSV File / Reference</th><th>Updated Time</th></tr></thead>' +
                '<tbody>' +
                  supUpdatedLogs.slice(0, 25).map((log) => {
                    const diffMinor = (log.new_price_minor != null && log.old_price_minor != null)
                      ? (log.new_price_minor - log.old_price_minor)
                      : 0;
                    let priceDiffHtml = '<strong class="font-mono">' + money(log.new_price_minor, companyProfile.currency_code) + '</strong>';
                    if (log.old_price_minor != null && log.old_price_minor !== log.new_price_minor) {
                      const diffSign = diffMinor > 0 ? '+' : '-';
                      const diffColor = diffMinor > 0 ? '#D97706' : '#059669';
                      priceDiffHtml =
                        '<span class="small font-mono" style="text-decoration:line-through; color:var(--mute);">' + money(log.old_price_minor, companyProfile.currency_code) + '</span>' +
                        ' &rarr; <strong class="font-mono">' + money(log.new_price_minor, companyProfile.currency_code) + '</strong> ' +
                        '<span class="small font-mono" style="color:' + diffColor + '; font-weight:700;">(' + diffSign + money(Math.abs(diffMinor), companyProfile.currency_code) + ')</span>';
                    } else {
                      priceDiffHtml += ' <span class="small" style="color:var(--mute);">(Price unchanged, date refreshed)</span>';
                    }

                    let stockDiffHtml = '<strong class="font-mono">' + esc(log.new_stock != null ? log.new_stock : 0) + ' pcs</strong>';
                    if (log.old_stock != null && log.old_stock !== log.new_stock) {
                      stockDiffHtml = '<span class="small font-mono" style="color:var(--mute);">' + esc(log.old_stock) + '</span> &rarr; <strong class="font-mono">' + esc(log.new_stock) + ' pcs</strong>';
                    }

                    return (
                      '<tr class="row-updated-material">' +
                        '<td><span class="badge info">🔄 Updated</span></td>' +
                        '<td><div class="mono" style="font-weight:700;">' + esc(log.part_id) + '</div><div class="small" style="color:var(--mute);">' + esc(log.description || '') + '</div></td>' +
                        '<td>' + priceDiffHtml + '</td>' +
                        '<td>' + stockDiffHtml + '</td>' +
                        '<td class="small">' + esc(log.file_name || 'CSV Update') + '</td>' +
                        '<td class="small">' + esc(fmtTime(log.timestamp)) + '</td>' +
                      '</tr>'
                    );
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</section>'
        ) : '') +

        /* 6. COMPLETE MATERIAL CATALOG FOR SELECTED SUPPLIER */
        '<section class="card stack">' +
          '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:10px;">' +
            '<div>' +
              '<h3 style="font-size:17.5px; font-weight:700; margin:0;">📦 ' + esc(activeSup.name) + ' — Active Material Catalog (' + filteredSupOffers.length + ' of ' + supOffers.length + ' materials)</h3>' +
              '<p class="small" style="color:var(--mute); margin:2px 0 0;">All component materials currently quoted by ' + esc(activeSup.name) + '. Newly added and CSV-updated rows are highlighted.</p>' +
            '</div>' +
            '<div class="field" style="max-width:280px; min-width:220px;">' +
              '<input id="sup-dash-q" type="search" placeholder="🔍 Filter ' + esc(activeSup.name.split(' ')[0]) + ' materials..." value="' + esc(supplierDashSearch) + '" data-bind="supdashsearch">' +
            '</div>' +
          '</div>' +

          '<div class="tbl" style="margin-top:6px;">' +
            '<table>' +
              '<thead><tr><th>Exact Part ID &amp; Material Description</th><th>Attributed Source / Ref</th><th class="num">Unit Price</th><th class="num">Stock</th><th>Checked Date</th><th>Status</th><th>Actions</th></tr></thead>' +
              '<tbody>' +
                (filteredSupOffers.length ? filteredSupOffers.map((o) => {
                  const part = parts.find((p) => p.id === o.part_id) || {};
                  const days = getOfferAgeDays(o.checked_date);
                  const isStale = days > maxAge;
                  const isMissing = o.price_minor == null || o.recorded_quantity == null || !o.checked_date || !o.source_reference;
                  const wasJustAdded = (window.__lastAddedOfferIds && window.__lastAddedOfferIds.has(o.id)) || supAddedLogs.some((l) => l.offer_id === o.id);
                  const wasJustUpdated = (window.__lastUpdatedOfferIds && window.__lastUpdatedOfferIds.has(o.id));

                  let stBadge = badge('ok', '✓ Fresh');
                  if (isMissing) stBadge = badge('bad', '! Incomplete');
                  else if (isStale) stBadge = badge('warn', '⏱️ Stale (' + days + 'd)');
                  if (!o.active) stBadge += ' ' + badge('gray', 'Inactive');
                  if (wasJustAdded) stBadge += ' <span class="badge ok" style="background:#059669; color:#fff; font-weight:700;">🆕 Added</span>';
                  else if (wasJustUpdated) stBadge += ' <span class="badge info" style="font-weight:700;">✓ CSV Updated</span>';

                  const rowCls = wasJustAdded ? ' class="row-newly-added"' : (wasJustUpdated ? ' class="row-uploaded-success"' : '');

                  return (
                    '<tr' + rowCls + '>' +
                      '<td><div class="mono" style="font-weight:700;">' + esc(part.exact_id || o.part_id) + '</div><div class="small" style="color:var(--mute);">' + esc(part.description || '') + '</div></td>' +
                      '<td class="small" style="color:var(--mute); max-width:220px;">' + esc(o.source_reference || 'None') + '</td>' +
                      '<td class="num font-mono">' + money(o.price_minor, o.currency) + priceTrendBadge(o) + '</td>' +
                      '<td class="num font-mono">' + (o.recorded_quantity == null ? '<span class="badge bad">None</span>' : o.recorded_quantity) + '</td>' +
                      '<td class="small">' + fmtDate(o.checked_date) + '</td>' +
                      '<td>' + stBadge + '</td>' +
                      '<td><div class="row" style="gap:4px; align-items:center;">' +
                        '<button type="button" class="btn btn-sm" style="font-size:11.5px; padding:3px 8px; font-weight:600;" data-action="edit-offer" data-id="' + esc(o.id) + '">✏️ Edit</button>' +
                        '<button type="button" class="btn btn-sm" style="font-size:11.5px; padding:3px 8px; font-weight:600; background:rgba(239,68,68,0.12); color:#EF4444; border:1px solid rgba(239,68,68,0.25);" data-action="delete-offer" data-id="' + esc(o.id) + '" data-part="' + esc(part.exact_id || o.part_id) + '" title="Delete this quotation">🗑️ Delete</button>' +
                      '</div></td>' +
                    '</tr>'
                  );
                }).join('') : '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mute);">No materials match your filter for ' + esc(activeSup.name) + '.</td></tr>') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  function drawCatalog(search, notice, preserveScroll = false) {
    const { parts, offers, sups } = window.__cat;
    const supReqs = (window.__cat && window.__cat.supReqs) || [];
    const pendingSupReqCount = supReqs.filter(r => r.status === 'PENDING').length;
    const uploadLogs = (window.__cat && window.__cat.uploadLogs) || [];
    const totalAddedCount = uploadLogs.filter((l) => l.action === 'ADDED').length;
    const q = (search || '').trim().toLowerCase();

    const pName = (id) => (parts.find((p) => p.id === id) || {}).exact_id || '?';
    const sName = (id) => (sups.find((s) => s.id === id) || {}).name || '?';

    const maxAge = (companyProfile && companyProfile.max_quote_age_days) || 14;
    const totalOffers = offers.length;
    let freshCount = 0;
    let staleCount = 0;
    let incompleteCount = 0;

    offers.forEach(o => {
      const missing = o.price_minor == null || o.recorded_quantity == null || !o.checked_date || !o.source_reference;
      const days = getOfferAgeDays(o.checked_date);
      if (missing) incompleteCount++;
      else if (days > maxAge) staleCount++;
      else freshCount++;
    });

    const rows = offers.filter((o) => {
      if (catalogSupplierFilter && catalogSupplierFilter !== 'ALL') {
        if (o.supplier_id !== catalogSupplierFilter) return false;
      }

      const matchQuery = !q || pName(o.part_id).toLowerCase().includes(q) || sName(o.supplier_id).toLowerCase().includes(q) || (o.source_reference || '').toLowerCase().includes(q);
      if (!matchQuery) return false;

      const missing = o.price_minor == null || o.recorded_quantity == null || !o.checked_date || !o.source_reference;
      const days = getOfferAgeDays(o.checked_date);

      if (catalogFilter === 'FRESH') return !missing && days <= maxAge;
      if (catalogFilter === 'STALE') return !missing && days > maxAge;
      if (catalogFilter === 'INCOMPLETE') return missing;
      return true;
    });

    const showGlobal = catalogWorkspaceView === 'GLOBAL' || catalogWorkspaceView === 'COMBINED';
    const showSupplierDash = catalogWorkspaceView === 'SUPPLIER' || catalogWorkspaceView === 'COMBINED';

    const globalCatalogHtml =
      '<div class="stack" style="gap:18px;">' +
        '<div class="preparer-metrics-grid">' +
          '<div class="metric-card"><div class="metric-icon">📦</div><div><div class="metric-number">' + totalOffers + '</div><div class="metric-label">Total Curated Offers</div></div></div>' +
          '<div class="metric-card"><div class="metric-icon">✓</div><div><div class="metric-number" style="color:var(--ok);">' + freshCount + '</div><div class="metric-label">Fresh &amp; Complete (≤' + maxAge + 'd)</div></div></div>' +
          '<div class="metric-card"><div class="metric-icon">⏱️</div><div><div class="metric-number" style="color:var(--warn);">' + staleCount + '</div><div class="metric-label">Stale Offers (>' + maxAge + 'd)</div></div></div>' +
          '<div class="metric-card"><div class="metric-icon">🏬</div><div><div class="metric-number">' + sups.length + '</div><div class="metric-label">Suppliers Tracked</div></div></div>' +
        '</div>' +

        /* QUICK LAUNCHER TO DEDICATED SUPPLIER CSV DASHBOARD */
        (catalogWorkspaceView === 'GLOBAL' && sups.length ? (
          '<section class="card stack" style="padding:16px 20px; border-left:4px solid #059669; background:var(--card-subtle);">' +
            '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:8px;">' +
              '<div>' +
                '<strong style="font-size:15px; color:var(--ink);">🏢 Per-Supplier Material CSV Upload &amp; What\'s Added Dashboards</strong>' +
                '<div class="small" style="color:var(--mute);">Click any supplier below to open their dedicated dashboard, bulk-upload a CSV of materials to update, and view newly added materials.</div>' +
              '</div>' +
              '<button type="button" class="btn primary" data-action="set-catalog-ws-view" data-view="SUPPLIER" style="background:#059669; border-color:#047857; color:#fff; font-weight:700;">Open Supplier CSV Dashboard &rarr;</button>' +
            '</div>' +
            '<div class="supplier-selector-grid" style="margin-top:6px;">' +
              sups.map((s) => {
                const cnt = offers.filter((o) => o.supplier_id === s.id).length;
                const addCnt = uploadLogs.filter((l) => l.supplier_id === s.id && l.action === 'ADDED').length;
                return (
                  '<button type="button" class="supplier-select-card" data-action="open-supplier-dashboard" data-id="' + esc(s.id) + '">' +
                    '<div class="row between" style="width:100%; align-items:center;">' +
                      '<strong style="color:var(--ink); font-size:13.5px;">🏬 ' + esc(s.name) + '</strong>' +
                      '<span class="small" style="color:#059669; font-weight:700;">CSV Dashboard &rarr;</span>' +
                    '</div>' +
                    '<div class="small" style="color:var(--mute);">' + cnt + ' active materials' + (addCnt ? ' &middot; <strong style="color:#059669;">+' + addCnt + ' newly added</strong>' : '') + '</div>' +
                  '</button>'
                );
              }).join('') +
            '</div>' +
          '</section>'
        ) : '') +

        '<section class="card stack" aria-labelledby="oh">' +
          '<div class="row between" style="align-items:center;">' +
            '<div>' +
              '<h2 id="oh" style="font-size:18px; font-weight:700;">Curated Offers List (' + rows.length + ' shown)</h2>' +
              '<p class="small" style="color:var(--mute);">Missing values or stale dates (>' + maxAge + ' days) will cause an offer to be automatically excluded from BOM evaluations.</p>' +
            '</div>' +
            '<div class="field" style="max-width:280px;">' +
              '<input id="q" type="search" placeholder="🔍 Search part, supplier, or notes..." value="' + esc(search) + '" data-bind="catsearch">' +
            '</div>' +
          '</div>' +

          '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:8px; margin-top:2px;">' +
            '<div class="row" style="gap:8px; flex-wrap:wrap;">' +
              '<button type="button" class="btn ' + (catalogFilter === 'ALL' ? 'primary' : '') + '" data-action="set-catalog-filter" data-val="ALL">All Offers (' + totalOffers + ')</button>' +
              '<button type="button" class="btn ' + (catalogFilter === 'FRESH' ? 'primary' : '') + '" data-action="set-catalog-filter" data-val="FRESH">Fresh (≤' + maxAge + 'd) (' + freshCount + ')</button>' +
              '<button type="button" class="btn ' + (catalogFilter === 'STALE' ? 'primary' : '') + '" data-action="set-catalog-filter" data-val="STALE">Stale (>' + maxAge + 'd) (' + staleCount + ')</button>' +
              '<button type="button" class="btn ' + (catalogFilter === 'INCOMPLETE' ? 'primary' : '') + '" data-action="set-catalog-filter" data-val="INCOMPLETE">Incomplete (' + incompleteCount + ')</button>' +
            '</div>' +
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
              '<label for="cat-sup-filter" class="small" style="margin:0; font-weight:600; color:var(--mute); white-space:nowrap;">Filter by Supplier:</label>' +
              '<select id="cat-sup-filter" data-bind="cat-sup-filter" style="min-width:210px; padding:6px 10px; font-size:13px;">' +
                '<option value="ALL">🏢 All Suppliers (' + totalOffers + ')</option>' +
                sups.map(s => {
                  const cnt = offers.filter(o => o.supplier_id === s.id).length;
                  return '<option value="' + esc(s.id) + '"' + (catalogSupplierFilter === s.id ? ' selected' : '') + '>' + esc(s.name) + ' (' + cnt + ' quotes)</option>';
                }).join('') +
              '</select>' +
              (catalogSupplierFilter && catalogSupplierFilter !== 'ALL'
                ? '<button type="button" class="btn primary" data-action="open-supplier-dashboard" data-id="' + esc(catalogSupplierFilter) + '" style="background:#059669; border-color:#047857; color:#fff; font-size:12.5px; font-weight:700;">🏢 Open Supplier CSV Dashboard</button>'
                : '') +
            '</div>' +
          '</div>' +

          '<div class="tbl" style="margin-top:8px;">' +
            '<table>' +
              '<thead><tr><th>Exact Part ID &amp; Description</th><th>Supplier / Shop</th><th>Attributed Source</th><th class="num">Unit Price</th><th class="num">Stock</th><th>Checked Date</th><th>Status</th><th>Actions</th></tr></thead>' +
              '<tbody>' +
                (rows.length ? rows.map((o) => {
                  const part = parts.find((p) => p.id === o.part_id) || {};
                  const sup = sups.find((s) => s.id === o.supplier_id) || {};
                  const days = getOfferAgeDays(o.checked_date);
                  const isStale = days > maxAge;
                  const isMissing = o.price_minor == null || o.recorded_quantity == null || !o.checked_date || !o.source_reference;

                  const isUploadedSuccess = window.__lastUploadedOfferIds && window.__lastUploadedOfferIds.has(o.id);
                  const isNewlyAdded = window.__lastAddedOfferIds && window.__lastAddedOfferIds.has(o.id);

                  let statusBadge = badge('ok', '✓ Fresh');
                  if (isMissing) statusBadge = badge('bad', '! Incomplete');
                  else if (isStale) statusBadge = badge('warn', '⏱️ Stale (' + days + 'd)');
                  if (!o.active) statusBadge += ' ' + badge('gray', 'Inactive');
                  if (isNewlyAdded) {
                    statusBadge += ' <span class="badge ok" style="background:#059669; color:#fff; font-weight:700;">🆕 Added from CSV</span>';
                  } else if (isUploadedSuccess) {
                    statusBadge += ' <span class="badge ok" style="background:#059669; color:#fff; font-weight:700;">✓ Uploaded from CSV</span>';
                  }

                  return '<tr' + (isUploadedSuccess ? ' class="row-uploaded-success"' : '') + '>' +
                    '<td><div class="mono" style="font-weight:700;">' + esc(part.exact_id || o.part_id) + '</div><div class="small" style="color:var(--mute);">' + esc(part.description || '') + '</div></td>' +
                    '<td><strong style="color:var(--ink);">' + esc(sup.name || o.supplier_id) + '</strong></td>' +
                    '<td class="small" style="max-width:200px; color:var(--mute);">' + esc(o.source_reference || 'None') + '</td>' +
                    '<td class="num font-mono">' + money(o.price_minor, o.currency) + priceTrendBadge(o) + '</td>' +
                    '<td class="num font-mono">' + (o.recorded_quantity == null ? '<span class="badge bad">None</span>' : o.recorded_quantity) + '</td>' +
                    '<td class="small">' + fmtDate(o.checked_date) + '</td>' +
                    '<td>' + statusBadge + '</td>' +
                    '<td><div class="row" style="gap:4px; align-items:center;">' +
                      '<button type="button" class="btn btn-sm" style="font-size:11.5px; padding:3px 8px; font-weight:600;" data-action="edit-offer" data-id="' + esc(o.id) + '">✏️ Edit</button>' +
                      '<button type="button" class="btn btn-sm" style="font-size:11.5px; padding:3px 8px; font-weight:600; background:rgba(239,68,68,0.12); color:#EF4444; border:1px solid rgba(239,68,68,0.25);" data-action="delete-offer" data-id="' + esc(o.id) + '" data-part="' + esc(part.exact_id || o.part_id) + '" title="Delete this quotation">🗑️ Delete</button>' +
                    '</div></td>' +
                  '</tr>';
                }).join('') : '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mute);">No offers match the selected filters.</td></tr>') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</section>' +
      '</div>';

    setMain(
      '<div class="stack" style="gap:20px;">' +
        '<div class="row between" style="align-items:flex-end; flex-wrap:wrap; gap:12px;">' +
          '<div>' +
            '<div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">' +
              '<h1 style="font-size:26px; font-weight:700; margin:0;">Offer Catalog Workspace</h1>' +
              '<span class="badge ok">Role: ' + (isAdminUser() ? 'Administrator' : 'Catalog Maintainer') + '</span>' +
            '</div>' +
            '<p class="sub">Curate, update, and audit exact component offers from accredited suppliers for ' + esc(companyProfile.business_name) + '.</p>' +
          '</div>' +
          (canManageCatalog() ? 
            '<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;">' +
              '<input type="file" id="supplier-csv-input" accept=".csv" class="hidden" style="display:none;" onchange="handleSupplierCsvUpload(event)">' +
              '<button type="button" class="btn" id="btn-download-csv-template" data-action="download-csv-template" data-guide-key="download-csv-template" onclick="downloadSupplierCsvTemplate()" style="font-weight:600;">CSV Template</button>' +
              '<button type="button" class="btn primary" id="btn-upload-supplier-csv" data-action="upload-supplier-csv" data-guide-key="upload-supplier-csv" onclick="document.getElementById(\'supplier-csv-input\').click()" style="background:#059669; border-color:#047857; color:#FFFFFF; font-weight:700;">Upload Multi-Supplier CSV</button>' +
              '<button type="button" class="btn primary" id="btn-open-ai-quote-ingest" data-action="open-ai-quote-ingest" data-guide-key="ai-quote-ingest" style="background:linear-gradient(135deg, #0D9488, #2563EB); border:none; color:#FFFFFF; font-weight:700; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(13,148,136,0.35);">🤖 AI Smart Quote Ingest</button>' +
              '<button type="button" class="btn primary" data-action="open-add-offer-modal" data-guide-key="add-new-offer" style="font-weight:700;">+ Add New Offer</button>' +
              (isAdminUser() 
                ? '<button type="button" class="btn primary" data-action="open-add-supplier-modal" data-guide-key="admin-add-supplier" style="background:#0D9488; border-color:#0F766E; font-weight:700;">+ Add Supplier</button>' 
                : '<button type="button" class="btn primary" data-action="open-request-supplier-modal" data-guide-key="catalog-request-supplier" style="background:#0D9488; border-color:#0F766E; font-weight:700;">🏢 Request New Supplier</button>'
              ) +
              '<button type="button" class="btn" data-action="open-view-supplier-requests-modal" style="font-weight:600; font-size:12.5px;">📋 Supplier Requests' + (pendingSupReqCount > 0 ? ' <span class="badge warn" style="padding:1px 6px; font-size:11px; margin-left:3px;">' + pendingSupReqCount + '</span>' : '') + '</button>' +
            '</div>' : '') +
        '</div>' +

        /* WORKSPACE DASHBOARD SWITCHER TABS */
        '<div class="catalog-workspace-switcher" role="tablist" aria-label="Catalog Workspace Views">' +
          '<button type="button" class="catalog-ws-tab' + (catalogWorkspaceView === 'GLOBAL' ? ' active' : '') + '" data-action="set-catalog-ws-view" data-view="GLOBAL" data-guide-key="tab-global">' +
            '<span>🌐 All Curated Offers (' + totalOffers + ')</span>' +
          '</button>' +
          '<button type="button" class="catalog-ws-tab' + (catalogWorkspaceView === 'SUPPLIER' ? ' active' : '') + '" data-action="set-catalog-ws-view" data-view="SUPPLIER" data-guide-key="tab-supplier">' +
            '<span>🏢 Supplier CSV Update Dashboard (' + sups.length + ' Suppliers)</span>' +
            (totalAddedCount > 0 ? '<span class="badge ok" style="background:#10B981; color:#fff; font-size:11px;">🆕 +' + totalAddedCount + ' Added</span>' : '') +
          '</button>' +
          '<button type="button" class="catalog-ws-tab' + (catalogWorkspaceView === 'COMBINED' ? ' active' : '') + '" data-action="set-catalog-ws-view" data-view="COMBINED" data-guide-key="tab-combined">' +
            '<span>📊 Combined View (Show Both)</span>' +
          '</button>' +
        '</div>' +

        (notice ? alertBox('ok', esc(notice), 'status') : '') +

        (showSupplierDash ? renderSupplierCsvDashboardSection(maxAge) : '') +
        (showGlobal ? globalCatalogHtml : '') +
      '</div>',
      preserveScroll
    );
  }

  /* ---------- CSV TEMPLATE GENERATOR & BULK PARSER ---------- */
  function downloadSupplierCsvTemplate() {
    const csvContent = 
`part_id,description,source,attributed_source,unit_price,stock
CBB65-45UF-450V,"Dual Run Motor Capacitor 45uF 450VAC (Round aluminum can)",Everwell Parts & Equipment Corp.,Everwell Official Wholesale Quote #EW-2026-11,405.00,45
CBB65-45UF-450V,"Dual Run Motor Capacitor 45uF 450VAC (Round aluminum can)",C&C Airconditioning Supply,C&C Supply Catalog Sheet #CC-8820,420.00,30
R410A-CAN-1KG,"R410A Refrigerant Cylinder 1kg",Manco Refrigeration Supply,Manco Counter Price List Nov 2026,590.00,25\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supplier_catalog_template.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvEscapeCell(val) {
    const str = String(val == null ? '' : val);
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportSupplierMaterialsCsv(supplierId) {
    const { parts, offers, sups } = window.__cat || { parts: [], offers: [], sups: [] };
    const sup = sups.find((s) => s.id === (supplierId || selectedSupplierDashId)) || sups[0];
    if (!sup) return;

    const supOffers = offers.filter((o) => o.supplier_id === sup.id);
    const lines = ['part_id,description,unit_price,stock,attributed_source'];
    supOffers.forEach((o) => {
      const part = parts.find((p) => p.id === o.part_id) || {};
      const priceVal = o.price_minor != null ? (o.price_minor / 100).toFixed(2) : '0.00';
      const stockVal = o.recorded_quantity != null ? o.recorded_quantity : 0;
      lines.push([
        csvEscapeCell(part.exact_id || o.part_id),
        csvEscapeCell(part.description || ''),
        priceVal,
        stockVal,
        csvEscapeCell(o.source_reference || (sup.name + ' Price Sheet'))
      ].join(','));
    });

    const slug = sup.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (slug || 'supplier') + '_materials_catalog.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadSupplierSampleUpdateCsv(supplierId) {
    const { parts, offers, sups } = window.__cat || { parts: [], offers: [], sups: [] };
    const sup = sups.find((s) => s.id === (supplierId || selectedSupplierDashId)) || sups[0];
    if (!sup) return;

    const supOffers = offers.filter((o) => o.supplier_id === sup.id).slice(0, 3);
    const refTag = sup.name.split(' ')[0] + ' Official Bulk Sheet #' + new Date().toISOString().slice(0, 10);
    const lines = ['part_id,description,unit_price,stock,attributed_source'];

    supOffers.forEach((o) => {
      const part = parts.find((p) => p.id === o.part_id) || {};
      const currentPrice = o.price_minor != null ? o.price_minor / 100 : 400;
      const updatedPrice = Math.max(25, currentPrice - 15).toFixed(2);
      const updatedStock = (o.recorded_quantity || 20) + 15;
      lines.push([
        csvEscapeCell(part.exact_id || o.part_id),
        csvEscapeCell(part.description || ''),
        updatedPrice,
        updatedStock,
        csvEscapeCell(refTag)
      ].join(','));
    });

    // Append 2 brand-new HVAC materials so user can immediately see "What's Added" populate
    lines.push([
      'COPPER-COIL-1/4',
      csvEscapeCell('Pancake Copper Tubing 1/4in x 15m ASTM B280'),
      '1450.00',
      '35',
      csvEscapeCell(refTag)
    ].join(','));
    lines.push([
      'EK-083S-DRIER',
      csvEscapeCell('Liquid Line Filter Drier 3/8in Solder HVAC'),
      '520.00',
      '50',
      csvEscapeCell(refTag)
    ].join(','));

    const slug = sup.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (slug || 'supplier') + '_update_and_new_materials.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function parseCsvRecords(text) {
    const lines = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(field.trim());
        field = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          i++;
        }
        row.push(field.trim());
        field = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          lines.push(row);
        }
        row = [];
      } else {
        field += char;
      }
    }
    if (field || row.length > 0) {
      row.push(field.trim());
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        lines.push(row);
      }
    }
    return lines;
  }

  async function processDedicatedSupplierCsvFile(file) {
    if (!file) return;
    const { sups } = window.__cat || { sups: [] };
    const targetSup = sups.find((s) => s.id === selectedSupplierDashId) || sups[0];
    if (!targetSup) {
      alert('Please select or register an accredited supplier first.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const text = e.target.result;
        const parsedRows = parseCsvRecords(text);
        if (!parsedRows || parsedRows.length < 2) {
          alert('Uploaded CSV file is empty or missing material rows.');
          return;
        }

        const headers = parsedRows[0].map((h) => (h || '').trim().toLowerCase().replace(/[\s_-]+/g, '_'));
        const idxPart = headers.findIndex((h) =>
          ['part_id', 'part_number', 'part_no', 'partid', 'part', 'exact_id', 'material_id', 'material_code', 'item_code', 'item_id', 'sku', 'code', 'model'].includes(h)
        );
        const idxDesc = headers.findIndex((h) =>
          ['description', 'desc', 'part_description', 'name', 'material', 'material_name', 'item_name', 'item', 'product', 'title', 'specification'].includes(h)
        );
        const idxSource = headers.findIndex((h) =>
          ['source', 'supplier', 'shop', 'supplier_name', 'vendor'].includes(h)
        );
        const idxAttr = headers.findIndex((h) =>
          ['attributed_source', 'source_reference', 'reference', 'quote_reference', 'quote_ref', 'notes', 'remarks'].includes(h)
        );
        const idxPrice = headers.findIndex((h) =>
          ['unit_price', 'price', 'unitprice', 'price_php', 'cost', 'unit_cost', 'amount', 'rate', 'quote_price'].includes(h)
        );
        const idxStock = headers.findIndex((h) =>
          ['stock', 'available_qty', 'qty', 'quantity', 'available_quantity', 'on_hand', 'inventory', 'available'].includes(h)
        );

        if ((idxPart === -1 && idxDesc === -1) || idxPrice === -1) {
          alert('Invalid CSV header format. Include at least "part_id" (or "material") and "unit_price" (or "price"). Click "Sample Update + New Materials CSV" for a ready template.');
          return;
        }

        const batch = [];
        for (let i = 1; i < parsedRows.length; i++) {
          const r = parsedRows[i];
          if (!r || !r.length || (r.length === 1 && !r[0])) continue;

          const descVal = idxDesc !== -1 ? (r[idxDesc] || '').trim() : '';
          let partId = idxPart !== -1 ? (r[idxPart] || '').trim() : '';
          if (!partId && descVal) {
            partId = descVal.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
          }
          if (!partId) continue;

          const rowSource = (idxSource !== -1 && r[idxSource] ? r[idxSource].trim() : '') || targetSup.name;
          const attr = (idxAttr !== -1 ? (r[idxAttr] || '').trim() : '') || (targetSup.name + ' CSV (' + file.name + ')');
          const rawPrice = idxPrice !== -1 ? r[idxPrice] : '0';
          const rawStock = idxStock !== -1 ? r[idxStock] : '0';

          batch.push({
            part_id: partId,
            description: descVal || partId,
            source: rowSource,
            attributed_source: attr,
            unit_price: rawPrice,
            stock: rawStock
          });
        }

        if (!batch.length) {
          alert('No valid material rows found in "' + file.name + '".');
          return;
        }

        const result = await API.bulkUpsertOffers(batch, file.name, {
          targetSupplierId: targetSup.id,
          forceTargetSupplier: supplierForceAssignAll
        });

        const [parts, offers, supsFresh, uploadLogs] = await Promise.all([
          API.listParts(),
          API.listOffers(),
          API.listSuppliers(),
          API.listSupplierUploadLogs()
        ]);
        window.__cat = { parts, offers, sups: supsFresh, uploadLogs: uploadLogs || [] };
        window.__lastUploadedOfferIds = new Set(result.affectedOfferIds || []);
        window.__lastAddedOfferIds = new Set(result.addedOfferIds || []);
        window.__lastUpdatedOfferIds = new Set(result.updatedOfferIds || []);
        window.__lastUploadedFileName = file.name;

        const noticeMsg =
          '✓ Supplier CSV Processed for ' + targetSup.name + ' ("' + file.name + '"): ' +
          result.addedCount + ' new material(s) ADDED, ' +
          result.updatedCount + ' existing material(s) UPDATED! Review "What\'s Added" below.';
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', noticeMsg);
      } catch (err) {
        console.error('Dedicated supplier CSV upload error:', err);
        alert('Failed to process supplier CSV: ' + (err.message || 'Unknown error'));
      } finally {
        const inputEl = document.getElementById('sup-specific-csv-input');
        if (inputEl) inputEl.value = '';
      }
    };
    reader.readAsText(file);
  }

  function handleDedicatedSupplierCsvUpload(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    processDedicatedSupplierCsvFile(file);
  }

  function handleSupDropzoneDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    const dz = document.getElementById('sup-csv-dropzone');
    if (dz) dz.classList.add('drag-over');
  }

  function handleSupDropzoneDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    const dz = document.getElementById('sup-csv-dropzone');
    if (dz) dz.classList.remove('drag-over');
  }

  function handleSupDropzoneDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const dz = document.getElementById('sup-csv-dropzone');
    if (dz) dz.classList.remove('drag-over');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) processDedicatedSupplierCsvFile(file);
  }

  async function handleSupplierCsvUpload(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const text = e.target.result;
        const parsedRows = parseCsvRecords(text);
        if (!parsedRows || parsedRows.length < 2) {
          alert('Uploaded CSV file is empty or missing data rows.');
          if (event.target) event.target.value = '';
          return;
        }

        const headers = parsedRows[0].map(h => (h || '').trim().toLowerCase().replace(/[\s_-]+/g, '_'));

        const idxPart = headers.findIndex(h => h === 'part_id' || h === 'part_number' || h === 'partid' || h === 'part' || h === 'exact_id');
        const idxDesc = headers.findIndex(h => h === 'description' || h === 'desc' || h === 'part_description' || h === 'name');
        const idxSource = headers.findIndex(h => h === 'source' || h === 'supplier' || h === 'shop' || h === 'supplier_name' || h === 'vendor');
        const idxAttr = headers.findIndex(h => h === 'attributed_source' || h === 'source_reference' || h === 'reference' || h === 'quote_reference' || h === 'quote_ref');
        const idxPrice = headers.findIndex(h => h === 'unit_price' || h === 'price' || h === 'unitprice' || h === 'price_php');
        const idxStock = headers.findIndex(h => h === 'stock' || h === 'available_qty' || h === 'qty' || h === 'quantity' || h === 'available_quantity');

        if (idxPart === -1 || idxSource === -1 || idxPrice === -1) {
          alert('Invalid CSV header format. CSV must contain at least: part_id, source (or supplier), and unit_price (or price). Tip: Use the "Supplier CSV Update Dashboard" tab to upload a supplier sheet without needing a source column!');
          if (event.target) event.target.value = '';
          return;
        }

        const batch = [];
        for (let i = 1; i < parsedRows.length; i++) {
          const r = parsedRows[i];
          if (!r || !r.length || (r.length === 1 && !r[0])) continue;

          const partId = (r[idxPart] || '').trim();
          const source = (r[idxSource] || '').trim();
          if (!partId || !source) continue;

          const desc = idxDesc !== -1 ? (r[idxDesc] || '').trim() : '';
          const attr = (idxAttr !== -1 ? (r[idxAttr] || '').trim() : '') || file.name;
          const rawPrice = idxPrice !== -1 ? r[idxPrice] : '0';
          const rawStock = idxStock !== -1 ? r[idxStock] : '0';

          batch.push({
            part_id: partId,
            description: desc,
            source: source,
            attributed_source: attr,
            unit_price: rawPrice,
            stock: rawStock
          });
        }

        if (!batch.length) {
          alert('No valid supplier quotation rows found in CSV.');
          if (event.target) event.target.value = '';
          return;
        }

        // Call adapter to persist locally and sync to Supabase
        const result = await API.bulkUpsertOffers(batch, file.name);

        // Refresh in-memory catalog cache
        const [parts, offers, sups, uploadLogs] = await Promise.all([
          API.listParts(),
          API.listOffers(),
          API.listSuppliers(),
          API.listSupplierUploadLogs()
        ]);
        window.__cat = { parts, offers, sups, uploadLogs: uploadLogs || [] };

        window.__lastUploadedOfferIds = new Set(result.affectedOfferIds || []);
        window.__lastAddedOfferIds = new Set(result.addedOfferIds || []);
        window.__lastUpdatedOfferIds = new Set(result.updatedOfferIds || []);
        window.__lastUploadedFileName = file.name;

        // Re-render catalog view with notice and recalculated KPI summary cards
        const noticeMsg = `✓ Bulk CSV Upload Complete: Successfully uploaded "${file.name}"! ${result.addedCount} new quote(s) created, ${result.updatedCount} existing quote(s) updated. All entries marked Fresh (≤14d) and highlighted below.`;
        drawCatalog('', noticeMsg);

      } catch (err) {
        console.error('Supplier CSV upload error:', err);
        alert('Failed to process supplier CSV: ' + (err.message || 'Unknown error'));
      } finally {
        if (event && event.target) event.target.value = '';
        const inputEl = document.getElementById('supplier-csv-input');
        if (inputEl) inputEl.value = '';
      }
    };
    reader.readAsText(file);
  }

  /* ---------- MODAL CSV OFFER AUTO-UPDATER ---------- */
  function handleModalOfferCsvUpload(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const text = e.target.result;
        const parsed = parseCsvRecords(text);
        if (!parsed || parsed.length < 2) {
          alert('Uploaded CSV does not contain valid data rows.');
          return;
        }
        const headers = parsed[0].map(h => (h || '').trim().toLowerCase().replace(/[\s_-]+/g, '_'));
        const idxPrice = headers.findIndex(h => h.includes('price'));
        const idxStock = headers.findIndex(h => h.includes('stock') || h.includes('qty'));
        const idxAttr = headers.findIndex(h => h.includes('source') || h.includes('ref'));
        const idxPart = headers.findIndex(h => h.includes('part'));

        let targetRow = parsed[1];
        if (offerForm && offerForm.part_id && idxPart !== -1) {
          const { parts } = window.__cat || {};
          const currentPart = parts ? parts.find(p => p.id === offerForm.part_id) : null;
          const matchExact = currentPart ? (currentPart.exact_id || '').toLowerCase() : '';
          const found = parsed.slice(1).find(r => {
            const pVal = (r[idxPart] || '').trim().toLowerCase();
            return pVal === matchExact || pVal === offerForm.part_id.toLowerCase();
          });
          if (found) targetRow = found;
        }

        if (targetRow) {
          if (idxPrice !== -1 && targetRow[idxPrice]) {
            const rawP = parseFloat(String(targetRow[idxPrice]).replace(/[^0-9.-]+/g, '')) || 0;
            const priceEl = document.getElementById('f-price');
            if (priceEl) priceEl.value = rawP.toFixed(2);
            if (offerForm) offerForm.price = rawP.toFixed(2);
          }
          if (idxStock !== -1 && targetRow[idxStock]) {
            const rawS = parseInt(String(targetRow[idxStock]).replace(/[^0-9-]+/g, ''), 10) || 0;
            const stockEl = document.getElementById('f-qty');
            if (stockEl) stockEl.value = rawS;
            if (offerForm) offerForm.recorded_quantity = rawS;
          }
          if (idxAttr !== -1 && targetRow[idxAttr]) {
            const rawA = targetRow[idxAttr].trim();
            const srcEl = document.getElementById('f-src');
            if (srcEl) srcEl.value = rawA;
            if (offerForm) offerForm.source_reference = rawA;
          }
          const dateEl = document.getElementById('f-date');
          const todayStr = new Date().toISOString().slice(0, 10);
          if (dateEl) dateEl.value = todayStr;
          if (offerForm) offerForm.checked_date = todayStr;

          const noticeEl = document.getElementById('modal-offer-csv-notice');
          if (noticeEl) {
            noticeEl.style.display = 'block';
            noticeEl.innerHTML = `<div class="alert ok" style="padding:8px 12px; font-size:12.5px; border-left:4px solid #10B981;">✓ Successfully parsed quotation from "${file.name}"! Form fields updated. Click "✓ Update Offer" below to save.</div>`;
          }
        }
      } catch (err) {
        alert('Failed to parse offer CSV: ' + err.message);
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  // Export to window for global access
  window.downloadSupplierCsvTemplate = downloadSupplierCsvTemplate;
  window.exportSupplierMaterialsCsv = exportSupplierMaterialsCsv;
  window.downloadSupplierSampleUpdateCsv = downloadSupplierSampleUpdateCsv;
  window.handleSupplierCsvUpload = handleSupplierCsvUpload;
  window.handleDedicatedSupplierCsvUpload = handleDedicatedSupplierCsvUpload;
  window.handleSupDropzoneDragOver = handleSupDropzoneDragOver;
  window.handleSupDropzoneDragLeave = handleSupDropzoneDragLeave;
  window.handleSupDropzoneDrop = handleSupDropzoneDrop;
  window.handleModalOfferCsvUpload = handleModalOfferCsvUpload;

  function renderCatalogModal() {
    removeExistingModal();
    if (!offerForm || !offerForm.isOpen) return;

    const f = offerForm;
    const { parts, sups } = window.__cat;
    const opt = (list, val, label) => list.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === val ? ' selected' : '') + '>' + esc(label(x)) + '</option>').join('');

    const overlay = document.createElement('div');
    overlay.id = 'offerModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack">
        <div class="catalog-modal-header">
          <div>
            <h2 style="font-size:20px; font-weight:700; margin:0;">${f.id ? 'Edit Offer' : 'Add Curated Component Offer'}</h2>
            <p class="small" style="color:var(--mute); margin-top:2px;">${f.id ? 'Updating record for ID: ' + esc(f.id) : 'Record a dated component quotation.'}</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-offer-modal" aria-label="Close modal">&times;</button>
        </div>

        <div style="background:var(--card-subtle); border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-weight:600; font-size:13px; color:var(--ink);">📁 CSV File Quotation Update</div>
            <div class="small" style="color:var(--mute);">Upload a supplier quote CSV to auto-fill price, stock, date &amp; source.</div>
          </div>
          <div>
            <input type="file" id="modal-offer-csv-input" accept=".csv" style="display:none;" onchange="handleModalOfferCsvUpload(event)">
            <button type="button" class="btn" id="btn-modal-upload-csv" style="font-size:12px; font-weight:600; padding:5px 12px; background:var(--teal); color:#fff; border-color:var(--teal);" onclick="document.getElementById('modal-offer-csv-input').click()">
              📁 Upload CSV / Update Offer
            </button>
          </div>
        </div>
        <div id="modal-offer-csv-notice" style="display:none; margin-top:6px;"></div>

        ${f.error ? alertBox('bad', esc(f.error), 'alert') : ''}

        <form id="offerform" class="stack" novalidate style="margin-top:6px;">
          <div>
            <label for="f-part">Exact Part / Material ID</label>
            <select id="f-part" data-bind="of.part_id" ${f.errors && f.errors.part_id ? 'aria-invalid="true" aria-describedby="e-part"' : ''}>
              <option value="">Choose a verified component</option>
              ${!f.id ? `<option value="__NEW_PART__"${f.part_id === '__NEW_PART__' ? ' selected' : ''}>➕ Register Brand-New Material / Part ID...</option>` : ''}
              ${opt(parts, f.part_id, (p) => p.exact_id + ' - ' + p.description)}
            </select>
            ${fe(f.errors, 'part_id', 'e-part')}
          </div>

          <div id="new-part-fields-wrap" class="stack" style="gap:8px; padding:10px 12px; border-radius:8px; background:var(--card-subtle); border:1px solid var(--line); display:${f.part_id === '__NEW_PART__' ? 'flex' : 'none'};">
            <div>
              <label for="f-new-part-exact">New Exact Material / Part ID</label>
              <input id="f-new-part-exact" placeholder="e.g. COPPER-COIL-1/4" value="${esc(f.new_part_exact || '')}" data-bind="of.new_part_exact" style="text-transform:uppercase;">
              ${fe(f.errors, 'new_part_exact', 'e-new-part-exact')}
            </div>
            <div>
              <label for="f-new-part-desc">Material Description / Specification</label>
              <input id="f-new-part-desc" placeholder="e.g. Pancake Copper Tubing 1/4in x 15m Coil" value="${esc(f.new_part_desc || '')}" data-bind="of.new_part_desc">
            </div>
          </div>

          <div>
            <label for="f-sup">Accredited Supplier</label>
            <select id="f-sup" data-bind="of.supplier_id" ${f.errors && f.errors.supplier_id ? 'aria-invalid="true" aria-describedby="e-sup"' : ''}>
              <option value="">Choose an accredited supplier</option>
              ${opt(sups, f.supplier_id, (s) => s.name)}
            </select>
            ${fe(f.errors, 'supplier_id', 'e-sup')}
          </div>

          <div class="row" style="gap:10px;">
            <div class="field" style="flex:2;">
              <label for="f-price">Unit Price (${esc(companyProfile.currency_code)})</label>
              <input id="f-price" inputmode="decimal" placeholder="e.g. 380.00" value="${esc(f.price)}" data-bind="of.price" ${f.errors && f.errors.price ? 'aria-invalid="true" aria-describedby="e-price"' : ''}>
              ${fe(f.errors, 'price', 'e-price')}
            </div>
            <div class="field" style="flex:1;">
              <label for="f-cur">Currency</label>
              <input id="f-cur" maxlength="3" value="${esc(f.currency || companyProfile.currency_code)}" data-bind="of.currency" readonly style="background:var(--card-subtle);">
            </div>
          </div>

          <div class="row" style="gap:10px;">
            <div class="field">
              <label for="f-qty">Recorded Available Qty</label>
              <input id="f-qty" inputmode="numeric" placeholder="e.g. 45" value="${esc(f.recorded_quantity)}" data-bind="of.recorded_quantity" ${f.errors && f.errors.recorded_quantity ? 'aria-invalid="true" aria-describedby="e-qty"' : ''}>
              ${fe(f.errors, 'recorded_quantity', 'e-qty')}
            </div>
            <div class="field">
              <label for="f-date">Checked Date</label>
              <input id="f-date" type="date" value="${esc(f.checked_date)}" data-bind="of.checked_date">
            </div>
          </div>

          <div>
            <label for="f-src">Source Attribution / Invoice Ref</label>
            <input id="f-src" placeholder="e.g. Quotation Sheet #EW-2026-4491" value="${esc(f.source_reference)}" data-bind="of.source_reference">
          </div>

          <label style="display:flex; gap:10px; align-items:center; font-weight:400; cursor:pointer; margin-top:4px;">
            <input type="checkbox" data-bind="of.active" ${f.active ? 'checked' : ''}>
            <span>Active offer (uncheck to retire instead of hard deleting)</span>
          </label>

          <div class="row" style="gap:10px; margin-top:14px;">
            <button class="primary" type="submit" id="btn-submit-offer" style="flex:1; height:46px; font-weight:700;">
              ${f.id ? '✓ Update Offer' : '+ Add Offer'}
            </button>
            ${f.id ? `<button type="button" class="btn" data-action="delete-offer" data-id="${esc(f.id)}" data-part="${esc(f.part_id)}" style="height:46px; background:rgba(239,68,68,0.12); color:#EF4444; border-color:rgba(239,68,68,0.3); font-weight:600;">🗑️ Delete Offer</button>` : ''}
            <button type="button" class="btn" data-action="close-offer-modal" style="height:46px;">Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        removeExistingModal();
        offerForm = null;
      }
    });

    setTimeout(() => {
      const p = document.getElementById('f-part');
      if (p) p.focus();
    }, 50);
  }

  /* ---------- AI CSV / TEXT IMPORT MODAL ---------- */
  function renderAiImportModal() {
    removeExistingModal();
    parsedAiRows = [];
    const overlay = document.createElement('div');
    overlay.id = 'aiImportModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:680px;">
        <div class="catalog-modal-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:22px;">🤖</span>
              <h2 style="font-size:20px; font-weight:700; margin:0;">AI Part Normalization &amp; CSV Importer</h2>
            </div>
            <p class="small" style="color:var(--mute); margin-top:2px;">Paste vendor descriptions or CSV lines. AI parses and normalizes each entry to exact catalog components.</p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-ai-import-modal" aria-label="Close modal">&times;</button>
        </div>

        <div class="stack" style="gap:8px;">
          <div class="row" style="gap:6px; align-items:center; flex-wrap:wrap;">
            <span class="small" style="font-weight:600;">Load Test Samples:</span>
            <button type="button" class="ai-prompt-chip" data-action="load-ai-sample-1">📦 Split-Type Overhaul (3 parts)</button>
            <button type="button" class="ai-prompt-chip" data-action="load-ai-sample-2">⚡ Sensors &amp; Control Board (2 parts)</button>
          </div>

          <div>
            <label for="aiCsvInput">Paste CSV or messy supplier line items (Description, Quantity):</label>
            <textarea id="aiCsvInput" rows="5" style="width:100%; font-family:monospace; font-size:13px; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--card-subtle); color:var(--ink);" placeholder="e.g.&#10;45uf dual run capacitor, 2&#10;r410a freon gas 1kg can, 2&#10;defrost contactor 30a, 1"></textarea>
          </div>

          <div class="row" style="gap:10px;">
            <button type="button" class="btn primary" data-action="run-ai-csv-parse" style="flex:1; height:42px; font-weight:700;">⚡ Parse &amp; Normalize with AI</button>
            <button type="button" class="btn" data-action="close-ai-import-modal" style="height:42px;">Cancel</button>
          </div>
        </div>

        <div id="aiCsvResults" style="display:none; margin-top:12px;"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        removeExistingModal();
      }
    });
  }

  /* ---------- AI SMART QUOTATION INGEST MODAL ---------- */
  function renderAiQuoteIngestModal() {
    removeExistingModal();
    parsedAiQuoteItems = [];
    const overlay = document.createElement('div');
    overlay.id = 'aiQuoteIngestModalOverlay';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal-card stack" style="max-width:860px; width:95%; max-height:92vh; overflow-y:auto;">
        <div class="catalog-modal-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">🤖</span>
              <h2 style="font-size:20px; font-weight:700; margin:0; background:linear-gradient(135deg, #0D9488, #2563EB); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">AI Smart Quote Ingest Engine</h2>
              <span class="badge ok" style="background:#0D9488; color:#fff; font-size:11px;">Philippine HVAC Sourcing</span>
            </div>
            <p class="small" style="color:var(--mute); margin-top:3px;">
              Paste unstructured quotations from Viber / WhatsApp supplier chats, emails, or copied Excel ranges. The AI engine automatically detects accredited suppliers, resolves component SKUs, parses Philippine Peso (PHP) unit prices, and captures inventory counts.
            </p>
          </div>
          <button type="button" class="catalog-modal-close-btn" data-action="close-ai-quote-ingest" aria-label="Close modal">&times;</button>
        </div>

        <div class="stack" style="gap:10px;">
          <!-- 1-Click Interactive Test Samples -->
          <div style="background:var(--card-subtle); border:1px solid var(--line); border-radius:8px; padding:10px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
              <span class="small" style="font-weight:700; color:var(--ink);">⚡ Quick 1-Click Test Scenarios (Click to test AI parser):</span>
              <button type="button" class="btn" data-action="clear-ai-quote-input" style="font-size:11px; padding:2px 8px; height:auto;">🗑️ Clear</button>
            </div>
            <div class="row" style="gap:8px; flex-wrap:wrap;">
              <button type="button" class="ai-prompt-chip" data-action="load-ai-quote-sample-1" style="cursor:pointer; padding:6px 11px; border-radius:6px; border:1px solid rgba(13,148,136,0.3); background:rgba(13,148,136,0.08); font-size:12px; font-weight:600; color:var(--ink); display:inline-flex; align-items:center; gap:5px;">
                📱 <span>Viber Chat (Everwell &amp; C&amp;C Quotes)</span>
              </button>
              <button type="button" class="ai-prompt-chip" data-action="load-ai-quote-sample-2" style="cursor:pointer; padding:6px 11px; border-radius:6px; border:1px solid rgba(37,99,235,0.3); background:rgba(37,99,235,0.08); font-size:12px; font-weight:600; color:var(--ink); display:inline-flex; align-items:center; gap:5px;">
                📧 <span>Supplier Quotation Email (Manco Formal Ref)</span>
              </button>
              <button type="button" class="ai-prompt-chip" data-action="load-ai-quote-sample-3" style="cursor:pointer; padding:6px 11px; border-radius:6px; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.08); font-size:12px; font-weight:600; color:var(--ink); display:inline-flex; align-items:center; gap:5px;">
                📊 <span>Excel Tab-Delimited Copied Range</span>
              </button>
            </div>
          </div>

          <!-- Raw Input Textarea -->
          <div>
            <label for="aiQuoteInput" style="font-weight:600; display:block; margin-bottom:6px;">Paste Unstructured Supplier Quote / Chat / Email / Spreadsheet Table:</label>
            <textarea id="aiQuoteInput" rows="7" style="width:100%; font-family:monospace; font-size:13px; padding:12px; border-radius:8px; border:1px solid var(--line); background:var(--card-subtle); color:var(--ink); line-height:1.45; box-sizing:border-box;" placeholder="Example Viber Quote:&#10;Everwell Parts &amp; Equipment Corp. (Ref: EW-VIBER-2026-11)&#10;- CBB65 45uF 450V capacitor round - ₱405.00 each (45 pcs on hand)&#10;- R410A Refrigerant 1kg sealed can - Php 580.00 / can (stock: 60)&#10;&#10;C&amp;C Airconditioning Supply (Ref: CC-CHAT-882)&#10;- RPG20B Welling Indoor Blower Motor 20W 220V @ 1,180.00 pesos, 15 units available&#10;- HCC-1XU02AA Contactor 30A 1-Pole 240V - ₱340.00 (20 pcs avail)"></textarea>
          </div>

          <!-- Action Buttons -->
          <div class="row" style="gap:10px;">
            <button type="button" class="btn primary" data-action="run-ai-quote-parse" style="flex:1; height:44px; font-size:14px; font-weight:700; background:linear-gradient(135deg, #0D9488, #2563EB); border:none; color:#FFFFFF; display:flex; align-items:center; justify-content:center; gap:8px;">
              <span>⚡ Run AI Analysis &amp; Extract Quotes</span>
            </button>
            <button type="button" class="btn" data-action="close-ai-quote-ingest" style="height:44px;">Cancel</button>
          </div>
        </div>

        <div id="aiQuoteResultsContainer" style="display:none; margin-top:8px;"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        removeExistingModal();
        parsedAiQuoteItems = [];
      }
    });

    setTimeout(() => {
      const ta = document.getElementById('aiQuoteInput');
      if (ta) ta.focus();
    }, 50);
  }

  window.renderAiQuoteIngestModal = renderAiQuoteIngestModal;

  /* ---------- PREPARER WORKSPACE DASHBOARD ---------- */
  async function pageLists() {
    if (isAdminUser()) return go('#/');
    removeExistingModal();
    loading('Loading Preparer Workspace...');
    try {
      const [lists, allSummaries] = await Promise.all([API.listLists(), API.listSummaries()]);
      const totalLists = lists.length;
      const totalComponents = lists.reduce((acc, l) => acc + (l.lines ? l.lines.length : 0), 0);
      const activeDrafts = lists.filter((l) => !l.archived).length;

      setMain(
        '<div class="stack" style="gap:20px;">' +
          '<div class="preparer-header-wrap">' +
            '<div>' +
              '<div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">' +
                '<h1 style="font-size:26px; font-weight:700; margin:0;">Preparer Workspace</h1>' +
                '<span class="badge ok">Role: BOM Preparer / Field Technician</span>' +
              '</div>' +
              '<p class="sub">Build job parts lists, verify accredited supplier quotations, and freeze procurement decisions for ' + esc(companyProfile.business_name) + '.</p>' +
            '</div>' +
            '<div style="display:flex; gap:10px;">' +
              '<a href="#/summaries" class="btn" data-guide-key="preparer-view-summaries">View Saved Summaries</a>' +
            '</div>' +
          '</div>' +

          '<div class="preparer-metrics-grid">' +
            '<div class="metric-card" data-guide-key="preparer-metric-lists"><div class="metric-icon">📋</div><div><div class="metric-number">' + totalLists + '</div><div class="metric-label">Total BOM Lists</div></div></div>' +
            '<div class="metric-card" data-guide-key="preparer-metric-components"><div class="metric-icon">⚡</div><div><div class="metric-number">' + totalComponents + '</div><div class="metric-label">Components Listed</div></div></div>' +
            '<div class="metric-card" data-guide-key="preparer-metric-drafts"><div class="metric-icon">🔒</div><div><div class="metric-number">' + activeDrafts + '</div><div class="metric-label">Active Comparison Drafts</div></div></div>' +
          '</div>' +

          '<div class="preparer-guide-banner">' +
            '<div class="guide-step-item" data-guide-key="preparer-step-1"><span class="guide-step-badge">Step 1</span><strong>Create or Edit BOM</strong><p>Add exact part numbers with whole-piece quantities needed for a job.</p></div>' +
            '<div class="guide-step-arrow">→</div>' +
            '<div class="guide-step-item" data-guide-key="preparer-step-2"><span class="guide-step-badge">Step 2</span><strong>AI Multi-Objective Sourcing</strong><p>Optimize for lowest cost, single-supplier consolidation, or MCDA utility.</p></div>' +
            '<div class="guide-step-arrow">→</div>' +
            '<div class="guide-step-item" data-guide-key="preparer-step-3"><span class="guide-step-badge">Step 3</span><strong>Freeze Sourcing Summary</strong><p>Lock the verified prices, compliance proofs, and AI executive briefing.</p></div>' +
          '</div>' +

          '<div class="grid2">' +
            '<section class="card stack" aria-labelledby="lh">' +
              '<div class="row between" style="align-items:center;">' +
                '<div><h2 id="lh" style="font-size:18px; font-weight:700;">Active BOM Lists (' + lists.length + ')</h2><p class="small" style="color:var(--mute);">Each list represents a specific maintenance overhaul.</p></div>' +
              '</div>' +
              '<div class="tbl">' +
                '<table>' +
                  '<thead><tr><th>Project Title</th><th class="num">Lines</th><th>Procurement &amp; Governance Status</th><th>Actions</th></tr></thead>' +
                  '<tbody>' +
                    (lists.length ? lists.map((l) => {
                      const linkedSummary = (allSummaries || []).find((s) => s.list_id === l.id || (s.title && s.title.toLowerCase().trim() === l.title.toLowerCase().trim()));
                      const isApproved = linkedSummary && linkedSummary.approval_status === 'APPROVED';
                      const isFrozen = !!linkedSummary;

                      let statusBadge = '';
                      if (isApproved) {
                        statusBadge = '<span class="badge ok" style="background:#059669; color:#fff; font-weight:700; padding:3px 8px;" title="Authorized by ' + esc(linkedSummary.approved_by || 'Admin') + '">✓ Approved (PO Released)</span>'
                          + '<div class="small" style="color:#059669; font-size:11px; margin-top:2px;">By ' + esc(linkedSummary.approved_by || 'Admin') + '</div>';
                      } else if (isFrozen) {
                        statusBadge = '<span class="badge warn" style="background:rgba(234,179,8,0.15); color:#CA8A04; border:1px solid rgba(234,179,8,0.3); font-weight:700; padding:3px 8px;">🟡 Sourcing Frozen</span>'
                          + '<div class="small" style="color:var(--mute); font-size:11px; margin-top:2px;">Awaiting Karen Reyes</div>';
                      } else if (l.archived) {
                        statusBadge = badge('gray', 'Archived');
                      } else {
                        statusBadge = '<span class="badge" style="background:rgba(59,130,246,0.15); color:#3B82F6; font-weight:600;">Drafting BOM</span>';
                      }

                      return '<tr>' +
                        '<td><strong style="color:var(--ink);"><a href="#/lists/' + esc(l.id) + '">' + esc(l.title) + '</a></strong><div class="small" style="color:var(--mute);">Revision ' + l.revision + '</div></td>' +
                        '<td class="num font-mono">' + (l.lines ? l.lines.length : 0) + '</td>' +
                        '<td>' + statusBadge + '</td>' +
                        '<td><div class="row" style="gap:6px; align-items:center; flex-wrap:wrap;">' +
                        '<a class="btn" style="padding:4px 10px; font-size:12px;" href="#/lists/' + esc(l.id) + '" data-guide-key="preparer-edit-bom">Edit</a>' +
                        '<a class="btn primary" style="padding:4px 10px; font-size:12px;" href="#/compare/' + esc(l.id) + '" data-guide-key="preparer-compare-bom">Compare</a>' +
                        (linkedSummary ? '<a class="btn" style="padding:4px 8px; font-size:12px; background:rgba(5,150,105,0.1); color:#059669; border:1px solid rgba(5,150,105,0.25); font-weight:600;" href="#/summaries/' + esc(linkedSummary.id) + '" data-guide-key="preparer-sheet-bom" title="View Sourcing Job Sheet &amp; Sign-Off">📄 Sheet</a>' : '') +
                        '<button type="button" class="btn btn-sm" style="padding:4px 8px; font-size:12px; background:rgba(239,68,68,0.12); color:#EF4444; border:1px solid rgba(239,68,68,0.25); font-weight:600;" data-action="delete-list" data-id="' + esc(l.id) + '" data-title="' + esc(l.title) + '" data-guide-key="preparer-delete-bom" title="Permanently delete BOM list">🗑️ Delete</button>' +
                        '</div></td>' +
                      '</tr>';
                    }).join('') : '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--mute);">No BOM lists found. Create your first list below.</td></tr>') +
                  '</tbody>' +
                '</table>' +
              '</div>' +
            '</section>' +

            '<section class="card stack" aria-labelledby="nh">' +
              '<h2 id="nh" style="font-size:18px; font-weight:700;">Create New BOM List</h2>' +
              '<p class="small" style="color:var(--mute);">Start a new Bill of Materials for an upcoming job estimate.</p>' +
              '<form id="newlist" class="stack" novalidate style="margin-top:6px;">' +
                '<div>' +
                  '<label for="nl">Project Title / Job Reference</label>' +
                  '<input id="nl" placeholder="e.g. Split-Type Overhaul (Job #AC-2026-089)" required>' +
                  '<div class="err" id="nl-err" hidden></div>' +
                '</div>' +
                '<button class="primary" type="submit" data-guide-key="preparer-create-bom" style="margin-top:8px;">+ Create Blank BOM List</button>' +
              '</form>' +
            '</section>' +
          '</div>' +
        '</div>'
      );
    } catch (e) { errorPage(e); }
  }

  /* ---------- BOM LIST EDITOR ---------- */
  async function pageEditor(id) {
    removeExistingModal();
    loading('Loading list...');
    try {
      const [list, parts, allSummaries] = await Promise.all([API.getList(id), API.listParts(), API.listSummaries()]);
      const linkedSummary = (allSummaries || []).find((s) => s.list_id === list.id || (s.title && s.title.toLowerCase().trim() === list.title.toLowerCase().trim()));
      ed = { 
        id: list.id, 
        revision: list.revision, 
        title: list.title, 
        archived: list.archived, 
        parts, 
        errors: null, 
        error: null, 
        saved: false,
        linkedSummary,
        lines: list.lines.map((l) => ({ id: l.id, part_id: l.part_id, quantity: String(l.quantity) })) 
      };
      drawEditor();
    } catch (e) { errorPage(e); }
  }

  function drawEditor(preserveScroll = false) {
    const er = ed.errors || {}; const le = er.lines || {};
    const partCounts = {};
    ed.lines.forEach((l) => { if (l.part_id) partCounts[l.part_id] = (partCounts[l.part_id] || 0) + 1; });
    const dupParts = Object.keys(partCounts).filter((k) => partCounts[k] > 1);
    const hasDup = dupParts.length > 0;
    const dupPartNames = dupParts.map((pid) => {
      const p = ed.parts.find((item) => item.id === pid);
      return p ? p.exact_id : pid;
    });

    const rows = ed.lines.map((l, i) => {
      const isDup = l.part_id && partCounts[l.part_id] > 1;
      const isImported = ed.lastImportedPartIds && ed.lastImportedPartIds.has(l.part_id);
      const bad = !!le[i] || isDup;
      return '<tr' + (bad ? ' class="row-bad"' : isImported ? ' class="row-uploaded-success"' : '') + '><td style="min-width:220px"><label class="sr" for="lp' + i + '">Part for line ' + (i + 1) + '</label><select id="lp' + i + '" data-bind="line.part" data-i="' + i + '"' + (bad ? ' aria-invalid="true" aria-describedby="le' + i + '"' : '') + '><option value="">Choose a verified component</option>'
        + ed.parts.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === l.part_id ? ' selected' : '') + (!p.active ? ' disabled' : '') + '>' + esc(p.exact_id) + ' - ' + esc(p.description) + '</option>').join('') + '</select>'
        + (isImported ? ' <span class="badge ok" style="font-size:10px; margin-left:4px; vertical-align:middle;">✓ Uploaded from CSV (BOM)</span>' : '')
        + (bad ? '<div class="err" id="le' + i + '">' + esc(le[i] || (isDup ? 'Duplicate part on BOM.' : '')) + '</div>' : '') + '</td>'
        + '<td style="width:130px"><label class="sr" for="lq' + i + '">Quantity for line ' + (i + 1) + '</label><input id="lq' + i + '" inputmode="numeric" value="' + esc(l.quantity) + '" data-bind="line.qty" data-i="' + i + '"' + (bad ? ' aria-invalid="true"' : '') + '></td>'
        + '<td><button type="button" class="link" data-action="remove-line" data-i="' + i + '" aria-label="Remove line ' + (i + 1) + '">Remove</button></td></tr>';
    }).join('');

    const dupBanner = hasDup 
      ? alertBox('bad', '⚠️ <strong>' + esc(dupPartNames.join(', ')) + '</strong> is already on this BOM. Edit its quantity instead of adding a second line.', 'alert')
      : '';

    const summaryBanner = ed.linkedSummary
      ? (ed.linkedSummary.approval_status === 'APPROVED'
        ? alertBox('ok', '🛡️ <strong>Official Procurement Authorization Active:</strong> Sourcing for this BOM was evaluated and officially approved by <strong>' + esc(ed.linkedSummary.approved_by || 'Admin') + '</strong> on ' + esc(fmtTime(ed.linkedSummary.approved_at)) + '. <a href="#/summaries/' + esc(ed.linkedSummary.id) + '" style="font-weight:700; text-decoration:underline; margin-left:6px;">View Signed Job Sheet →</a>')
        : alertBox('warn', '⏳ <strong>Sourcing Snapshot Frozen:</strong> A sourcing comparison for this BOM is currently <strong>awaiting Administrative Sign-Off</strong> before PO release. <a href="#/summaries/' + esc(ed.linkedSummary.id) + '" style="font-weight:700; text-decoration:underline; margin-left:6px;">View Pending Job Sheet →</a>'))
      : '';

    setMain('<div class="row between" style="align-items:center"><div><h1>Edit BOM List</h1><p class="sub">Revision ' + ed.revision + '. Enter whole-piece quantities. Each component appears once per BOM.</p></div><a class="btn" href="#/lists">Back to lists</a></div>'
      + summaryBanner
      + dupBanner
      + (ed.notice ? alertBox('ok', esc(ed.notice), 'status') : '')
      + (ed.error ? alertBox('bad', esc(ed.error), 'alert') + (ed.conflict ? '<div><button type="button" data-action="reload-list">Reload latest (discards your edits)</button></div>' : '') : '')
      + (ed.saved ? alertBox('ok', 'Saved. Now at revision ' + ed.revision + '.', 'status') : '')
      + '<form id="editor" class="card stack" novalidate><div><label for="t">Project Title</label><input id="t" value="' + esc(ed.title) + '" data-bind="ed.title"' + (er.title ? ' aria-invalid="true" aria-describedby="et"' : '') + '>' + fe(er, 'title', 'et') + '</div>'
      + (ed.lines.length ? '<div class="tbl"><table><thead><tr><th>Verified Component</th><th>Quantity Needed</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="sub">This BOM is currently empty. Add lines below or use AI Import.</p>')
      + '<div class="row" style="gap:10px;">'
      + '<button type="button" data-action="add-line" data-guide-key="editor-add-line">+ Add Line Item</button>'
      + '<button type="button" class="btn" data-action="open-ai-import-modal" data-guide-key="editor-ai-import" style="display:inline-flex;align-items:center;gap:6px;">🤖 AI CSV / Text Import</button>'
      + '</div>'
      + '<label style="display:flex;gap:10px;align-items:center;font-weight:400"><input type="checkbox" data-bind="ed.archived"' + (ed.archived ? ' checked' : '') + '> Archived</label>'
      + '<div class="row" style="gap:10px;"><button class="primary" data-guide-key="editor-save-bom" type="submit"' + (hasDup ? ' disabled' : '') + '>Save BOM Changes</button><a class="btn" href="#/compare/' + esc(ed.id) + '" ' + (ed.lines.length && !ed.dirty && !hasDup ? '' : 'aria-disabled="true" tabindex="-1"') + ' data-guide-key="editor-compare-bom">Compare Saved BOM</a></div>'
      + (ed.dirty ? '<p class="small" style="color:var(--warn);">Save changes before proceeding to comparison.</p>' : '') + '</form>',
      preserveScroll
    );
  }

  /* ---------- COMPARISON & DYNAMIC MCDA OPTIMIZATION ---------- */
  async function pageCompare(id) {
    removeExistingModal();
    loading('Preparing comparison with accredited suppliers...');
    try {
      const policy = await API.getPolicy();
      cmp = { 
        id, 
        selections: {}, 
        strategy: 'lowest_cost', 
        result: null, 
        policy, 
        error: null, 
        saveState: 'idle', 
        token: API.newToken(), 
        savedId: null, 
        settingErrors: null,
        vatMode: 'both'
      };
      if (!policy) { drawCompare(); return; }
      cmp.result = await API.compare(id, cmp.selections);
      
      // Auto-apply default lowest cost strategy selections
      if (window.PC_AI && typeof window.PC_AI.recommendStrategy === 'function') {
        const mcdaW = await API.getMcdaWeights();
        cmp.selections = window.PC_AI.recommendStrategy(cmp.result, 'lowest_cost', mcdaW);
        cmp.result = await API.compare(id, cmp.selections);
      }
      
      drawCompare();
    } catch (e) {
      if (e.code === 'EMPTY_LIST') { 
        setMain('<div class="card stack"><h1>Cannot compare</h1>' + alertBox('warn', 'This list is empty. Add at least one line item first.', 'alert') + '<div><a class="btn" href="#/lists/' + esc(id) + '">Edit list</a></div></div>'); 
        return; 
      }
      errorPage(e);
    }
  }

  function candHtml(line, c) {
    const lowest = line.lowest_eligible_offer_ids.includes(c.offer_id);
    const tie = lowest && line.lowest_eligible_offer_ids.length > 1;
    const chosen = line.selected_offer_id === c.offer_id;

    const vMode = (cmp && cmp.vatMode) || 'both';
    const cv = computeVat(c.price_minor);

    let priceTag = '';
    if (vMode === 'exclusive') {
      priceTag = '<strong class="font-mono">' + money(cv.net, c.currency) + '</strong> <span class="badge gray" style="font-size:9.5px;padding:1px 5px;">Net (excl. 12% VAT)</span> <span class="small" style="color:var(--mute);">(Gross: ' + money(cv.gross, c.currency) + ')</span>';
    } else if (vMode === 'inclusive') {
      priceTag = '<strong class="font-mono">' + money(cv.gross, c.currency) + '</strong> <span class="badge ok" style="font-size:9.5px;padding:1px 5px;">12% VAT Included</span>';
    } else {
      priceTag = '<strong class="font-mono">' + money(cv.gross, c.currency) + '</strong> <span class="badge ok" style="font-size:9.5px;padding:1px 5px;">VAT Incl</span>'
        + '<div class="small font-mono" style="color:var(--mute);margin-top:2px;">&bull; Net of VAT: <strong>' + money(cv.net, c.currency) + '</strong> &bull; 12% VAT: <strong>' + money(cv.vat, c.currency) + '</strong></div>';
    }

    const trendTag = (c.prev_price_minor != null && c.price_minor != null && c.price_minor !== c.prev_price_minor)
      ? ' &middot; <span class="' + (c.price_minor < c.prev_price_minor ? 'po-trend-down' : 'po-trend-up') + '">' + (c.price_minor < c.prev_price_minor ? '▼ -₱' : '▲ +₱') + (Math.abs(c.price_minor - c.prev_price_minor) / 100).toFixed(2) + ' vs prev</span>'
      : '';
    const meta = esc(c.supplier_name) + ' &middot; ' + priceTag + trendTag + ' &middot; stock ' + (c.recorded_quantity == null ? 'missing' : c.recorded_quantity)
      + '<br><span class="small">Checked ' + fmtDate(c.checked_date) + ' &middot; ' + esc(c.source_reference || 'No source') + (c.synthetic ? ' &middot; synthetic' : '') + '</span>';
    if (c.eligible) {
      return '<div class="cand' + (chosen ? ' sel' : '') + '"><label><input type="radio" name="sel-' + esc(line.line_id) + '" value="' + esc(c.offer_id) + '" data-bind="select" data-line="' + esc(line.line_id) + '"' + (chosen ? ' checked' : '') + '><span>' + meta
        + '<br>' + badge('ok', '&#10003; Eligible') + (lowest ? ' ' + badge('gray', tie ? 'Tied lowest eligible price' : 'Lowest eligible price') : '') + '</span></label></div>';
    }
    return '<div class="cand off"><div>' + meta + '<br>' + badge('bad', 'Excluded') + '<ul style="margin:6px 0 0;padding-left:18px">' + c.reasons.map((r) => '<li>' + esc(REASONS[r] || r) + '</li>').join('') + '</ul></div></div>';
  }

  function drawCompare(preserveScroll = false) {
    const back = '<a class="btn" href="#/lists/' + esc(cmp.id) + '">Back to BOM Editor</a>';
    if (!cmp.policy) {
      const se = cmp.settingErrors || {};
      setMain('<div class="row between" style="align-items:center"><h1>Compare</h1>' + back + '</div>'
        + alertBox('warn', '<strong>CONFIG_REQUIRED.</strong> No comparison policy has been adopted yet.', 'alert')
        + '<form id="policy" class="card stack" style="max-width:480px" novalidate><h2>Adopt Sourcing Policy</h2>'
        + '<div><label for="pa">Maximum age of checked date (Days)</label><input id="pa" inputmode="numeric" placeholder="14" value="14"' + (se.max_age_days ? ' aria-invalid="true" aria-describedby="pae"' : '') + '>' + fe(se, 'max_age_days', 'pae') + '</div>'
        + '<div><label for="pc">Currency code</label><input id="pc" value="PHP" maxlength="3"' + (se.currency ? ' aria-invalid="true" aria-describedby="pce"' : '') + '>' + fe(se, 'currency', 'pce') + '</div>'
        + '<button class="primary" type="submit">Adopt Policy</button></form>', preserveScroll);
      return;
    }

    const r = cmp.result; 
    const s = r.summary; 
    const complete = s.status === 'COMPLETE';
    const vatMode = cmp.vatMode || 'both';

    // 12% Philippine VAT Calculations
    const sv = computeVat(s.subtotal_minor);

    const noteBlock = '<ul class="small" style="margin:0;padding-left:18px"><li>Each line uses one accredited supplier offer covering 100% quantity. Split shipments are prohibited per ' + esc(companyProfile.business_name) + ' service guidelines.</li><li>Standard Philippine 12% VAT is computed in compliance with BIR tax regulations (Republic Act No. 9337).</li><li>Prices reflect verified supplier quotations.</li><li>Unresolved components are never treated as ' + esc(companyProfile.currency_symbol || '₱') + '0.00.</li></ul>';

    setMain(
      '<div class="row between" style="align-items:center"><div><h1>BOM Sourcing Comparison</h1><p class="sub">Policy ' + esc(r.policy_version) + ' &middot; max age ' + r.policy.max_age_days + ' days &middot; ' + esc(r.currency) + ' &middot; evaluated ' + esc(r.evaluation_date) + '</p></div>' + back + '</div>'
      + (cmp.error ? alertBox('bad', esc(cmp.error.message) + ' <span class="small">(' + esc(cmp.error.code) + ')</span>', 'alert') + (cmp.error.code === 'INPUT_CHANGED' || cmp.error.code === 'CATALOG_DRIFT_DETECTED' ? '<div style="margin-top:6px;"><button type="button" class="btn primary" data-action="rereview">⚡ Review Again (Re-evaluate Live Quotes)</button></div>' : '') : '')
      + (cmp.savedId ? alertBox('ok', 'Saved as a ' + (complete ? 'complete' : 'partial') + ' sourcing summary snapshot. <a href="#/summaries/' + esc(cmp.savedId) + '">Open Saved Summary</a>.', 'status') : '')
      
      /* PRINT HEADER (VISIBLE ONLY ON PRINT) */
      + '<div class="print-amgc-header">'
      + '<h1 style="font-size:22pt; margin:0 0 4px;">' + esc(companyProfile.business_name) + '</h1>'
      + '<div style="font-size:10pt; color:#444;">' + esc(companyProfile.business_type) + ' &bull; ' + esc(companyProfile.location) + ' &bull; Contact: ' + esc(companyProfile.contact_number || '+63 (02) 8655-2491') + '</div>'
      + '<div style="font-size:10pt; margin-top:8px; font-weight:bold;">OFFICIAL BILL OF MATERIALS SOURCING JOB SHEET &bull; PRE-PROCUREMENT EVALUATION</div>'
      + '<div style="font-size:9pt; color:#666;">Evaluation Date: ' + esc(r.evaluation_date) + ' | Fingerprint: ' + esc(r.review_fingerprint) + '</div>'
      + '<div style="margin-top:8px; padding:6px 0; border-top:1px dashed #666; font-size:9.5pt;">'
      + 'Net Sourcing Base: ' + money(sv.net, r.currency) + ' &bull; 12% Value Added Tax: ' + money(sv.vat, r.currency) + ' &bull; <strong>Total Amount Due: ' + money(sv.gross, r.currency) + '</strong>'
      + '</div>'
      + '</div>'

      + '<section class="card stack" aria-labelledby="sh">'
      + '<div class="row between" style="align-items:flex-start; flex-wrap:wrap; gap:16px;">'
      + '<div><h2 id="sh">Components Subtotal' + (complete ? '' : ' (Partial)') + '</h2>'
      + '<div class="total">' + money(s.subtotal_minor, r.currency) + ' <span class="small" style="font-size:14px;font-weight:400;color:var(--mute);">(VAT Included)</span></div>'
      + '<div class="small">' + (r.lines.length - s.unresolved_count) + ' of ' + r.lines.length + ' lines resolved ' + (complete ? badge('ok', '&#10003; Ready for Sourcing') : badge('warn', '! Incomplete Lines Pending')) + '</div></div>'
      + '<div class="row" style="gap:8px;"><button class="primary" type="button" data-action="save-summary"' + (cmp.saveState === 'saving' || cmp.savedId ? ' disabled' : '') + ' data-guide-key="compare-save-summary">' + (cmp.saveState === 'saving' ? 'Saving Snapshot...' : cmp.saveState === 'failed' ? 'Retry Save' : 'Save Sourcing Summary') + '</button><button type="button" class="btn" id="btn-print-compare-sheet" data-action="print-job-sheet" data-guide-key="compare-print-sheet" style="font-weight:600;">🖨️ Print Sourcing Job Sheet</button></div></div>'

      /* PHILIPPINE 12% VAT BREAKDOWN & VIEW CONTROLS */
      + '<div class="vat-tax-summary-box" style="margin-top:14px; padding:14px 18px; background:var(--card-subtle); border:1px solid var(--line); border-radius:12px;">'
      + '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">'
      + '<div style="display:flex; align-items:center; gap:8px;">'
      + '<span style="font-size:20px;">🧾</span>'
      + '<div><strong style="font-size:14.5px;">Philippine 12% Value Added Tax (VAT) Breakdown</strong><div class="small" style="color:var(--mute);">BIR Republic Act 9337 / Official Invoicing Standards</div></div>'
      + '</div>'
      + '<div class="row" style="gap:6px; flex-wrap:wrap; align-items:center;">'
      + '<span class="small" style="color:var(--mute); font-weight:600; margin-right:4px;">VAT View:</span>'
      + '<button type="button" class="btn ' + (vatMode === 'both' ? 'primary' : '') + '" data-action="set-vat-mode" data-mode="both" data-guide-key="compare-vat-dual" style="font-size:12px; padding:5px 12px; font-weight:600;">📊 Dual View (Net &amp; Gross)</button>'
      + '<button type="button" class="btn ' + (vatMode === 'inclusive' ? 'primary' : '') + '" data-action="set-vat-mode" data-mode="inclusive" data-guide-key="compare-vat-inclusive" style="font-size:12px; padding:5px 12px; font-weight:600;">🏷️ VAT-Inclusive (Gross)</button>'
      + '<button type="button" class="btn ' + (vatMode === 'exclusive' ? 'primary' : '') + '" data-action="set-vat-mode" data-mode="exclusive" data-guide-key="compare-vat-exclusive" style="font-size:12px; padding:5px 12px; font-weight:600;">📑 Net of VAT (Excl.)</button>'
      + '</div></div>'

      + '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">'
      + '<div style="background:var(--card-bg); padding:12px 16px; border-radius:8px; border:1px solid var(--line);">'
      + '<div class="small" style="color:var(--mute); font-weight:600;">1. Net of VAT (Vatable Sales)</div>'
      + '<div class="font-mono" style="font-size:19px; font-weight:700; color:var(--ink); margin:4px 0 2px;">' + money(sv.net, r.currency) + '</div>'
      + '<div class="small" style="font-size:11.5px; color:var(--mute);">Component base cost before tax</div></div>'

      + '<div style="background:var(--card-bg); padding:12px 16px; border-radius:8px; border:1px solid var(--line);">'
      + '<div class="small" style="color:var(--mute); font-weight:600;">2. 12% Value Added Tax</div>'
      + '<div class="font-mono" style="font-size:19px; font-weight:700; color:#0D9488; margin:4px 0 2px;">+ ' + money(sv.vat, r.currency) + '</div>'
      + '<div class="small" style="font-size:11.5px; color:var(--mute);">12% standard BIR tax amount</div></div>'

      + '<div style="background:rgba(45,212,191,0.08); padding:12px 16px; border-radius:8px; border:1px solid rgba(45,212,191,0.3);">'
      + '<div class="small" style="color:var(--teal); font-weight:700;">3. Total Sourcing Cost (VAT Included)</div>'
      + '<div class="font-mono" style="font-size:21px; font-weight:700; color:var(--teal); margin:4px 0 2px;">' + money(sv.gross, r.currency) + '</div>'
      + '<div class="small" style="font-size:11.5px; color:var(--teal);">Official invoice payable total</div></div>'
      + '</div></div>'

      + (complete ? '' : alertBox('warn', '<strong>' + s.unresolved_count + ' unresolved line' + (s.unresolved_count > 1 ? 's' : '') + '.</strong> Their cost is omitted and not counted as zero. The saved summary will be flagged as partial until fully resolved.'))
      + (r.summary && r.summary.below_quorum_count ? '<div class="alert warn" data-guide-key="compare-quorum-notice" style="margin-top:8px; font-size:12.5px; cursor:help;">⚠️ <strong>Procurement Quorum Notice:</strong> ' + r.summary.below_quorum_count + ' component line(s) have fewer than the required ' + ((r.summary && r.summary.required_supplier_quotes) || (companyProfile && companyProfile.required_supplier_quotes) || 3) + ' competitive supplier bids per corporate benchmark policy.</div>' : '')
      + noteBlock + '</section>'

      /* AI SOURCING STRATEGY OPTIMIZER BAR */
      + '<section class="card stack" style="background:var(--card-subtle); padding:16px;">'
      + '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:10px;">'
      + '<div><div style="display:flex; align-items:center; gap:8px;"><span style="font-size:18px;">🤖</span><h3 style="font-size:16px; font-weight:700; margin:0;">AI Sourcing Strategy Optimizer</h3></div><p class="small" style="color:var(--mute); margin:2px 0 0;">Auto-assign candidate offers using configured MCDA utility weights:</p></div>'
      + '<div class="row" style="gap:6px; flex-wrap:wrap;">'
      + '<button type="button" class="ai-strat-btn ' + (cmp.strategy === 'lowest_cost' ? 'active' : '') + '" data-action="apply-strategy" data-strat="lowest_cost" data-guide-key="compare-lowest-cost">⚡ Lowest Cost (' + esc(companyProfile.currency_symbol || '₱') + ')</button>'
      + '<button type="button" class="ai-strat-btn ' + (cmp.strategy === 'consolidation' ? 'active' : '') + '" data-action="apply-strategy" data-strat="consolidation" data-guide-key="compare-single-supplier">📦 Single Supplier</button>'
      + '<button type="button" class="ai-strat-btn ' + (cmp.strategy === 'resilience' ? 'active' : '') + '" data-action="apply-strategy" data-strat="resilience" data-guide-key="compare-stock-resilience">🛡️ Stock Resilience</button>'
      + '<button type="button" class="ai-strat-btn ' + (cmp.strategy === 'balanced' ? 'active' : '') + '" data-action="apply-strategy" data-strat="balanced" data-guide-key="compare-balanced-mcda">⚖️ Balanced MCDA</button>'
      + '</div></div></section>'

      + '<section class="card" aria-labelledby="lh">'
      + '<div class="row between" style="align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">'
      + '<h2 id="lh" style="margin:0;">BOM Component Lines &amp; Candidate Quotations</h2>'
      + '<span class="badge gray" style="font-size:11.5px;">Active Pricing Mode: ' + (vatMode === 'both' ? '📊 Dual View (Gross &amp; Net)' : vatMode === 'exclusive' ? '📑 Net of 12% VAT' : '🏷️ VAT-Inclusive (Gross)') + '</span>'
      + '</div>'
      + '<div class="tbl"><table><thead><tr><th>Exact Component</th><th class="num">Qty</th><th>Accredited Supplier Offers (Choose One)</th><th class="num">Line Cost (VAT Detail)</th><th>Status</th></tr></thead><tbody>'
      + r.lines.map((l) => {
          const lv = computeVat(l.line_cost_minor);
          let lineCostDisplay = 'Not counted';
          if (l.line_cost_minor != null) {
            if (vatMode === 'exclusive') {
              lineCostDisplay = '<div class="mono" style="font-weight:700;">' + money(lv.net, r.currency) + '</div>'
                + '<div class="small font-mono" style="color:var(--mute);">Net of 12% VAT</div>'
                + '<div class="small font-mono" style="color:var(--mute);">(Gross: ' + money(lv.gross, r.currency) + ')</div>';
            } else if (vatMode === 'inclusive') {
              lineCostDisplay = '<div class="mono" style="font-weight:700;color:var(--teal);">' + money(lv.gross, r.currency) + '</div>'
                + '<div class="small font-mono" style="color:var(--ok);">&#10003; 12% VAT Included</div>';
            } else {
              lineCostDisplay = '<div class="mono" style="font-weight:700;">' + money(lv.gross, r.currency) + ' <span class="badge ok" style="font-size:9.5px;padding:1px 5px;">VAT Incl</span></div>'
                + '<div class="small font-mono" style="color:var(--mute);margin-top:2px;">Net: ' + money(lv.net, r.currency) + '<br>12% VAT: ' + money(lv.vat, r.currency) + '</div>';
            }
          }

          const reqQuotes = (r.summary && r.summary.required_supplier_quotes) || (companyProfile && companyProfile.required_supplier_quotes) || 3;
          const eligCount = l.eligible_count != null ? l.eligible_count : l.candidates.filter(c => c.eligible).length;
          const quorumBadge = '<div style="margin-bottom:6px; display:flex; align-items:center; gap:6px;">'
            + '<span class="badge ' + (eligCount >= reqQuotes ? 'ok' : 'warn') + '" style="font-size:10px; padding:2px 6px;">'
            + eligCount + ' / ' + reqQuotes + ' Quotes'
            + '</span>'
            + (eligCount < reqQuotes ? '<span class="small" style="color:var(--warn); font-size:11px;">(Below ' + reqQuotes + '-quote quorum)</span>' : '')
            + '</div>';

          return '<tr' + (l.line_status === 'UNRESOLVED' ? ' class="row-bad"' : '') + '><td style="min-width:160px"><div class="mono" style="font-weight:700;">' + esc(l.exact_id) + '</div><div class="small" style="color:var(--mute);">' + esc(l.description) + '</div></td><td class="num font-mono">' + l.quantity + '</td>'
            + '<td style="min-width:320px">' + quorumBadge + (l.candidates.length ? l.candidates.map((c) => candHtml(l, c)).join('') : '<span class="small" style="color:var(--bad);">No supplier quotation recorded for this component.</span>') + '</td>'
            + '<td class="num">' + lineCostDisplay + '</td>'
            + '<td>' + (l.line_status === 'RESOLVED' ? badge('ok', '&#10003; Resolved') : badge('bad', '! Unresolved') + '<div class="small" style="margin-top:4px">' + esc(UNRESOLVED[l.unresolved_reason] || l.unresolved_reason) + '</div>') + '</td></tr>';
        }).join('')
      + '</tbody></table></div></section>'

      + '<section class="demo-tools stack" aria-label="Demo tools"><strong>Catalog Drift Simulation</strong><p class="small">Simulate price drift or catalog update by bumping a supplier quote. The review fingerprint will reject out-of-date saves until re-evaluated.</p><div><button type="button" id="btn-simulate-drift" data-action="demo-change" data-guide-key="compare-simulate-drift" style="font-weight:600;">⚡ Simulate a Catalog Price Drift</button></div></section>',
      preserveScroll
    );
  }

  async function refreshCompare(preserveScroll = true) {
    cmp.result = await API.compare(cmp.id, cmp.selections);
    drawCompare(preserveScroll);
  }

  /* ---------- SAVED SUMMARIES ---------- */
  async function pageSummaries() {
    removeExistingModal();
    loading('Loading summaries...');
    try {
      const list = await API.listSummaries();
      setMain('<div><h1>Saved Sourcing Summaries</h1><p class="sub">Frozen historical snapshots for ' + esc(companyProfile.business_name) + '. Each record permanently preserves the exact prices, supplier sources, and rules active at sign-off.</p></div>'
        + (list.length ? '<div class="stack">' + list.map((x) => {
            const isApproved = x.approval_status === 'APPROVED';
            const approvalBadge = isApproved 
              ? '<span class="badge ok" style="background:#059669; color:#fff; font-weight:700;">✓ Approved by ' + esc(x.approved_by || 'Admin') + '</span>'
              : '<span class="badge warn" style="background:rgba(234,179,8,0.15); color:#CA8A04; border:1px solid rgba(234,179,8,0.3); font-weight:700;">🟡 Pending Admin Sign-Off</span>';

            return '<div class="list-card" style="display:flex; justify-content:space-between; align-items:center; text-decoration:none;">' +
              '<a href="#/summaries/' + esc(x.id) + '" style="flex:1; text-decoration:none; color:inherit;">' +
                '<div class="row between" style="align-items:center">' +
                  '<div>' +
                    '<strong style="color:var(--ink); font-size:16px;">' + esc(x.title) + '</strong>' +
                    '<div class="small" style="color:var(--mute); margin-top:2px;">Evaluated by ' + esc(x.author_name || 'BOM Preparer') + ' &middot; ' + esc(fmtTime(x.created_at)) + '</div>' +
                    (isApproved 
                      ? '<div class="small" style="color:#059669; font-weight:600; margin-top:3px;">🛡️ Officially Authorized for Purchase Order Dispatch &middot; ' + esc(fmtTime(x.approved_at)) + '</div>'
                      : '<div class="small" style="color:#CA8A04; font-weight:600; margin-top:3px;">⏳ Awaiting Operations Manager / Admin Authorization</div>') +
                  '</div>' +
                  '<div class="row" style="align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<span class="mono" style="font-weight:700; font-size:15px;">' + money(x.subtotal_minor, x.currency) + '</span>' +
                    (x.status === 'COMPLETE' ? badge('ok', '&#10003; 100% Complete') : badge('warn', '! Incomplete Lines')) +
                    approvalBadge +
                  '</div>' +
                '</div>' +
              '</a>' +
              '<button type="button" class="btn btn-sm" style="margin-left:14px; font-size:11.5px; padding:4px 8px; font-weight:600; background:rgba(239,68,68,0.12); color:#EF4444; border:1px solid rgba(239,68,68,0.25);" data-action="delete-summary" data-id="' + esc(x.id) + '" data-title="' + esc(x.title) + '" title="Permanently delete summary">🗑️ Delete</button>' +
            '</div>';
          }).join('') + '</div>'
          : '<div class="card"><p class="sub">No saved summaries yet. Compare a BOM list and save it.</p><div style="margin-top:12px"><a class="btn primary" href="#/lists">Go to Preparer Workspace</a></div></div>'));
    } catch (e) { errorPage(e); }
  }

  async function pageSummary(id) {
    removeExistingModal();
    loading('Loading summary snapshot...');
    try {
      const x = await API.getSummary(id); 
      const r = x.comparison; 
      const s = r.summary; 
      const complete = s.status === 'COMPLETE';
      const sv = computeVat(s.subtotal_minor);
      const isApproved = x.approval_status === 'APPROVED';
      
      const aiBriefing = x.ai_executive_summary || (window.PC_AI ? window.PC_AI.generateExecutiveSummary(r, x.title, companyProfile) : 'Summary recorded.');

      // Linked purchase orders (js/orders.js)
      let poPanel = '';
      if (hasOrders() && API.listPurchaseOrdersForSummary) {
        try {
          const linkedPOs = await API.listPurchaseOrdersForSummary(x.id);
          poPanel = window.PC_ORDERS.summaryPanelHtml(x, linkedPOs, esc, money, !!(me.capabilities && me.capabilities.includes('summaries')));
        } catch (poErr) { poPanel = ''; }
      }

      const approvalHeaderBadge = isApproved
        ? '<span class="badge ok" style="padding:5px 12px; font-size:12.5px; font-weight:700; background:#059669; color:#fff;">✓ Acknowledged by ' + esc(x.approved_by || 'Admin') + '</span>'
        : '<span class="badge warn" style="padding:5px 12px; font-size:12.5px; font-weight:700; background:rgba(234,179,8,0.15); color:#CA8A04; border:1px solid rgba(234,179,8,0.3);">🟡 Awaiting Admin Sign-Off</span>';

      const adminActionBtn = isAdminUser()
        ? (isApproved 
            ? '<button type="button" class="btn" style="font-size:12px; padding:5px 10px;" data-action="revoke-summary-approval" data-id="' + esc(x.id) + '" title="Revoke management sign-off for re-audit">Revoke Approval</button>'
            : '<button type="button" class="btn primary" style="background:#059669; border-color:#047857; color:#fff; font-weight:700; font-size:13px; padding:6px 14px;" data-action="approve-summary" data-id="' + esc(x.id) + '" data-title="' + esc(x.title) + '" data-guide-key="summary-approve-signoff">✍️ Acknowledge &amp; Approve Job Sheet</button>')
        : '';

      const approvalBanner = isApproved
        ? '<div class="alert ok" style="background:rgba(5,150,105,0.12); border:1px solid rgba(5,150,105,0.3); border-radius:8px; padding:12px 16px; margin:12px 0;">'
          + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">'
          + '<div>'
          + '<div style="font-weight:700; color:#059669; font-size:14.5px;">✓ Management Acknowledged &amp; Authorized for PO Dispatch</div>'
          + '<div style="font-size:13px; color:var(--ink); margin-top:2px;">This Bill of Materials was reviewed, verified, and officially greenlit for purchase order issuance by <strong>' + esc(x.approved_by) + '</strong> on ' + esc(fmtTime(x.approved_at)) + '.</div>'
          + (x.approval_notes ? '<div class="small" style="color:var(--mute); margin-top:4px; font-style:italic;">Authorization note: "' + esc(x.approval_notes) + '"</div>' : '')
          + '</div>'
          + '<span class="badge ok" style="background:#059669; color:#fff; font-weight:700; padding:6px 12px;">PO DISPATCH RELEASED</span>'
          + '</div></div>'
        : '<div class="alert warn" style="background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.3); border-radius:8px; padding:12px 16px; margin:12px 0;">'
          + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">'
          + '<div>'
          + '<div style="font-weight:700; color:#CA8A04; font-size:14.5px;">⏳ Pending Management Sign-Off &amp; Budget Authorization</div>'
          + '<div style="font-size:13px; color:var(--ink); margin-top:2px;">Sourcing prices and statutory 12% VAT calculations frozen by <strong>' + esc(x.author_name || 'BOM Preparer') + '</strong>. Awaiting official sign-off by an Administrator (Karen Reyes) before releasing purchase orders.</div>'
          + '</div>'
          + (isAdminUser() ? '<button type="button" class="btn primary" style="background:#059669; border-color:#047857; color:#fff; font-weight:700;" data-action="approve-summary" data-id="' + esc(x.id) + '" data-title="' + esc(x.title) + '">✍️ Sign &amp; Approve Now</button>' : '<span class="badge warn" style="font-weight:700;">AWAITING AUDIT</span>')
          + '</div></div>';

      setMain(
        '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:12px;">'
        + '<div><div style="display:flex; align-items:center; gap:10px;"><h1 style="margin:0;">' + esc(x.title) + '</h1>' + approvalHeaderBadge + '</div>'
        + '<p class="sub" style="margin-top:4px;">Saved ' + esc(fmtTime(x.created_at)) + ' &middot; policy ' + esc(r.policy_version) + ' (age limit ' + r.policy.max_age_days + ' days, ' + esc(r.currency) + ') &middot; BOM list revision ' + r.list_revision + '</p></div>'
        + '<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;">' + adminActionBtn + '<button type="button" class="btn" style="background:rgba(239,68,68,0.12); color:#EF4444; border:1px solid rgba(239,68,68,0.25); font-weight:600;" data-action="delete-summary" data-id="' + esc(x.id) + '" data-title="' + esc(x.title) + '">🗑️ Delete Summary</button><a class="btn" href="#/summaries">All summaries</a></div></div>'
        + approvalBanner
        + poPanel
        + alertBox('info', '<strong>Frozen Auditable Snapshot:</strong> Values and supplier distributions reflect the exact quotes at the moment of sign-off, completely immune to subsequent catalog updates.')
        
        /* PRINT HEADER (VISIBLE ONLY ON PRINT) */
        + '<div class="print-amgc-header">'
        + '<h1 style="font-size:22pt; margin:0 0 4px;">' + esc(companyProfile.business_name) + '</h1>'
        + '<div style="font-size:10pt; color:#444;">' + esc(companyProfile.business_type) + ' &bull; ' + esc(companyProfile.location) + ' &bull; Contact: ' + esc(companyProfile.contact_number || '+63 (02) 8655-2491') + '</div>'
        + '<div style="font-size:10pt; margin-top:8px; font-weight:bold;">OFFICIAL BILL OF MATERIALS SOURCING JOB SHEET &bull; ' + esc(x.title) + '</div>'
        + '<div style="font-size:9pt; color:#666;">Snapshot Token: ' + esc(x.save_token) + ' | Fingerprint: ' + esc(r.review_fingerprint) + '</div>'
        + '<div style="margin-top:8px; padding:6px 0; border-top:1px dashed #666; font-size:9.5pt;">'
        + 'Net Sourcing Base: ' + money(sv.net, r.currency) + ' &bull; 12% Value Added Tax: ' + money(sv.vat, r.currency) + ' &bull; <strong>Total Amount Due: ' + money(sv.gross, r.currency) + '</strong>'
        + '</div>'
        + '</div>'

        /* AI EXECUTIVE BRIEFING CARD */
        + '<section class="card stack" style="border-left: 4px solid var(--teal); background: var(--card-subtle);">'
        + '<div class="row between" style="align-items:center; flex-wrap:wrap; gap:10px;">'
        + '<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:22px;">🤖</span><div><h2 style="font-size:17px; font-weight:700; margin:0;">AI Executive Sourcing Explanation &amp; Compliance Audit</h2><span class="small" data-guide-key="summary-audit-fingerprint" style="color:var(--mute); cursor:help;">Cryptographically fingerprinted decision justification (Hash: ' + esc(r.review_fingerprint) + ')</span></div></div>'
        + '<div class="row" style="gap:8px;"><button type="button" class="btn" data-action="copy-ai-summary" data-id="' + esc(x.id) + '" data-guide-key="summary-export-csv">📋 Copy Briefing</button><button type="button" class="btn primary" id="btn-print-job-sheet" data-action="print-job-sheet" data-guide-key="summary-print-official">🖨️ Print Sourcing Job Sheet</button></div></div>'
        + '<div style="white-space: pre-wrap; font-size:13.5px; line-height:1.6; color:var(--ink); padding: 8px 4px;">' + esc(aiBriefing) + '</div></section>'

        + '<section class="card stack"><div><div class="small">Components Subtotal' + (complete ? '' : ' (Partial)') + ' as Saved</div><div class="total">' + money(s.subtotal_minor, r.currency) + ' <span class="small" style="font-size:14px;font-weight:400;color:var(--mute);">(VAT Included)</span></div><div class="small">' + (complete ? badge('ok', '&#10003; 100% Full Line Coverage') : badge('warn', '! Incomplete') + ' ' + s.unresolved_count + ' unresolved line(s) omitted') + ' &middot; verified supplier quotations</div></div>'
        
        + '<div class="vat-tax-summary-box" style="margin-top:10px; padding:12px 16px; background:var(--card-subtle); border:1px solid var(--line); border-radius:10px;">'
        + '<div style="font-size:13px; font-weight:700; color:var(--ink); margin-bottom:8px;">🧾 BIR 12% Value Added Tax (VAT) Calculation:</div>'
        + '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">'
        + '<div><span class="small" style="color:var(--mute);">Net Component Cost:</span> <strong class="font-mono">' + money(sv.net, r.currency) + '</strong></div>'
        + '<div><span class="small" style="color:var(--mute);">12% Value Added Tax:</span> <strong class="font-mono" style="color:#0D9488;">+ ' + money(sv.vat, r.currency) + '</strong></div>'
        + '<div><span class="small" style="color:var(--teal); font-weight:600;">Total (VAT-Inclusive):</span> <strong class="font-mono" style="color:var(--teal);">' + money(sv.gross, r.currency) + '</strong></div>'
        + '</div></div>'
        
        + '<div class="tbl"><table><thead><tr><th>Verified Component</th><th class="num">Qty</th><th>Chosen Offer &amp; Source Attribution</th><th class="num">Unit Price</th><th class="num">Line Cost (VAT Detail)</th></tr></thead><tbody>'
        + r.lines.map((l) => { 
          const sel = l.candidates.find((c) => c.offer_id === l.selected_offer_id);
          const lv = computeVat(l.line_cost_minor);
          const lineCostDisplay = lv.gross != null 
            ? '<div class="mono" style="font-weight:700;">' + money(lv.gross, r.currency) + '</div><div class="small font-mono" style="color:var(--mute);font-size:11px;">Net: ' + money(lv.net, r.currency) + '<br>VAT: ' + money(lv.vat, r.currency) + '</div>'
            : 'Not counted';

          return '<tr' + (sel ? '' : ' class="row-bad"') + '><td><div class="mono" style="font-weight:700;">' + esc(l.exact_id) + '</div><div class="small" style="color:var(--mute);">' + esc(l.description) + '</div></td><td class="num font-mono">' + l.quantity + '</td><td>'
            + (sel ? '<strong>' + esc(sel.supplier_name) + '</strong><div class="small" style="color:var(--mute);">Checked ' + fmtDate(sel.checked_date) + ' &middot; ' + esc(sel.source_reference) + '</div>' : badge('bad', '! Unresolved') + '<div class="small">' + esc(UNRESOLVED[l.unresolved_reason] || l.unresolved_reason) + '</div>')
            + (l.candidates.length ? '<details style="margin-top:6px"><summary class="small" style="cursor:pointer;color:var(--teal);">' + l.candidates.length + ' supplier offer(s) considered</summary>' + l.candidates.map((c) => '<div class="small" style="margin-top:4px">' + esc(c.supplier_name) + ': ' + money(c.price_minor, c.currency) + ', stock ' + (c.recorded_quantity == null ? 'missing' : c.recorded_quantity) + ', checked ' + fmtDate(c.checked_date) + ' &mdash; ' + (c.eligible ? badge('ok', 'Eligible') : badge('bad', 'Excluded: ' + c.reasons.map((q) => esc(REASONS[q] || q)).join('; '))) + '</div>').join('') + '</details>' : '')
            + '</td><td class="num font-mono">' + (sel ? money(sel.price_minor, sel.currency) : 'Not available') + '</td><td class="num font-mono">' + lineCostDisplay + '</td></tr>'; 
        }).join('')
        + '</tbody></table></div></section>'

        /* TWO-PARTY GOVERNANCE SIGN-OFF SECTION (SCREEN & PRINT) */
        + '<section class="card stack print-signature-section" style="border-top:3px solid var(--teal); margin-top:20px;">'
        + '<div class="row between" style="align-items:center;">'
        + '<div><h3 style="margin:0; font-size:16px; font-weight:700;">✍️ Two-Party Verification &amp; Governance Sign-Off</h3>'
        + '<p class="small" style="color:var(--mute); margin-top:2px;">Internal controls mandate maker-checker segregation of duties: BOM Technical Preparation vs. Admin Purchasing Authorization.</p></div>'
        + (isApproved ? '<span class="badge ok" style="background:#059669; color:#fff; font-weight:700; padding:4px 10px;">✓ AUDIT COMPLETE &bull; PO DISPATCH RELEASED</span>' : '<span class="badge warn" style="font-weight:700; padding:4px 10px;">🟡 AWAITING ADMIN SIGN-OFF</span>')
        + '</div>'
        + '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-top:12px;">'
        + '<div style="background:var(--card-subtle); border:1px solid var(--line); border-radius:8px; padding:16px;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">'
        + '<span class="small" style="text-transform:uppercase; font-weight:700; color:var(--mute); letter-spacing:0.5px;">1. Prepared &amp; Evaluated By</span>'
        + '<span class="badge ok" style="font-size:11px; font-weight:700;">✓ Sourcing Frozen</span>'
        + '</div>'
        + '<div style="font-size:15px; font-weight:700; color:var(--ink);">' + esc(x.author_name || 'Christian Dave D. Guiyab') + '</div>'
        + '<div class="small" style="color:var(--mute); margin-top:2px;">Role: Field Technician / BOM Preparer</div>'
        + '<div class="small" style="color:var(--mute); margin-top:4px;">Evaluation Timestamp: ' + esc(fmtTime(x.created_at)) + '</div>'
        + '<div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--line); font-size:12px; color:var(--ink);">'
        + 'Status: <em>Technical line items, quantities, and supplier quotations verified against job sheet specifications.</em>'
        + '</div>'
        + '<div class="print-signature-line" style="margin-top:35px; padding-top:6px; border-top:1px solid #333; font-size:11px; text-align:center; display:none;">Preparer Signature over Printed Name</div>'
        + '</div>'

        + '<div style="background:var(--card-subtle); border:1px solid ' + (isApproved ? 'rgba(5,150,105,0.4)' : 'rgba(234,179,8,0.4)') + '; border-radius:8px; padding:16px;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">'
        + '<span class="small" style="text-transform:uppercase; font-weight:700; color:var(--mute); letter-spacing:0.5px;">2. Acknowledged &amp; Authorized By</span>'
        + (isApproved ? '<span class="badge ok" style="background:#059669; color:#fff; font-size:11px; font-weight:700;">✓ PO Greenlit</span>' : '<span class="badge warn" style="font-size:11px; font-weight:700;">🟡 Pending Sign-Off</span>')
        + '</div>'
        + (isApproved 
          ? '<div style="font-size:15px; font-weight:700; color:#059669;">' + esc(x.approved_by || 'Karen Reyes') + '</div>'
            + '<div class="small" style="color:var(--mute); margin-top:2px;">Role: Executive Administrator / Purchasing Approver</div>'
            + '<div class="small" style="color:var(--mute); margin-top:4px;">Authorized At: ' + esc(fmtTime(x.approved_at)) + '</div>'
            + '<div style="margin-top:10px; padding:8px 10px; background:rgba(5,150,105,0.08); border-radius:6px; font-size:12px; color:var(--ink);">'
            + '<strong>Sign-Off Note:</strong> "' + esc(x.approval_notes) + '"'
            + '</div>'
            + '<div class="print-signature-line" style="margin-top:35px; padding-top:6px; border-top:1px solid #333; font-size:11px; text-align:center; display:none;">Executive Administrator Signature over Printed Name</div>'
          : '<div style="font-size:14px; font-weight:600; color:#CA8A04;">Pending Karen Reyes (Administrator)</div>'
            + '<div class="small" style="color:var(--mute); margin-top:2px;">Role: Executive Administrator / Purchasing Approver</div>'
            + '<div class="small" style="color:var(--warn); margin-top:8px;"><em>Purchase orders cannot be dispatched until official acknowledgment is registered.</em></div>'
            + (isAdminUser() 
              ? '<div style="margin-top:12px;"><button type="button" class="btn primary" style="background:#059669; border-color:#047857; color:#fff; font-weight:700; font-size:12.5px; width:100%;" data-action="approve-summary" data-id="' + esc(x.id) + '" data-title="' + esc(x.title) + '">✍️ Click to Sign &amp; Authorize Now</button></div>' 
              : ''))
        + '</div>'
        + '</div></section>'
      );
    } catch (e) { errorPage(e); }
  }

  /* ---------- PURCHASE ORDERS MODULE WIRING (js/orders.js) ---------- */
  if (window.PC_ORDERS) {
    window.PC_ORDERS.init({
      esc, money, badge, alertBox, computeVat,
      setMain, loading, errorPage, go, removeExistingModal,
      route: () => route(),
      getMe: () => me,
      getCompany: () => companyProfile,
      isAdmin: () => isAdminUser(),
    });
  }
  const hasOrders = () => !!(window.PC_ORDERS && me && me.capabilities && me.capabilities.includes('orders'));

  /* ---------- ROUTER ---------- */
  async function route() {
    const h = location.hash || '#/';
    try {
      if (h === '#/logout') {
        await API.logout();
        me = null;
        return go('#/login');
      }
      if (h === '#/about') return pageAbout();
      if (h === '#/faqs') return pageFaqs();

      if (!me) { 
        try { me = await API.me(); } 
        catch (e) { me = null; } 
      }
      if (!me && (h === '#/' || h === '#')) return pageLanding();
      if (!me && h !== '#/login') { return pageLogin(); }
      if (h === '#/login') { 
        if (me) return go('#/'); 
        return pageLogin(); 
      }
      
      let m;
      if (h === '#/' ) return pageHome();
      if (h === '#/catalog') { offerForm = null; return pageCatalog(); }
      if (h === '#/lists') return pageLists();
      if ((m = h.match(/^#\/lists\/(.+)$/))) return pageEditor(m[1]);
      if ((m = h.match(/^#\/compare\/(.+)$/))) return pageCompare(m[1]);
      if (h === '#/summaries') return pageSummaries();
      if ((m = h.match(/^#\/summaries\/(.+)$/))) return pageSummary(m[1]);
      if (h === '#/orders' || h === '#/tracking' || h === '#/inventory' || h === '#/analytics' || /^#\/orders\/.+$/.test(h)) {
        if (!hasOrders()) {
          return setMain('<div class="card"><h1>Access restricted</h1><p class="sub">Your role does not have access to purchase orders.</p><a class="btn" href="#/">Go back</a></div>');
        }
        if (h === '#/orders') return window.PC_ORDERS.pageOrders();
        if (h === '#/tracking') return window.PC_ORDERS.pageTracking();
        if (h === '#/inventory') return window.PC_ORDERS.pageInventory();
        if (h === '#/analytics') return window.PC_ORDERS.pageAnalytics();
        if ((m = h.match(/^#\/orders\/(.+)$/))) return window.PC_ORDERS.pageOrder(decodeURIComponent(m[1]));
      }
      setMain('<div class="card"><h1>Page not found</h1><a href="#/">Go back</a></div>');
    } catch (e) { errorPage(e); }
  }
  window.addEventListener('hashchange', route);

  /* ---------- EVENT HANDLERS ---------- */
  document.addEventListener('submit', async (ev) => {
    const f = ev.target; 
    ev.preventDefault();
    try {
      if (f.id === 'login') {
        const u = f.u.value.trim();
        const p = (f.p.value || '').trim();
        try { 
          me = await API.login(u, p); 
          go('#/'); 
        } catch (e) { 
          pageLogin(e.message, u); 
        }
      } else if (f.id === 'signup-request') {
        const name = document.getElementById('req-name').value.trim();
        const user = document.getElementById('req-user').value.trim();
        const role = document.getElementById('req-role').value;
        const pass = document.getElementById('req-pass').value;
        const passConf = document.getElementById('req-pass-confirm').value;
        const pin = (document.getElementById('req-pin') ? document.getElementById('req-pin').value : '').trim();
        const secQ = document.getElementById('req-sec-q') ? document.getElementById('req-sec-q').value : SECURITY_QUESTIONS[0];
        const secA = (document.getElementById('req-sec-a') ? document.getElementById('req-sec-a').value : '').trim();
        const alertBoxEl = document.getElementById('signup-alert-box');
        const submitBtn = document.getElementById('btn-submit-signup');

        if (!name || !user) {
          if (window.__setSignupStep) window.__setSignupStep(1);
          if (alertBoxEl) alertBoxEl.innerHTML = alertBox('bad', 'Full Name and Desired Username are required.', 'alert');
          return;
        }

        if (pass !== passConf) {
          if (window.__setSignupStep) window.__setSignupStep(1);
          if (alertBoxEl) alertBoxEl.innerHTML = alertBox('bad', 'Passwords do not match. Please verify and re-type your password.', 'alert');
          return;
        }

        const passCheck = validatePasswordComplexity(pass);
        if (!passCheck.valid) {
          if (window.__setSignupStep) window.__setSignupStep(1);
          if (alertBoxEl) alertBoxEl.innerHTML = alertBox('bad', 'Password must satisfy all 5 enterprise security criteria: at least 8 characters, uppercase (A-Z), lowercase (a-z), numbers (0-9), and special symbols (!@#$%...).', 'alert');
          return;
        }

        if (!pin || !secA) {
          if (window.__setSignupStep) window.__setSignupStep(2);
          if (alertBoxEl) alertBoxEl.innerHTML = alertBox('warn', 'Please configure your 6-Digit Security PIN and Secret Security Answer on Step 2 to protect your account against impostors.', 'alert');
          return;
        }

        const termsAccepted = document.getElementById('req-terms') && document.getElementById('req-terms').checked;
        if (!termsAccepted) {
          if (window.__setSignupStep) window.__setSignupStep(2);
          if (alertBoxEl) alertBoxEl.innerHTML = alertBox('warn', 'Please review and accept the Terms and Conditions before submitting your registration.', 'alert');
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting Request...';
        }

        try {
          await API.submitAccountRequest({
            name,
            username: user,
            role,
            password: pass,
            recovery_pin: pin,
            security_question: secQ,
            security_answer: secA
          });
          f.reset();
          if (window.__setSignupStep) window.__setSignupStep(1);
          if (alertBoxEl) {
            alertBoxEl.innerHTML = alertBox('ok', '✓ Account request & anti-impostor recovery credentials submitted! Your account is now pending Administrator approval in the Admin Console.', 'status');
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Account Request';
          }
        } catch (err) {
          if (alertBoxEl) alertBoxEl.innerHTML = alertBox('bad', esc(err.message), 'alert');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Account Request';
          }
        }
      } else if (f.id === 'fp-lookup-form') {
        const uname = (document.getElementById('fp-username') ? document.getElementById('fp-username').value : '').trim();
        if (!fpState) fpState = { step: 1, username: uname, verifyMode: 'both' };
        fpState.username = uname;
        try {
          const ch = await API.getRecoveryChallenge(uname);
          fpState.step = 2;
          fpState.username = ch.username;
          fpState.challenge = ch;
          fpState.verifyMode = 'both';
          fpState.pin = '';
          fpState.secAnswer = '';
          fpState.newPass = '';
          fpState.confirmPass = '';
          fpState.error = '';
          renderForgotPasswordModal();
        } catch (err) {
          fpState.error = err.message;
          renderForgotPasswordModal();
        }
      } else if (f.id === 'forgot-password-form') {
        if (!fpState || !fpState.challenge) return;
        const pinEl = document.getElementById('fp-pin');
        const ansEl = document.getElementById('fp-sec-answer');
        const newPass = document.getElementById('fp-new-pass') ? document.getElementById('fp-new-pass').value : '';
        const confPass = document.getElementById('fp-confirm-pass') ? document.getElementById('fp-confirm-pass').value : '';
        fpState.pin = pinEl ? pinEl.value.trim() : '';
        fpState.secAnswer = ansEl ? ansEl.value : '';
        fpState.newPass = newPass;
        fpState.confirmPass = confPass;

        const passCheck = validatePasswordComplexity(newPass);
        if (!passCheck.valid) {
          fpState.error = 'New password must satisfy all 5 enterprise security criteria: at least 8 characters, uppercase (A-Z), lowercase (a-z), numbers (0-9), and special symbols (!@#$%...).';
          renderForgotPasswordModal();
          return;
        }
        if (newPass !== confPass) {
          fpState.error = 'New passwords do not match. Please verify and re-type.';
          renderForgotPasswordModal();
          return;
        }

        try {
          const res = await API.submitPasswordReset({
            username: fpState.username,
            pin: pinEl ? fpState.pin : '',
            security_answer: ansEl ? fpState.secAnswer : '',
            new_password: newPass
          });
          fpState.step = 3;
          fpState.error = '';
          fpState.mode = res.mode;
          fpState.successMsg = res.message;
          renderForgotPasswordModal();
        } catch (err) {
          fpState.error = err.message;
          renderForgotPasswordModal();
        }
      } else if (f.id === 'my-security-form') {
        const curPass = document.getElementById('sec-cur-pass') ? document.getElementById('sec-cur-pass').value : '';
        const newPin = document.getElementById('sec-new-pin') ? document.getElementById('sec-new-pin').value.trim() : '';
        const newQ = document.getElementById('sec-new-q') ? document.getElementById('sec-new-q').value : SECURITY_QUESTIONS[0];
        const newA = document.getElementById('sec-new-a') ? document.getElementById('sec-new-a').value : '';
        try {
          await API.updateMySecuritySettings({
            current_password: curPass,
            recovery_pin: newPin,
            security_question: newQ,
            security_answer: newA
          });
          await renderMySecurityModal('', '✓ Your 6-Digit Recovery PIN and Security Question have been updated!');
        } catch (err) {
          await renderMySecurityModal(err.message, '');
        }
      } else if (f.id === 'newlist') {
        const title = document.getElementById('nl').value;
        try { 
          const l = await API.createList(title); 
          go('#/lists/' + l.id); 
        } catch (e) { 
          const el = document.getElementById('nl-err'); 
          el.hidden = false; 
          el.textContent = (e.field_errors && e.field_errors.title) || e.message; 
          document.getElementById('nl').setAttribute('aria-invalid', 'true'); 
          document.getElementById('nl').setAttribute('aria-describedby', 'nl-err'); 
          document.getElementById('nl').focus(); 
        }
      } else if (f.id === 'editor') {
        const lines = ed.lines.map((l) => ({ 
          id: l.id, 
          part_id: l.part_id, 
          quantity: /^\d+$/.test(String(l.quantity).trim()) ? parseInt(l.quantity, 10) : NaN 
        }));
        try {
          const saved = await API.updateList(ed.id, ed.revision, ed.title, lines, ed.archived);
          ed.revision = saved.revision; 
          ed.lines = saved.lines.map((l) => ({ id: l.id, part_id: l.part_id, quantity: String(l.quantity) }));
          ed.errors = null; ed.error = null; ed.saved = true; ed.dirty = false; ed.conflict = false; 
          drawEditor(true);
        } catch (e) { 
          ed.errors = e.field_errors || null; 
          ed.error = e.message; 
          ed.conflict = e.code === 'REVISION_CONFLICT'; 
          ed.saved = false; 
          drawEditor(true); 
        }
      } else if (f.id === 'policy') {
        const raw = (f.pa || document.getElementById('pa')).value.trim();
        const curInput = (f.pc || document.getElementById('pc')).value.trim().toUpperCase();
        const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
        try { 
          const updated = await API.setPolicy(n, curInput); 
          cmp.policy = updated;
          cmp.settingErrors = null;
          cmp.result = await API.compare(cmp.id, cmp.selections);
          drawCompare(true);
        } catch (e) { 
          cmp.settingErrors = e.field_errors || { max_age_days: e.message }; 
          drawCompare(true); 
        }
      } else if (f.id === 'offerform') {
        const o = offerForm; 
        const e0 = {};
        const price = String(o.price).trim(); 
        const qty = String(o.recorded_quantity).trim();
        let price_minor = null, recorded_quantity = null;
        if (price !== '') { 
          if (/^\d+(\.\d{1,2})?$/.test(price)) price_minor = Math.round(parseFloat(price) * 100); 
          else e0.price = 'Enter a valid amount like 380 or 380.50.'; 
        }
        if (qty !== '') { 
          if (/^\d+$/.test(qty)) recorded_quantity = parseInt(qty, 10); 
          else e0.recorded_quantity = 'Quantity must be a positive whole number.'; 
        }
        if (o.part_id === '__NEW_PART__') {
          if (!(o.new_part_exact || '').trim()) {
            e0.new_part_exact = 'Enter the new Exact Material / Part ID.';
          }
        }
        if (Object.keys(e0).length) { 
          o.errors = e0; 
          o.error = 'Please fix the highlighted fields.'; 
          o.isOpen = true;
          return renderCatalogModal(); 
        }
        try {
          let resolvedPartId = o.part_id;
          let createdNewPart = false;
          if (o.part_id === '__NEW_PART__') {
            const newPartObj = await API.createPart({
              exact_id: (o.new_part_exact || '').trim().toUpperCase(),
              description: (o.new_part_desc || '').trim() || (o.new_part_exact || '').trim().toUpperCase()
            });
            resolvedPartId = newPartObj.id;
            createdNewPart = true;
          }
          const savedOffer = await API.saveOffer({ 
            id: o.id, revision: o.revision, part_id: resolvedPartId, supplier_id: o.supplier_id, 
            price_minor, currency: o.currency || companyProfile.currency_code, price_basis: o.price_basis, 
            recorded_quantity, checked_date: o.checked_date, source_reference: o.source_reference, active: o.active,
            is_new_part: createdNewPart
          });
          const wasEdit = !!o.id; 
          removeExistingModal();
          offerForm = null;
          const [parts, offers, sups, uploadLogs] = await Promise.all([
            API.listParts(),
            API.listOffers(),
            API.listSuppliers(),
            API.listSupplierUploadLogs()
          ]);
          window.__cat = { parts, offers, sups, uploadLogs: uploadLogs || [] };
          if (!wasEdit && savedOffer && savedOffer.id) {
            window.__lastAddedOfferIds = new Set([savedOffer.id]);
          }
          drawCatalog(
            document.getElementById('q') ? document.getElementById('q').value : '',
            wasEdit ? 'Offer updated successfully.' : '✓ New material offer added and recorded in "What\'s Added"!'
          );
        } catch (e) { 
          o.errors = e.field_errors || null; 
          o.error = e.message; 
          o.isOpen = true;
          renderCatalogModal(); 
        }
      } else if (f.id === 'supplier-form') {
        const name = (document.getElementById('sup-name') ? document.getElementById('sup-name').value : '').trim();
        const location = (document.getElementById('sup-location') ? document.getElementById('sup-location').value : '').trim();
        const contact = (document.getElementById('sup-contact') ? document.getElementById('sup-contact').value : '').trim();
        const accredited = document.getElementById('sup-accredited') ? document.getElementById('sup-accredited').checked : true;

        if (!name) {
          if (supplierForm) {
            supplierForm.error = 'Supplier company name is required.';
            renderSupplierModal();
          }
          return;
        }

        try {
          const onCatalogRoute = (window.location.hash || '').startsWith('#/catalog');
          if (supplierForm && supplierForm.id) {
            await API.updateSupplier(supplierForm.id, { name, location, contact, accredited });
            supplierForm = null;
            removeExistingModal();
            if (onCatalogRoute) {
              const [parts, offers, sups, uploadLogs] = await Promise.all([
                API.listParts(), API.listOffers(), API.listSuppliers(), API.listSupplierUploadLogs()
              ]);
              window.__cat = { parts, offers, sups, uploadLogs: uploadLogs || [] };
              drawCatalog('', `✓ Accredited vendor "${name}" updated!`);
            } else {
              pageAdmin(`Accredited vendor "${name}" updated successfully!`);
            }
          } else {
            const createdRes = await API.createSupplier({ name, location, contact, accredited });
            supplierForm = null;
            removeExistingModal();
            if (onCatalogRoute) {
              const [parts, offers, sups, uploadLogs] = await Promise.all([
                API.listParts(), API.listOffers(), API.listSuppliers(), API.listSupplierUploadLogs()
              ]);
              window.__cat = { parts, offers, sups, uploadLogs: uploadLogs || [] };
              if (createdRes && createdRes.supplier) {
                selectedSupplierDashId = createdRes.supplier.id;
                catalogWorkspaceView = 'SUPPLIER';
              }
              drawCatalog('', `✓ Accredited vendor "${name}" registered! Upload their CSV price sheet below.`);
            } else {
              pageAdmin(`Accredited vendor "${name}" registered into enterprise directory!`);
            }
          }
        } catch (err) {
          if (supplierForm) {
            supplierForm.error = err.message;
            renderSupplierModal();
          }
        }
      } else if (f.id === 'supplier-request-form') {
        const name = (document.getElementById('req-sup-name') ? document.getElementById('req-sup-name').value : '').trim();
        const location = (document.getElementById('req-sup-location') ? document.getElementById('req-sup-location').value : '').trim();
        const contact = (document.getElementById('req-sup-contact') ? document.getElementById('req-sup-contact').value : '').trim();
        const notes = (document.getElementById('req-sup-notes') ? document.getElementById('req-sup-notes').value : '').trim();

        if (!name || !location || !contact || !notes) {
          if (supplierRequestForm) {
            supplierRequestForm.error = 'All fields (Company Name, Depot Location, Contact, and Business Justification) are required.';
            renderSupplierRequestModal();
          }
          return;
        }

        try {
          const res = await API.submitSupplierRequest({ name, location, contact, notes });
          supplierRequestForm = null;
          removeExistingModal();
          const onCatalogRoute = (window.location.hash || '').startsWith('#/catalog');
          if (onCatalogRoute) {
            const [parts, offers, sups, uploadLogs, supReqs] = await Promise.all([
              API.listParts(), API.listOffers(), API.listSuppliers(), API.listSupplierUploadLogs(), API.listSupplierRequests()
            ]);
            window.__cat = { parts, offers, sups, uploadLogs: uploadLogs || [], supReqs: supReqs || [] };
            drawCatalog('', `✓ Vendor accreditation proposal for "${name}" submitted for Administrator review!`);
          } else {
            pageAdmin(`Vendor accreditation proposal for "${name}" submitted.`);
          }
        } catch (err) {
          if (supplierRequestForm) {
            supplierRequestForm.error = err.message;
            renderSupplierRequestModal();
          }
        }
      }
    } catch (e) { errorPage(e); }
  });

  document.addEventListener('input', (ev) => {
    const t = ev.target; 
    const b = t.getAttribute && t.getAttribute('data-bind'); 
    if (b === 'ed.title') { ed.title = t.value; ed.dirty = true; }
    else if (b === 'line.qty') { ed.lines[+t.dataset.i].quantity = t.value; ed.dirty = true; }
    else if (b && b.startsWith('of.') && b !== 'of.active') { if (offerForm) offerForm[b.slice(3)] = t.value; }
    else if (b === 'catsearch') { 
      drawCatalog(t.value); 
      const q = document.getElementById('q'); 
      if (q) { q.focus(); q.setSelectionRange(t.value.length, t.value.length); }
    }
    else if (b === 'supdashsearch') {
      supplierDashSearch = t.value;
      drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', null, true);
      const sqEl = document.getElementById('sup-dash-q');
      if (sqEl) { sqEl.focus(); sqEl.setSelectionRange(t.value.length, t.value.length); }
    }
    else if (b === 'mcda-input') {
      const activeId = t.id;
      const activeVal = Math.min(100, Math.max(0, parseInt(t.value, 10) || 0));
      const ids = ['mcda-cost', 'mcda-stock', 'mcda-freshness', 'mcda-consolidation'];
      const otherIds = ids.filter(id => id !== activeId);

      const remainder = 100 - activeVal;
      const otherEls = otherIds.map(id => document.getElementById(id));
      const otherVals = otherEls.map(el => parseInt(el ? el.value : 0, 10) || 0);
      const otherSum = otherVals.reduce((a, b) => a + b, 0);

      if (remainder <= 0) {
        otherEls.forEach(el => { if (el) el.value = 0; });
      } else if (otherSum === 0) {
        // Distribute remainder evenly in multiples of 5
        let left = remainder;
        for (let i = 0; i < otherEls.length; i++) {
          if (i === otherEls.length - 1) {
            if (otherEls[i]) otherEls[i].value = left;
          } else {
            const share = Math.round((remainder / otherEls.length) / 5) * 5;
            if (otherEls[i]) otherEls[i].value = share;
            left -= share;
          }
        }
      } else {
        // Scale other sliders proportionally in steps of 5
        let allocated = 0;
        for (let i = 0; i < otherEls.length - 1; i++) {
          const share = Math.round(((otherVals[i] / otherSum) * remainder) / 5) * 5;
          const clamped = Math.max(0, Math.min(remainder - allocated, share));
          if (otherEls[i]) otherEls[i].value = clamped;
          allocated += clamped;
        }
        // Last slider gets the exact difference so sum is strictly 100%
        const lastEl = otherEls[otherEls.length - 1];
        if (lastEl) {
          lastEl.value = Math.max(0, remainder - allocated);
        }
      }

      // Update all number labels
      ids.forEach(id => {
        const input = document.getElementById(id);
        const label = document.getElementById(id + '-val');
        if (input && label) label.textContent = input.value + '%';
      });

      const finalSum = ids.reduce((acc, id) => {
        const input = document.getElementById(id);
        return acc + (parseInt(input ? input.value : 0, 10) || 0);
      }, 0);

      const badgeEl = document.getElementById('mcda-total-badge');
      const saveBtn = document.getElementById('saveMcdaBtn');
      if (badgeEl) {
        if (finalSum === 100) {
          badgeEl.className = 'badge ok';
          badgeEl.textContent = 'Total: 100% ✓ Balanced';
          if (saveBtn) saveBtn.disabled = false;
        } else {
          badgeEl.className = 'badge bad';
          badgeEl.textContent = 'Total: ' + finalSum + '% ⚠️ Must equal 100%';
          if (saveBtn) saveBtn.disabled = true;
        }
      }
    }
  });

  document.addEventListener('change', async (ev) => {
    const t = ev.target; 
    const b = t.getAttribute && t.getAttribute('data-bind'); 
    if (!b) return;
    try {
      if (b === 'line.part') { 
        ed.lines[+t.dataset.i].part_id = t.value; 
        ed.dirty = true;
        drawEditor(true);
      }
      else if (b === 'ed.archived') { ed.archived = t.checked; ed.dirty = true; }
      else if (b === 'of.active') { if (offerForm) offerForm.active = t.checked; }
      else if (b === 'of.part_id') {
        if (offerForm) offerForm.part_id = t.value;
        const wrapEl = document.getElementById('new-part-fields-wrap');
        if (wrapEl) wrapEl.style.display = t.value === '__NEW_PART__' ? 'flex' : 'none';
      }
      else if (b.startsWith('of.')) { if (offerForm) offerForm[b.slice(3)] = t.value; }
      else if (b === 'select') { 
        cmp.selections[t.dataset.line] = t.value; 
        cmp.error = null; 
        await refreshCompare(true); 
      }
      else if (b === 'cat-sup-filter') {
        catalogSupplierFilter = t.value;
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', null, true);
      }
      else if (b === 'sup-dash-select') {
        selectedSupplierDashId = t.value;
        supplierDashSearch = '';
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', null, true);
      }
      else if (b === 'sup-force-assign') {
        supplierForceAssignAll = !!t.checked;
      }
    } catch (e) { errorPage(e); }
  });

  function handleOpenLogin(ev) {
    if (me) {
      if (ev) ev.preventDefault();
      go('#/');
      return;
    }
    const slider = document.getElementById('loginSlider');
    if (slider) {
      if (ev) ev.preventDefault();
      slider.classList.remove('right-panel-active');
      const sip = slider.querySelector('.signin-panel');
      if (sip) sip.scrollTop = 0;
      if (location.hash !== '#/login') {
        history.replaceState(null, '', '#/login');
      }
      if (window.PC_SMOOTH_SCROLL) window.PC_SMOOTH_SCROLL.scrollToY(0);
      else window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      setTimeout(() => {
        const u = document.getElementById('u');
        if (u) u.focus();
      }, 120);
      return;
    }
    if (location.hash === '#/login') {
      if (ev) ev.preventDefault();
      pageLogin();
      return;
    }
    if (ev) ev.preventDefault();
    go('#/login');
  }

  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-action]'); 
    if (!t) {
      const a = ev.target.closest('a[aria-disabled="true"]'); 
      if (a) { ev.preventDefault(); return; }
      const loginLink = ev.target.closest('a[href="#/login"]');
      if (loginLink) { handleOpenLogin(ev); return; }
      return;
    }
    const act = t.dataset.action;
    try {
      if (act === 'open-login') {
        handleOpenLogin(ev);
      }
      else if (act === 'logout') { 
        await API.logout(); 
        me = null; 
        go('#/'); 
      }
      else if (act === 'scroll') { 
        const targetId = t.dataset.target;
        const el = document.getElementById(targetId); 
        if (el) {
          if (window.PC_SMOOTH_SCROLL) window.PC_SMOOTH_SCROLL.scrollToElement(el);
          else el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); 
        } else {
          window.__pendingScrollTarget = targetId;
          go('#/');
        }
      }
      else if (act === 'start-simulation') {
        const role = t.dataset.role || 'preparer';
        try {
          me = await API.startSimulation(role);
          if (role === 'admin' || role === 'administrator') go('#/');
          else if (role === 'maintainer') go('#/catalog');
          else go('#/lists');
        } catch (e) {
          alert('Error launching simulation mode: ' + e.message);
        }
      }
      else if (act === 'exit-simulation') {
        try {
          await API.exitSimulation();
          me = null;
          go('#/');
        } catch (e) {
          alert('Error exiting simulation mode: ' + e.message);
        }
      }
      else if (act === 'fill-login') {
        const targetU = t.dataset.u || '';
        const uInput = document.getElementById('u');
        const pInput = document.getElementById('p');
        if (uInput) {
          uInput.value = targetU;
          if (pInput) {
            pInput.removeAttribute('readonly');
            pInput.value = '';
            pInput.focus();
          }
        }
      }
      else if (act === 'quick-login') { 
        try { 
          me = await API.login(t.dataset.u, 'demo', true); 
          go('#/'); 
        } catch (e) { 
          pageLogin(e.message); 
        } 
      }
      else if (act === 'open-forgot-password') {
        const typedU = document.getElementById('u') ? document.getElementById('u').value.trim() : '';
        fpState = {
          step: 1,
          username: typedU,
          challenge: null,
          verifyMode: 'both',
          pin: '',
          secAnswer: '',
          newPass: '',
          confirmPass: '',
          error: '',
          successMsg: '',
          mode: ''
        };
        renderForgotPasswordModal();
        setTimeout(() => {
          const el = document.getElementById('fp-username');
          if (el) el.focus();
        }, 60);
      }
      else if (act === 'close-forgot-password') {
        fpState = null;
        removeExistingModal();
      }
      else if (act === 'fp-change-user') {
        if (fpState) {
          fpState.step = 1;
          fpState.challenge = null;
          fpState.error = '';
          renderForgotPasswordModal();
          setTimeout(() => {
            const el = document.getElementById('fp-username');
            if (el) el.focus();
          }, 60);
        }
      }
      else if (act === 'fp-set-verify-mode') {
        if (fpState) {
          const pEl = document.getElementById('fp-pin');
          if (pEl) fpState.pin = pEl.value.trim();
          const aEl = document.getElementById('fp-sec-answer');
          if (aEl) fpState.secAnswer = aEl.value;
          const npEl = document.getElementById('fp-new-pass');
          if (npEl) fpState.newPass = npEl.value;
          const cpEl = document.getElementById('fp-confirm-pass');
          if (cpEl) fpState.confirmPass = cpEl.value;
          fpState.verifyMode = t.dataset.mode || 'both';
          fpState.error = '';
          renderForgotPasswordModal();
        }
      }
      else if (act === 'open-my-security-modal') {
        await renderMySecurityModal();
      }
      else if (act === 'close-my-security-modal') {
        removeExistingModal();
      }
      else if (act === 'add-line') { 
        ed.lines.push({ id: null, part_id: '', quantity: '1' }); 
        ed.dirty = true; 
        drawEditor(true); 
        const sel = document.getElementById('lp' + (ed.lines.length - 1)); 
        if (sel) sel.focus(); 
      }
      else if (act === 'remove-line') { 
        ed.lines.splice(+t.dataset.i, 1); 
        ed.dirty = true; 
        ed.errors = null; 
        drawEditor(true); 
      }
      else if (act === 'reload-list') { 
        pageEditor(ed.id); 
      }

      /* MODULE 1: ENTERPRISE BUSINESS PROFILE ACTIONS */
      else if (act === 'save-company-profile') {
        const nameInput = document.getElementById('prof-name');
        const typeInput = document.getElementById('prof-type');
        const locInput = document.getElementById('prof-location');
        const contactInput = document.getElementById('prof-contact');
        const currInput = document.getElementById('prof-curr-code');
        const symInput = document.getElementById('prof-curr-symbol');
        const ageInput = document.getElementById('prof-age');
        const minSupInput = document.getElementById('prof-min-suppliers');

        const profileData = {
          business_name: nameInput ? nameInput.value.trim() : companyProfile.business_name,
          business_type: typeInput ? typeInput.value.trim() : companyProfile.business_type,
          location: locInput ? locInput.value.trim() : companyProfile.location,
          contact_number: contactInput ? contactInput.value.trim() : (companyProfile.contact_number || ''),
          currency_code: currInput ? currInput.value.trim() : companyProfile.currency_code,
          currency_symbol: symInput ? symInput.value.trim() : companyProfile.currency_symbol,
          max_quote_age_days: ageInput ? parseInt(ageInput.value, 10) : 14,
          required_supplier_quotes: minSupInput ? parseInt(minSupInput.value, 10) : 3
        };

        if (!profileData.business_name) {
          alert('Company / Business name cannot be empty.');
          return;
        }

        try {
          const updated = await API.saveCompanyProfile(profileData);
          companyProfile = Object.assign({}, companyProfile, updated);
          applyBranding(updated);
          await pageAdmin(`Enterprise profile updated to "${updated.business_name}"! Dynamic branding and contact synchronized.`);
        } catch (err) {
          alert('Failed to update company profile: ' + (err.message || 'Unknown error'));
        }
      }

      /* MODULE 1B: ACCREDITED SUPPLIER DIRECTORY ACTIONS */
      else if (act === 'open-add-supplier-modal') {
        supplierForm = { id: null, name: '', location: '', contact: '', accredited: true, isOpen: true, error: null };
        renderSupplierModal();
      }
      else if (act === 'edit-supplier') {
        const suppliers = await API.listSuppliers();
        const sup = suppliers.find(x => x.id === t.dataset.id);
        if (sup) {
          supplierForm = {
            id: sup.id,
            name: sup.name,
            location: sup.location || '',
            contact: sup.contact || '',
            accredited: sup.accredited !== false,
            isOpen: true,
            error: null
          };
          renderSupplierModal();
        }
      }
      else if (act === 'close-supplier-modal') {
        supplierForm = null;
        removeExistingModal();
      }
      else if (act === 'toggle-supplier-status') {
        const supId = t.dataset.id;
        try {
          await API.toggleSupplierStatus(supId);
          pageAdmin('Supplier accreditation status updated.');
        } catch (err) {
          alert('Error updating supplier status: ' + err.message);
        }
      }
      else if (act === 'delete-supplier') {
        const supId = t.dataset.id;
        const supName = t.dataset.name || 'this supplier';
        if (!confirm(`Are you sure you want to permanently delete supplier "${supName}" from the system and database?`)) return;
        try {
          await API.deleteSupplier(supId);
          if (selectedSupplierDashId === supId) {
            selectedSupplierDashId = null;
          }
          pageAdmin(`Supplier "${supName}" has been permanently removed.`);
        } catch (err) {
          alert('Error deleting supplier: ' + err.message);
        }
      }
      /* MODULE 1C: SUPPLIER ACCREDITATION REQUESTS (MAINTAINER PROPOSALS & ADMIN APPROVALS) */
      else if (act === 'open-request-supplier-modal') {
        supplierRequestForm = { name: '', location: '', contact: '', notes: '', isOpen: true, error: null };
        renderSupplierRequestModal();
      }
      else if (act === 'close-supplier-request-modal') {
        supplierRequestForm = null;
        removeExistingModal();
      }
      else if (act === 'open-view-supplier-requests-modal') {
        const reqs = await API.listSupplierRequests();
        renderViewSupplierRequestsModal(reqs);
      }
      else if (act === 'close-view-supplier-requests-modal') {
        removeExistingModal();
      }
      else if (act === 'approve-supplier-request') {
        const reqId = t.dataset.id;
        try {
          const res = await API.approveSupplierRequest(reqId);
          pageAdmin(`✓ Supplier "${res.supplier.name}" has been accredited and added to the vendor directory!`);
        } catch (err) {
          alert('Error approving supplier: ' + err.message);
        }
      }
      else if (act === 'reject-supplier-request') {
        const reqId = t.dataset.id;
        const reason = prompt('Please enter a reason or feedback for rejecting this supplier accreditation request:', 'Due diligence check incomplete / Vendor credentials not accredited.');
        if (reason !== null) {
          try {
            await API.rejectSupplierRequest(reqId, reason.trim());
            pageAdmin('Supplier accreditation request rejected.');
          } catch (err) {
            alert('Error rejecting supplier request: ' + err.message);
          }
        }
      }
      else if (act === 'delete-staff') {
        const userId = t.dataset.id;
        const userName = t.dataset.name || 'this staff member';
        if (!confirm(`Are you sure you want to permanently delete account for "${userName}"?\n\nIf this was added by mistake or for testing, it will be removed.`)) return;
        try {
          const res = await API.deleteStaff(userId);
          if (res.softDeactivated) alert(res.message);
          pageAdmin(`Staff account "${userName}" updated.`);
        } catch (err) {
          alert('Error deleting staff account: ' + err.message);
        }
      }
      else if (act === 'delete-summary') {
        const sumId = t.dataset.id;
        const sumTitle = t.dataset.title || 'this summary';
        if (!confirm(`Are you sure you want to permanently delete saved summary "${sumTitle}"?\n\nThis will remove it from the system and database.`)) return;
        try {
          await API.deleteSummary(sumId);
          pageSummaries();
        } catch (err) {
          alert('Error deleting summary: ' + err.message);
        }
      }
      else if (act === 'approve-summary') {
        const sumId = t.dataset.id;
        const sumTitle = t.dataset.title || 'this Sourcing Job Sheet';
        const notes = prompt(`Administrator Acknowledgment & Sign-Off:\n\nYou are approving "${sumTitle}". This officially authorizes procurement and purchase order issuance.\n\nOptional approval note / PO reference (or click OK to approve):`, 'Verified & greenlit for PO dispatch');
        if (notes === null) return;
        try {
          await API.approveSummary(sumId, notes);
          pageSummary(sumId);
        } catch (err) {
          alert('Error approving summary: ' + err.message);
        }
      }
      else if (act === 'revoke-summary-approval') {
        const sumId = t.dataset.id;
        const reason = prompt('Reason for revoking authorization (will require re-audit before PO dispatch):', 'Quote amendment needed');
        if (reason === null) return;
        try {
          await API.revokeSummaryApproval(sumId, reason);
          pageSummary(sumId);
        } catch (err) {
          alert('Error revoking approval: ' + err.message);
        }
      }
      else if (act === 'delete-list') {
        const listId = t.dataset.id;
        const listTitle = t.dataset.title || 'this BOM list';
        if (!confirm(`Are you sure you want to permanently delete BOM list "${listTitle}"?\n\nThis will remove all components in this list.`)) return;
        try {
          await API.deleteList(listId);
          pageLists();
        } catch (err) {
          alert('Error deleting BOM list: ' + err.message);
        }
      }

      /* MODULE 3: SAVE MCDA WEIGHTS */
      else if (act === 'save-mcda-weights') {
        const cost = parseInt(document.getElementById('mcda-cost').value, 10) || 0;
        const stock = parseInt(document.getElementById('mcda-stock').value, 10) || 0;
        const freshness = parseInt(document.getElementById('mcda-freshness').value, 10) || 0;
        const consolidation = parseInt(document.getElementById('mcda-consolidation').value, 10) || 0;

        await API.saveMcdaWeights({ cost, stock, freshness, consolidation });
        pageAdmin('MCDA utility weights updated and synchronized to Supabase Cloud!');
      }
      else if (act === 'set-mcda-preset') {
        const cost = parseInt(t.dataset.cost, 10) || 0;
        const stock = parseInt(t.dataset.stock, 10) || 0;
        const freshness = parseInt(t.dataset.freshness, 10) || 0;
        const consolidation = parseInt(t.dataset.consolidation, 10) || 0;
        const costEl = document.getElementById('mcda-cost');
        const stockEl = document.getElementById('mcda-stock');
        const freshEl = document.getElementById('mcda-freshness');
        const consEl = document.getElementById('mcda-consolidation');
        if (costEl) costEl.value = cost;
        if (stockEl) stockEl.value = stock;
        if (freshEl) freshEl.value = freshness;
        if (consEl) consEl.value = consolidation;
        const cVal = document.getElementById('mcda-cost-val');
        const sVal = document.getElementById('mcda-stock-val');
        const fVal = document.getElementById('mcda-freshness-val');
        const conVal = document.getElementById('mcda-consolidation-val');
        if (cVal) cVal.textContent = cost + '%';
        if (sVal) sVal.textContent = stock + '%';
        if (fVal) fVal.textContent = freshness + '%';
        if (conVal) conVal.textContent = consolidation + '%';
        const badgeEl = document.getElementById('mcda-total-badge');
        const saveBtn = document.getElementById('saveMcdaBtn');
        if (badgeEl) {
          badgeEl.className = 'badge ok';
          badgeEl.textContent = 'Total: 100% ✓ Balanced';
        }
        if (saveBtn) saveBtn.disabled = false;
      }
      else if (act === 'auto-balance-mcda') {
        const ids = ['mcda-cost', 'mcda-stock', 'mcda-freshness', 'mcda-consolidation'];
        const els = ids.map(id => document.getElementById(id));
        const vals = els.map(el => parseInt(el ? el.value : 0, 10) || 0);
        const sum = vals.reduce((a, b) => a + b, 0);
        if (sum === 0) {
          if (els[0]) els[0].value = 40;
          if (els[1]) els[1].value = 30;
          if (els[2]) els[2].value = 20;
          if (els[3]) els[3].value = 10;
        } else {
          let left = 100;
          for (let i = 0; i < els.length - 1; i++) {
            const scaled = Math.round(((vals[i] / sum) * 100) / 5) * 5;
            if (els[i]) {
              els[i].value = Math.max(0, Math.min(left, scaled));
              left -= els[i].value;
            }
          }
          if (els[els.length - 1]) els[els.length - 1].value = Math.max(0, left);
        }
        ids.forEach(id => {
          const el = document.getElementById(id);
          const v = document.getElementById(id + '-val');
          if (el && v) v.textContent = el.value + '%';
        });
        const badgeEl = document.getElementById('mcda-total-badge');
        const saveBtn = document.getElementById('saveMcdaBtn');
        if (badgeEl) {
          badgeEl.className = 'badge ok';
          badgeEl.textContent = 'Total: 100% ✓ Balanced';
        }
        if (saveBtn) saveBtn.disabled = false;
      }

      /* MODULE 2: STAFF SUCCESSION & STATUS TOGGLE */
      else if (act === 'promote-staff') {
        const staffId = t.dataset.id;
        await API.promoteStaffToAdmin(staffId);
        pageAdmin('Staff member successfully promoted to Administrator for succession handover.');
      }
      else if (act === 'toggle-staff-status') {
        const staffId = t.dataset.id;
        try {
          await API.toggleStaffStatus(staffId);
          pageAdmin('Staff account status toggled.');
        } catch (err) {
          alert(err.message);
        }
      }

      /* MODULE 2B: ACCOUNT ACCESS REQUESTS (APPROVE / REJECT) */
      else if (act === 'approve-account-request') {
        const reqId = t.dataset.id;
        try {
          const res = await API.approveAccountRequest(reqId);
          pageAdmin(`Staff account for ${res.user.name} (@${res.user.username}) approved and activated!`);
        } catch (err) {
          alert('Error approving request: ' + err.message);
        }
      }
      else if (act === 'reject-account-request') {
        const reqId = t.dataset.id;
        if (confirm('Are you sure you want to decline this registration request?')) {
          try {
            await API.rejectAccountRequest(reqId);
            pageAdmin('Staff account request declined.');
          } catch (err) {
            alert('Error rejecting request: ' + err.message);
          }
        }
      }

      /* MODULE 2C: IDENTITY-VERIFIED PASSWORD RESET REQUESTS (APPROVE / REJECT) */
      else if (act === 'approve-password-reset') {
        const pwrId = t.dataset.id;
        try {
          const res = await API.approvePasswordResetRequest(pwrId);
          pageAdmin(`Verified password reset for ${res.user.name} (@${res.user.username}) approved and activated!`);
        } catch (err) {
          alert('Error approving password reset: ' + err.message);
        }
      }
      else if (act === 'reject-password-reset') {
        const pwrId = t.dataset.id;
        if (confirm('Are you sure you want to decline this password reset request?')) {
          try {
            await API.rejectPasswordResetRequest(pwrId);
            pageAdmin('Password reset request declined.');
          } catch (err) {
            alert('Error declining password reset: ' + err.message);
          }
        }
      }

      /* MODULE 4: REFRESH AUDIT LOGS */
      else if (act === 'refresh-audit-logs') {
        pageAdmin('Audit event ledger refreshed.');
      }
      
      /* CATALOG MODAL ACTIONS */
      else if (act === 'download-csv-template') {
        downloadSupplierCsvTemplate();
      }
      else if (act === 'upload-supplier-csv') {
        const fileInput = document.getElementById('supplier-csv-input');
        if (fileInput) fileInput.click();
      }
      else if (act === 'open-ai-quote-ingest') {
        renderAiQuoteIngestModal();
      }
      else if (act === 'close-ai-quote-ingest') {
        removeExistingModal();
        parsedAiQuoteItems = [];
      }
      else if (act === 'clear-ai-quote-input') {
        const ta = document.getElementById('aiQuoteInput');
        if (ta) { ta.value = ''; ta.focus(); }
        const res = document.getElementById('aiQuoteResultsContainer');
        if (res) { res.style.display = 'none'; res.innerHTML = ''; }
        parsedAiQuoteItems = [];
      }
      else if (act === 'load-ai-quote-sample-1') {
        const ta = document.getElementById('aiQuoteInput');
        if (ta) {
          ta.value = "Good morning sir Dave, here is our updated price quote for AMGC Aircon today:\n\nEverwell Parts & Equipment Corp. (Ref: EW-VIBER-2026-11)\n- CBB65 45uF 450V capacitor round - ₱405.00 each (45 pcs on hand)\n- R410A Refrigerant 1kg sealed can - Php 580.00 / can (stock: 60)\n- HCC-1XU02AA Contactor 30A 1-Pole 240V - ₱340.00 (20 pcs avail)\n\nC&C Airconditioning Supply (Ref: CC-CHAT-882)\n- RPG20B Welling Indoor Blower Motor 20W 220V @ 1,180.00 pesos, 15 units available\n- QD-U11A Universal AC Control Board PCB kit: 820.00 php (8 units)\n- NTC 10K Copper Head Temperature Sensor Probe - ₱85.00 (50 pcs)";
          ta.focus();
        }
      }
      else if (act === 'load-ai-quote-sample-2') {
        const ta = document.getElementById('aiQuoteInput');
        if (ta) {
          ta.value = "Hi Dave,\n\nQuotation from Manco Refrigeration Supply\nDate: Nov 4, 2026\nQuote Reference: MANCO-QT-9921\n\nItems available for AMGC Aircon:\n1. R410A 1kg Refrigerant Gas - 590.00 php | Stock: 25\n2. CBB65 45uf Dual Run Cap - 415.00 php | Stock: 30\n3. NTC 10k thermistor probe - ₱78.00 | Stock: 100\n4. HCC-1XU02AA 30A AC contactor - 350.00 php | Stock: 18\n\nPayment terms: COD / 30-day terms\nBest regards,\nManco Sales Team";
          ta.focus();
        }
      }
      else if (act === 'load-ai-quote-sample-3') {
        const ta = document.getElementById('aiQuoteInput');
        if (ta) {
          ta.value = "Supplier\tPart Number / Description\tUnit Price PHP\tStock Qty\nEverwell Parts & Equipment Corp.\tCBB65-45UF-450V Capacitor\t400.00\t50\nC&C Airconditioning Supply\tRPG20B Blower Motor\t1150.00\t12\nManco Refrigeration Supply\tR410A Refrigerant Can 1kg\t585.00\t35\nEverwell Parts & Equipment Corp.\tQD-U11A Universal PCB Board\t810.00\t14";
          ta.focus();
        }
      }
      else if (act === 'run-ai-quote-parse') {
        const ta = document.getElementById('aiQuoteInput');
        const raw = ta ? ta.value : '';
        if (!raw.trim()) {
          alert('Please paste or type quote text, or click one of the quick test sample buttons above.');
          return;
        }
        if (!window.PC_AI || typeof window.PC_AI.parseSupplierQuotation !== 'function') {
          alert('AI parser module not loaded.');
          return;
        }
        const { parts, sups } = window.__cat || { parts: [], sups: [] };
        parsedAiQuoteItems = window.PC_AI.parseSupplierQuotation(raw, parts, sups);
        const resContainer = document.getElementById('aiQuoteResultsContainer');
        if (!resContainer) return;

        if (!parsedAiQuoteItems.length) {
          resContainer.style.display = 'block';
          resContainer.innerHTML = '<div class="alert warn" style="padding:10px 14px; margin-top:8px;">⚠️ No recognizable quotation lines found. Please ensure lines have a part description, price (e.g. ₱405 or 405 php), and supplier name.</div>';
          return;
        }

        const uniqueSups = Array.from(new Set(parsedAiQuoteItems.map(x => x.source)));
        const avgConfidence = Math.round(parsedAiQuoteItems.reduce((acc, x) => acc + x.confidence, 0) / parsedAiQuoteItems.length);

        resContainer.style.display = 'block';
        resContainer.innerHTML = `
          <div class="card stack" style="background:var(--card-subtle); border:1px solid var(--line); border-radius:8px; padding:12px; margin-top:10px;">
            <div class="row between" style="align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <strong style="font-size:14px; color:var(--ink);">✨ Extracted ${parsedAiQuoteItems.length} Quotation Item(s) across ${uniqueSups.length} Supplier(s)</strong>
                <div class="small" style="color:var(--mute);">Average AI Confidence: <span class="badge ok" style="font-size:10px;">${avgConfidence}%</span> · Suppliers: <strong>${esc(uniqueSups.join(', '))}</strong></div>
              </div>
              <span class="small" style="color:var(--mute);">You can edit prices and stock directly before importing.</span>
            </div>

            <div class="tbl" style="margin-top:10px; max-height:280px; overflow-y:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
                <thead>
                  <tr style="border-bottom:1px solid var(--line); text-align:left;">
                    <th style="width:30px; padding:6px 4px;"><input type="checkbox" id="ai-quote-check-all" checked data-action="toggle-ai-quote-all"></th>
                    <th style="padding:6px 8px;">Supplier</th>
                    <th style="padding:6px 8px;">Component SKU &amp; Description</th>
                    <th style="padding:6px 8px; width:110px;">Unit Price (PHP)</th>
                    <th style="padding:6px 8px; width:75px;">Stock</th>
                    <th style="padding:6px 8px;">Reference Tag</th>
                    <th style="padding:6px 8px; width:90px;">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${parsedAiQuoteItems.map((item, idx) => `
                    <tr style="border-bottom:1px solid var(--line); vertical-align:middle;">
                      <td style="padding:6px 4px;"><input type="checkbox" class="ai-quote-item-check" data-action="toggle-ai-quote-item" data-idx="${idx}" checked></td>
                      <td style="padding:6px 8px; font-weight:600; color:var(--ink);">${esc(item.source)}</td>
                      <td style="padding:6px 8px;">
                        <div style="font-weight:700; color:var(--ink); font-family:monospace;">${esc(item.part_id)}</div>
                        <div class="small" style="color:var(--mute); font-size:11px;">${esc(item.description)}</div>
                        <div style="margin-top:2px;">
                          ${item.catalog_part_id 
                            ? '<span class="badge ok" style="font-size:9.5px; padding:1px 5px; background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3);">✓ Catalog Match</span>' 
                            : '<span class="badge" style="font-size:9.5px; padding:1px 5px; background:rgba(37,99,235,0.15); color:#2563EB; border:1px solid rgba(37,99,235,0.3);">🆕 New Part</span>'}
                        </div>
                      </td>
                      <td style="padding:6px 8px;">
                        <div style="display:flex; align-items:center; gap:2px;">
                          <span style="font-weight:700; color:var(--ink);">₱</span>
                          <input type="number" step="0.01" id="ai-price-${idx}" value="${item.unit_price ? item.unit_price.toFixed(2) : '0.00'}" style="width:85px; padding:3px 6px; font-size:12px; font-weight:700; border-radius:4px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">
                        </div>
                      </td>
                      <td style="padding:6px 8px;">
                        <input type="number" id="ai-stock-${idx}" value="${item.stock || 0}" style="width:60px; padding:3px 6px; font-size:12px; font-weight:700; border-radius:4px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">
                      </td>
                      <td style="padding:6px 8px;">
                        <div class="small mono" style="color:var(--mute); font-size:10.5px; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(item.attributed_source)}">${esc(item.attributed_source)}</div>
                      </td>
                      <td style="padding:6px 8px;">
                        ${item.confidence >= 80 
                          ? '<span class="badge ok" style="background:#059669; color:#fff; font-size:10px;">✓ ' + item.confidence + '%</span>'
                          : item.confidence >= 60 
                            ? '<span class="badge" style="background:#0D9488; color:#fff; font-size:10px;">⚡ ' + item.confidence + '%</span>'
                            : '<span class="badge warn" style="font-size:10px;">⚠️ ' + item.confidence + '%</span>'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="margin-top:12px;">
              <button type="button" class="btn primary" data-action="apply-ai-quote-import" style="width:100%; height:44px; font-size:14px; font-weight:700; background:#059669; border-color:#047857; color:#fff; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>✓ Import &amp; Synchronize ${parsedAiQuoteItems.length} Quote(s) into Catalog</span>
              </button>
            </div>
          </div>
        `;
      }
      else if (act === 'toggle-ai-quote-all') {
        const master = document.getElementById('ai-quote-check-all');
        const isChecked = master ? master.checked : true;
        const checks = document.querySelectorAll('.ai-quote-item-check');
        checks.forEach(c => { c.checked = isChecked; });
      }
      else if (act === 'apply-ai-quote-import') {
        if (!parsedAiQuoteItems || !parsedAiQuoteItems.length) return;
        const batch = [];
        for (let i = 0; i < parsedAiQuoteItems.length; i++) {
          const item = parsedAiQuoteItems[i];
          const chk = document.querySelector(`.ai-quote-item-check[data-idx="${i}"]`);
          if (chk && !chk.checked) continue;

          const priceEl = document.getElementById('ai-price-' + i);
          const stockEl = document.getElementById('ai-stock-' + i);
          const pVal = priceEl ? parseFloat(priceEl.value) || item.unit_price : item.unit_price;
          const sVal = stockEl ? parseInt(stockEl.value, 10) || item.stock : item.stock;

          batch.push({
            part_id: item.part_id,
            description: item.description,
            source: item.source,
            attributed_source: item.attributed_source || 'AI Smart Quote Ingest',
            unit_price: pVal,
            price_minor: Math.round(pVal * 100),
            stock: sVal
          });
        }

        if (!batch.length) {
          alert('Please select at least one quotation row to import.');
          return;
        }

        try {
          const result = await API.bulkUpsertOffers(batch, 'AI Smart Quote Ingest');
          const [parts, offers, sups, uploadLogs] = await Promise.all([
            API.listParts(),
            API.listOffers(),
            API.listSuppliers(),
            API.listSupplierUploadLogs()
          ]);
          window.__cat = { parts, offers, sups, uploadLogs: uploadLogs || [] };
          window.__lastUploadedOfferIds = new Set(result.affectedOfferIds || []);
          window.__lastAddedOfferIds = new Set(result.addedOfferIds || []);
          window.__lastUpdatedOfferIds = new Set(result.updatedOfferIds || []);
          window.__lastUploadedFileName = 'AI Smart Quote Ingest';

          removeExistingModal();
          parsedAiQuoteItems = [];

          const noticeMsg = `✓ AI Smart Quote Ingest Complete: Successfully imported ${batch.length} quote(s)! (${result.addedCount} new materials created, ${result.updatedCount} existing updated). All quotes marked Fresh (≤14d) and highlighted below.`;
          drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', noticeMsg);
        } catch (err) {
          console.error('AI Quote import error:', err);
          alert('Failed to import quotes: ' + (err.message || 'Unknown error'));
        }
      }
      else if (act === 'open-add-offer-modal') {
        offerForm = { 
          id: null, revision: null, part_id: '', supplier_id: catalogWorkspaceView === 'SUPPLIER' && selectedSupplierDashId ? selectedSupplierDashId : '', price: '', 
          new_part_exact: '', new_part_desc: '',
          currency: companyProfile.currency_code || 'PHP', price_basis: 'per_piece', recorded_quantity: '', 
          checked_date: new Date().toISOString().slice(0, 10), source_reference: '', active: true, 
          errors: null, error: null, isOpen: true 
        };
        renderCatalogModal();
      }
      else if (act === 'open-add-offer-for-supplier') {
        const supId = t.dataset.sup || selectedSupplierDashId || '';
        offerForm = { 
          id: null, revision: null, part_id: '__NEW_PART__', supplier_id: supId, price: '', 
          new_part_exact: '', new_part_desc: '',
          currency: companyProfile.currency_code || 'PHP', price_basis: 'per_piece', recorded_quantity: '', 
          checked_date: new Date().toISOString().slice(0, 10), source_reference: '', active: true, 
          errors: null, error: null, isOpen: true 
        };
        renderCatalogModal();
      }
      else if (act === 'edit-offer') {
        const o = window.__cat.offers.find((x) => x.id === t.dataset.id);
        offerForm = { 
          id: o.id, revision: o.revision, part_id: o.part_id, supplier_id: o.supplier_id, 
          price: o.price_minor == null ? '' : (o.price_minor / 100).toFixed(2), 
          currency: o.currency || companyProfile.currency_code, price_basis: o.price_basis, 
          recorded_quantity: o.recorded_quantity == null ? '' : String(o.recorded_quantity), 
          checked_date: o.checked_date || '', source_reference: o.source_reference || '', 
          active: o.active, errors: null, error: null, isOpen: true 
        };
        renderCatalogModal();
      }
      else if (act === 'edit-offer-csv') {
        const o = window.__cat.offers.find((x) => x.id === t.dataset.id);
        if (o) {
          offerForm = { 
            id: o.id, revision: o.revision, part_id: o.part_id, supplier_id: o.supplier_id, 
            price: o.price_minor == null ? '' : (o.price_minor / 100).toFixed(2), 
            currency: o.currency || companyProfile.currency_code, price_basis: o.price_basis, 
            recorded_quantity: o.recorded_quantity == null ? '' : String(o.recorded_quantity), 
            checked_date: o.checked_date || '', source_reference: o.source_reference || '', 
            active: o.active, errors: null, error: null, isOpen: true 
          };
          renderCatalogModal();
          setTimeout(() => {
            const fi = document.getElementById('modal-offer-csv-input');
            if (fi) fi.click();
          }, 100);
        }
      }
      else if (act === 'delete-offer') {
        const offerId = t.dataset.id;
        const partName = t.dataset.part || 'this material';
        if (!confirm(`Are you sure you want to delete the quotation for "${partName}"?\n\nIf it was added by mistake, it will be permanently removed.`)) return;
        try {
          const res = await API.deleteOffer(offerId);
          removeExistingModal();
          offerForm = null;
          if (res.softDeactivated) {
            alert(res.message);
          }
          await pageCatalog();
        } catch (err) {
          alert('Error deleting quotation: ' + err.message);
        }
      }
      else if (act === 'close-offer-modal') {
        removeExistingModal();
        offerForm = null;
      }
      else if (act === 'open-terms-modal') {
        renderTermsModal();
      }
      else if (act === 'close-terms-modal') {
        removeExistingModal();
      }
      else if (act === 'accept-terms-modal') {
        const termsCb = document.getElementById('req-terms');
        if (termsCb) termsCb.checked = true;
        removeExistingModal();
      }
      else if (act === 'set-catalog-filter') {
        catalogFilter = t.dataset.val;
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', null, true);
      }
      else if (act === 'set-catalog-ws-view') {
        catalogWorkspaceView = t.dataset.view || 'GLOBAL';
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', null, false);
      }
      else if (act === 'open-supplier-dashboard') {
        if (t.dataset.id) selectedSupplierDashId = t.dataset.id;
        supplierDashSearch = '';
        catalogWorkspaceView = 'SUPPLIER';
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', null, false);
      }
      else if (act === 'select-dash-supplier') {
        if (t.dataset.id) selectedSupplierDashId = t.dataset.id;
        supplierDashSearch = '';
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', null, true);
      }
      else if (act === 'clear-supplier-logs') {
        const supId = t.dataset.sup || selectedSupplierDashId;
        await API.clearSupplierUploadLogs(supId);
        const uploadLogs = await API.listSupplierUploadLogs();
        if (window.__cat) window.__cat.uploadLogs = uploadLogs || [];
        window.__lastAddedOfferIds = new Set();
        window.__lastUpdatedOfferIds = new Set();
        drawCatalog(document.getElementById('q') ? document.getElementById('q').value : '', 'Activity log cleared for selected supplier.', true);
      }

      /* AI CSV IMPORT MODAL ACTIONS */
      else if (act === 'open-ai-import-modal') {
        renderAiImportModal();
      }
      else if (act === 'close-ai-import-modal') {
        removeExistingModal();
      }
      else if (act === 'load-ai-sample-1') {
        const ta = document.getElementById('aiCsvInput');
        if (ta) {
          ta.value = "45uf dual run capacitor 450v, 2\ndefrost contactor 30a 1-pole, 1\nr410a virgin freon sealed canister 1kg, 2";
        }
      }
      else if (act === 'load-ai-sample-2') {
        const ta = document.getElementById('aiCsvInput');
        if (ta) {
          ta.value = "precision temp sensor probe ntc 10k, 3\nuniversal split ac control board system, 1";
        }
      }
      else if (act === 'run-ai-csv-parse') {
        const ta = document.getElementById('aiCsvInput');
        const raw = ta ? ta.value : '';
        if (!raw.trim()) {
          alert('Please enter or paste at least one line item.');
          return;
        }
        if (window.PC_AI && typeof window.PC_AI.parseCsvImport === 'function') {
          parsedAiRows = window.PC_AI.parseCsvImport(raw, ed.parts);
          const resultsEl = document.getElementById('aiCsvResults');
          if (resultsEl) {
            resultsEl.style.display = 'block';
            resultsEl.innerHTML = `
              <div class="card stack" style="background:var(--card-subtle); padding:12px;">
                <div class="row between" style="align-items:center;">
                  <strong>AI Match Results (${parsedAiRows.filter(r => r.matchedPart).length} of ${parsedAiRows.length} recognized):</strong>
                  <button type="button" class="btn primary" data-action="apply-ai-csv-import">Import Matched Items to BOM</button>
                </div>
                <div class="tbl" style="margin-top:8px;">
                  <table>
                    <thead><tr><th>Raw Input</th><th>AI Matched Exact Part</th><th class="num">Confidence</th><th class="num">Qty</th></tr></thead>
                    <tbody>
                      ${parsedAiRows.map(r => `
                        <tr>
                          <td class="small mono">${esc(r.extractedDescription)}</td>
                          <td>
                            ${r.matchedPart 
                              ? `<strong style="color:var(--ink);">${esc(r.matchedPart.exact_id)}</strong><div class="small" style="color:var(--mute);">${esc(r.matchedPart.description)}</div>` 
                              : `<span class="badge bad">Unrecognized</span>`}
                          </td>
                          <td class="num"><span class="badge ${r.confidence >= 70 ? 'ok' : r.confidence >= 40 ? 'warn' : 'bad'}">${r.confidence}%</span></td>
                          <td class="num font-mono">${r.quantity}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }
        }
      }
      else if (act === 'apply-ai-csv-import') {
        if (!parsedAiRows || !parsedAiRows.length) return;
        const matched = parsedAiRows.filter(r => r.matchedPart);
        if (!matched.length) {
          alert('No confident matches found to import.');
          return;
        }
        for (const item of matched) {
          const existing = ed.lines.find(l => l.part_id === item.matchedPart.id);
          if (existing) {
            existing.quantity = String((parseInt(existing.quantity, 10) || 0) + item.quantity);
          } else {
            ed.lines.push({ id: null, part_id: item.matchedPart.id, quantity: String(item.quantity) });
          }
        }
        ed.dirty = true;
        ed.lastImportedPartIds = new Set(matched.map(item => item.matchedPart.id));
        ed.notice = `✓ Successfully imported ${matched.length} component(s) from CSV/Text into BOM list! Highlighted below.`;
        removeExistingModal();
        drawEditor(true);
      }

      /* VAT PRICING VIEW CONTROLS */
      else if (act === 'set-vat-mode') {
        if (cmp) {
          cmp.vatMode = t.dataset.mode;
          drawCompare(true);
        }
      }

      /* AI SOURCING STRATEGY APPLICATION */
      else if (act === 'apply-strategy') {
        cmp.strategy = t.dataset.strat;
        if (window.PC_AI && typeof window.PC_AI.recommendStrategy === 'function') {
          const weights = await API.getMcdaWeights();
          cmp.selections = window.PC_AI.recommendStrategy(cmp.result, cmp.strategy, weights);
          await refreshCompare(true);
        }
      }

      /* COMPARE ACTIONS */
      else if (act === 'rereview') { 
        cmp.error = null; 
        cmp.saveState = 'idle'; 
        cmp.token = API.newToken(); 
        await refreshCompare(true); 
      }
      else if (act === 'demo-change') {
        const l = cmp.result && cmp.result.lines && cmp.result.lines[0]; 
        const cand = (l && l.candidates && l.candidates[0]);
        let bumpRes = null;
        if (cand) { 
          bumpRes = await API.bumpOfferForDemo(cand.offer_id); 
        } else {
          const allOffers = await API.listOffers();
          if (allOffers && allOffers.length) {
            bumpRes = await API.bumpOfferForDemo(allOffers[0].id);
          }
        }
        cmp.drifted = true;
        const label = bumpRes && bumpRes.partName ? `${bumpRes.partName} (${bumpRes.supplierName})` : 'supplier quotation';
        cmp.error = {
          code: 'CATALOG_DRIFT_DETECTED',
          message: `⚡ Catalog price drift simulated on ${label}! The quotation price was bumped by +₱25.00 in the live catalog. Sourcing review fingerprint is now stale. Attempting to save this summary will trigger tamper protection (INPUT_CHANGED). Click "⚡ Review Again" below to re-evaluate with current catalog quotes.`
        };
        drawCompare(true);
      }
      else if (act === 'save-summary') {
        const r = cmp.result; 
        cmp.saveState = 'saving'; 
        cmp.error = null; 
        drawCompare(true);
        try {
          const sm = await API.saveSummary(cmp.id, { 
            list_revision: r.list_revision, 
            selections: cmp.selections, 
            policy_version: r.policy_version, 
            review_fingerprint: r.review_fingerprint, 
            save_token: cmp.token 
          });
          cmp.saveState = 'saved'; 
          cmp.savedId = sm.id; 
          drawCompare(true);
        } catch (e) { 
          cmp.saveState = e.code === 'INPUT_CHANGED' ? 'idle' : 'failed'; 
          cmp.error = e; 
          drawCompare(true); 
        }
      }

      /* SOURCING SUMMARY ACTIONS */
      else if (act === 'copy-ai-summary') {
        const summaryId = t.dataset.id;
        const x = await API.getSummary(summaryId);
        const textToCopy = x.ai_executive_summary || (window.PC_AI ? window.PC_AI.generateExecutiveSummary(x.comparison, x.title, companyProfile) : 'Summary text');
        await navigator.clipboard.writeText(textToCopy);
        const oldText = t.textContent;
        t.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => { t.textContent = oldText; }, 2000);
      }
      else if (act === 'print-job-sheet') {
        try {
          window.print();
        } catch (printErr) {
          console.error('Print error:', printErr);
          window.focus();
          window.print();
        }
      }

      /* SUPABASE CLOUD TEST & SYNC */
      else if (act === 'test-cloud-connection') {
        const out = document.getElementById('cloudStatusOutput');
        if (out) out.textContent = 'Testing connection to Supabase Cloud...';
        const res = await API.getCloudStatus();
        if (out) {
          out.textContent = res.connected 
            ? `🟢 Supabase Connected! Latency: ${res.latencyMs}ms | Cloud offers table rows: ${res.offersCount}`
            : `⚠️ Supabase offline / error: ${res.message}`;
        }
      }
      else if (act === 'sync-cloud-data') {
        const out = document.getElementById('cloudStatusOutput');
        if (out) out.textContent = 'Synchronizing local catalog & BOM lists to Supabase PostgreSQL...';
        try {
          const res = await API.syncToCloud();
          let summaryMsg = `✓ Successfully synchronized ${res.offersSynced} offers and ${res.listsSynced} BOM lists to Supabase Cloud!`;
          if (res.summariesSynced) summaryMsg += ` (${res.summariesSynced} snapshots preserved)`;
          if (res.companySettingsSynced) summaryMsg += ' Enterprise profile synchronized.';
          if (out) out.textContent = summaryMsg;
        } catch (err) {
          if (out) out.textContent = '⚠️ Cloud sync error: ' + err.message;
        }
      }
    } catch (e) { errorPage(e); }
  });

  /* ---------- SUPABASE REALTIME EVENT LISTENERS ---------- */
  window.addEventListener('pc:realtime-catalog', async (e) => {
    if (location.hash === '#/catalog' && typeof drawCatalog === 'function') {
      try {
        const [parts, offers, sups] = await Promise.all([API.listParts(), API.listOffers(), API.listSuppliers()]);
        window.__cat = { parts, offers, sups };
        drawCatalog('', '⚡ Live Realtime update: Catalog quotation synced from Supabase!');
      } catch (err) {}
    }
  });

  window.addEventListener('pc:realtime-branding', (e) => {
    if (e.detail && typeof applyBranding === 'function') {
      applyBranding(e.detail);
    }
  });

  window.addEventListener('pc:realtime-audit', (e) => {
    if ((location.hash === '#/' || location.hash === '') && typeof pageAdmin === 'function') {
      const card = document.getElementById('admin-audit-ledger-card');
      if (card) {
        pageAdmin();
      }
    }
  });

  window.addEventListener('pc:realtime-status', (e) => {
    const badge = document.getElementById('supabaseRealtimeBadge');
    if (badge) {
      badge.textContent = e.detail === 'SUBSCRIBED' ? '⚡ Realtime Synchronized' : '🟡 ' + e.detail;
      badge.className = e.detail === 'SUBSCRIBED' ? 'badge ok' : 'badge warn';
    }
  });

  const srStyle = document.createElement('style');
  srStyle.textContent = '.sr{position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}';
  document.head.appendChild(srStyle);

  /* ---------- GLOBAL HELP & AI COPILOT WIDGET ---------- */
  const helpArticles = [
    { title: 'Supplier Onboarding & Designated Catalog Upload', category: 'Suppliers', url: '#/faqs', desc: 'How to register new vendors and upload their designated component price lists.' },
    { title: 'Quote Freshness Rule & Validity Policies', category: 'Policy', url: '#/faqs', desc: 'Why component quotations expire after the configured age threshold.' },
    { title: 'Why Unresolved Parts Are Never Treated as ₱0.00', category: 'Pricing', url: '#/faqs', desc: 'Eliminates hidden markups and dangerous budget underestimation.' },
    { title: 'Preserved Sourcing Snapshots & Frozen Summaries', category: 'Audit', url: '#/faqs', desc: 'Immutable records that resist catalog drift.' },
    { title: 'Dynamic Multi-Criteria Decision Analysis (MCDA)', category: 'Engine', url: '#/', desc: 'How utility weights balance cost, stock, freshness, and consolidation.' },
    { title: 'Supabase Cloud PostgreSQL Architecture', category: 'Cloud', url: '#/', desc: 'Real-time schema, tables, and offline caching.' }
  ];

  function initFloatingHelpWidget() {
    if (document.getElementById('helpFloatBtn')) return;
    const btn = document.createElement('div');
    btn.id = 'helpFloatBtn';
    btn.className = 'help-floating-btn';
    btn.setAttribute('title', 'Need help or AI sourcing advice? Click here');
    btn.innerHTML = '<span class="help-circle-icon">🤖</span><span class="help-text">AI Copilot</span>';
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'helpModalPanel';
    panel.className = 'help-modal-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="help-modal-header">
        <div><h3 id="copilotHeaderTitle">Sourcing Copilot &amp; Support</h3></div>
        <button type="button" class="help-modal-close" id="helpModalClose" aria-label="Close help">&times;</button>
      </div>
      <div class="help-modal-body">
        <h4 style="font-size:14px; font-weight:700; margin:0 0 2px;">Ask AI Sourcing Copilot</h4>
        <div class="help-search-box">
          <input type="search" id="helpGlobalSearch" placeholder="Ask about capacitors, contactors, 14-day rule..." autocomplete="off">
          <button type="button" class="help-search-btn" id="copilotAskBtn" aria-label="Ask">💬</button>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">
          <button type="button" class="ai-prompt-chip" data-q="purchase orders status">Purchase orders</button>
          <button type="button" class="ai-prompt-chip" data-q="warehouse low stock alerts">Warehouse stock</button>
          <button type="button" class="ai-prompt-chip" data-q="supplier spend analytics">Supplier spend</button>
          <button type="button" class="ai-prompt-chip" data-q="capacitor prices">Capacitor prices</button>
          <button type="button" class="ai-prompt-chip" data-q="14-day freshness rule">14-Day rule</button>
        </div>

        <div id="copilotAnswerArea" class="ai-copilot-bubble" style="display:none; margin-top:4px;"></div>

        <div class="help-section-label" style="margin-top:6px;">Documentation &amp; Support Articles</div>
        <div class="help-articles-list" id="helpArticlesList"></div>
      </div>
    `;
    document.body.appendChild(panel);

    const searchInput = document.getElementById('helpGlobalSearch');
    const articlesList = document.getElementById('helpArticlesList');
    const closeBtn = document.getElementById('helpModalClose');
    const copilotBtn = document.getElementById('copilotAskBtn');
    const copilotAnswerArea = document.getElementById('copilotAnswerArea');

    function renderList(filter = '') {
      const q = filter.trim().toLowerCase();
      const filtered = helpArticles.filter(item =>
        !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
      );

      if (filtered.length === 0) {
        articlesList.innerHTML = `<div style="font-size:13px; color:var(--mute); padding:12px; text-align:center;">No articles match "${esc(filter)}".</div>`;
        return;
      }

      articlesList.innerHTML = filtered.map(item => `
        <a class="help-article-link" href="${item.url}" onclick="document.getElementById('helpModalPanel').style.display='none';">
          <span class="help-article-icon">📖</span>
          <div>
            <strong style="display:block; margin-bottom:2px;">${esc(item.title)}</strong>
            <span style="font-size:12px; color:var(--mute);">${esc(item.desc)}</span>
          </div>
        </a>
      `).join('');
    }

    function askCopilot(query) {
      if (!window.PC_AI) return;
      const liveCtx = (API && typeof API.getCopilotContext === 'function')
        ? API.getCopilotContext()
        : { company: companyProfile };
      const answer = window.PC_AI.copilotAnswer(query, liveCtx);
      copilotAnswerArea.style.display = 'block';
      copilotAnswerArea.innerHTML = '<strong>🤖 Copilot:</strong>\n' + esc(answer);
    }

    btn.onclick = () => {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) {
        renderList(searchInput.value);
        searchInput.focus();
      }
    };

    closeBtn.onclick = () => { panel.style.display = 'none'; };
    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    
    if (copilotBtn) {
      copilotBtn.onclick = () => {
        if (searchInput.value.trim()) askCopilot(searchInput.value);
      };
    }
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchInput.value.trim()) askCopilot(searchInput.value);
      }
    });

    panel.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.ai-prompt-chip');
      if (chip && chip.dataset.q) {
        searchInput.value = chip.dataset.q;
        askCopilot(chip.dataset.q);
      }
    });

    renderList();
  }

  /* ---------- INTERACTIVE FEATURE GUIDE HOVER CARD SYSTEM ---------- */
  const FEATURE_GUIDES = {
  "ai-quote-ingest": {
    "title": "AI Smart Quote Ingest",
    "icon": "🤖",
    "badge": "Automatic AI Extractor",
    "color": "#0D9488",
    "functionText": "Ingests messy, unformatted quotation text from supplier Viber chats, emails, or spreadsheets without requiring manual CSV formatting or Excel data entry.",
    "steps": [
      "Click button to open the AI Quotation Ingest Engine modal.",
      "Copy & paste raw chat text from Viber/WhatsApp, or click a 1-click test scenario.",
      "Click \"⚡ Run AI Analysis\" to auto-match catalog SKUs & extract PHP prices.",
      "Review confidence scores, edit any prices or stock, and click \"✓ Import\"."
    ],
    "scenario": "Everwell Parts texts Dave an informal Viber chat quoting 45uF capacitors at ₱405.00 each (45 pcs avail). Instead of manually formatting an Excel sheet, Dave pastes the chat directly here. The AI maps it to SKU CBB65-45UF-450V and refreshes live catalog stock within seconds."
  },
  "upload-supplier-csv": {
    "title": "Multi-Supplier CSV Ingestion",
    "icon": "📁",
    "badge": "Bulk Catalog Sync",
    "color": "#059669",
    "functionText": "Bulk-updates component prices, descriptions, and stock quantities across multiple accredited suppliers simultaneously from a structured CSV spreadsheet.",
    "steps": [
      "Ensure CSV has headers: part_id, description, source, unit_price, stock.",
      "Click \"Upload Multi-Supplier CSV\" and select your spreadsheet.",
      "The engine auto-upserts prices, refreshes stock quantities, and registers any new parts.",
      "All updated offers are timestamped with today's date to comply with the 14-day freshness rule."
    ],
    "scenario": "At the beginning of the month, Manco Refrigeration sends a formal 50-item price sheet. Pearl uploads the CSV in 1 second, updating all contactors, refrigerants, and motors across the company in one batch."
  },
  "download-csv-template": {
    "title": "CSV Template Generator",
    "icon": "📥",
    "badge": "Standard Column Schema",
    "color": "#2563EB",
    "functionText": "Generates and downloads the approved column schema spreadsheet ready to be filled with supplier price lists.",
    "steps": [
      "Click button to download supplier_catalog_template.csv.",
      "Open the file in Microsoft Excel or Google Sheets.",
      "Fill in part numbers, supplier names, unit prices in PHP, and available stock.",
      "Save as CSV and upload via \"Upload Multi-Supplier CSV\"."
    ],
    "scenario": "When onboarding a newly accredited supplier (e.g. Aurora Cooling Parts), Pearl downloads this template and emails it to their sales agent so their price list returns in the exact format PartsCompare expects."
  },
  "add-new-offer": {
    "title": "Add Curated Component Offer",
    "icon": "➕",
    "badge": "Manual Single Entry",
    "color": "#0891B2",
    "functionText": "Manually records a single dated quotation from an accredited supplier with quote freshness tracking and invoice proof.",
    "steps": [
      "Click button to open the Add Offer Modal.",
      "Select an existing catalog part (or register a new custom SKU).",
      "Select accredited supplier, unit price in PHP, available stock, and check date.",
      "Attach invoice/quotation reference code and click \"+ Add Offer\" to persist."
    ],
    "scenario": "C&C Aircon calls Dave with an urgent promo price of ₱340.00 for contactor HCC-1XU02AA. Dave immediately logs the single offer with reference #CC-PROMO-11 without needing a spreadsheet."
  },
  "tab-global": {
    "title": "All Curated Offers View",
    "icon": "🌐",
    "badge": "Global Sourcing Catalog",
    "color": "#6366F1",
    "functionText": "Comprehensive master view of every active component offer across all accredited suppliers with real-time price comparisons.",
    "steps": [
      "Browse all parts with unit prices, freshness status badges, and supplier tags.",
      "Use the search bar to find parts by exact SKU, name, or category.",
      "Instantly identify lowest-cost supplier offers and expired quotes (>14 days old)."
    ],
    "scenario": "Technicians and maintainers check the full market catalog to see how Everwell, C&C, and Manco price the same 20W blower motor side by side before creating job estimates."
  },
  "tab-supplier": {
    "title": "Supplier CSV Update Dashboard",
    "icon": "🏢",
    "badge": "Dedicated Vendor Portal",
    "color": "#10B981",
    "functionText": "Per-supplier workspace to manage an individual vendor's price catalog, drag-and-drop CSV updates, and inspect audit logs.",
    "steps": [
      "Select an accredited supplier (e.g. Everwell Parts) from the vendor list.",
      "Review that supplier's active quotes and inventory surplus.",
      "Drag & drop a new price sheet directly into the dropzone to update only that supplier."
    ],
    "scenario": "Everwell sends a price sheet without a \"source\" column. Using this dashboard, all uploaded materials are automatically bound to Everwell Parts without manual editing."
  },
  "tab-combined": {
    "title": "Combined Catalog & Dashboard View",
    "icon": "📊",
    "badge": "Dual Audit Workspace",
    "color": "#F59E0B",
    "functionText": "Displays both the Dedicated Supplier Portal and the All Curated Offers table on a single unified screen for side-by-side auditing.",
    "steps": [
      "Select \"Combined View\" to expand both audit panels.",
      "Verify per-supplier material changes at the top while inspecting market-wide price ranking below."
    ],
    "scenario": "An auditor or administrator inspects whether uploading a new Everwell sheet successfully made them the lowest-cost candidate on capacitor and contactor lines."
  },
  "preparer-view-summaries": {
    "title": "Saved Sourcing Summaries Directory",
    "icon": "📁",
    "badge": "Audit Archive",
    "color": "#059669",
    "functionText": "Access all historical frozen Bill of Materials snapshots with locked supplier prices, management sign-offs, and compliance records.",
    "steps": [
      "Click to navigate to the Saved Summaries registry (#/summaries).",
      "Review project job sheets by timestamp, author, and approval status.",
      "Inspect immutable prices locked at the moment of evaluation.",
      "Download official PDF job sheets and export CSV matrices."
    ],
    "scenario": "An accounting auditor requests proof for a ₱43,950 HVAC overhaul purchase order from 2 weeks ago. Dave opens Saved Summaries and pulls the frozen snapshot showing exact quotations from Everwell and C&C."
  },
  "preparer-metric-lists": {
    "title": "Total BOM Project Lists",
    "icon": "📋",
    "badge": "BOM Metric",
    "color": "#3B82F6",
    "functionText": "Total count of maintenance repair projects, routine servicing schedules, and customer overhaul estimates created in the system.",
    "steps": [
      "Represents every active and completed Bill of Materials across AMGC.",
      "Click on any list row below to open its line-item parts editor.",
      "Compare supplier pricing across all lines simultaneously with one click."
    ],
    "scenario": "Dave manages 3 major commercial contracts: SM Megamall Chiller Overhaul, BGC Tower 2 Filter Replacement, and Ortigas Server Room AC Refurbishment."
  },
  "preparer-metric-components": {
    "title": "Total Listed HVAC Components",
    "icon": "⚡",
    "badge": "Inventory Scope",
    "color": "#10B981",
    "functionText": "Aggregate number of discrete component line items currently scheduled across all active maintenance Bills of Materials.",
    "steps": [
      "Calculated dynamically by summing parts across all drafting and frozen BOMs.",
      "Tracks required quantities (capacitors, contactors, refrigerant cylinders, fan motors).",
      "Ensures component demand does not exceed accredited supplier stock buffers."
    ],
    "scenario": "AMGC has 18 distinct components listed across active repair jobs, giving management a clear overview of upcoming bulk procurement requirements."
  },
  "preparer-metric-drafts": {
    "title": "Active Comparison Drafts",
    "icon": "🔒",
    "badge": "Workflow State",
    "color": "#F59E0B",
    "functionText": "Number of in-progress BOMs currently being prepared, edited, or evaluated that have not yet been permanently frozen for PO release.",
    "steps": [
      "Indicates job estimates still open for parts addition or price canvassing.",
      "Click \"Compare\" on any active draft to run multi-objective supplier ranking.",
      "Once finalized, click \"Save Sourcing Summary\" to freeze prices."
    ],
    "scenario": "Dave has 2 active drafts undergoing supplier price canvassing before presenting final cost projections to the operations manager."
  },
  "preparer-step-1": {
    "title": "Step 1: Create or Edit BOM",
    "icon": "📝",
    "badge": "Operating Phase 1",
    "color": "#3B82F6",
    "functionText": "Define the scope of work by creating a project list and specifying exact catalog SKUs with required piece quantities.",
    "steps": [
      "Enter project title (e.g. Split-Type Overhaul Job #AC-2026-089).",
      "Select verified catalog components from accredited suppliers.",
      "Set exact whole-piece quantities (no decimal or split quantities allowed).",
      "Save the draft to calculate BOM line totals."
    ],
    "scenario": "A technician diagnoses a burned compressor contactor and leaking copper tubing at an office building. Dave creates a new BOM with 1x HCC-1XU02AA contactor and 2x R410A canisters."
  },
  "preparer-step-2": {
    "title": "Step 2: AI Multi-Objective Sourcing",
    "icon": "⚡",
    "badge": "Operating Phase 2",
    "color": "#8B5CF6",
    "functionText": "Evaluate real-time supplier bids and apply MCDA optimization algorithms to balance price savings against stock reliability and quote freshness.",
    "steps": [
      "Open the Comparison Engine for the selected BOM list.",
      "Review side-by-side quotes from Everwell, C&C, and Manco.",
      "Choose a sourcing strategy (Lowest Cost, Single Supplier, Balanced MCDA).",
      "Inspect Philippine 12% VAT calculations (BIR RA 9337 compliance)."
    ],
    "scenario": "Dave compares 3 suppliers for a 5-item repair list. Everwell has the lowest contactor price, but C&C has immediate stock for all 5 items. Dave uses the AI optimizer to evaluate trade-offs."
  },
  "preparer-step-3": {
    "title": "Step 3: Freeze Sourcing Summary",
    "icon": "🛡️",
    "badge": "Operating Phase 3",
    "color": "#059669",
    "functionText": "Permanently lock the evaluated quotation matrix into a tamper-evident snapshot, generating an AI executive briefing for administrative sign-off.",
    "steps": [
      "Confirm all component lines are 100% resolved with accredited quotes.",
      "Click \"Save Sourcing Summary\" to capture prices and SHA-256 fingerprint.",
      "System flags snapshot as Pending Admin Sign-Off.",
      "Administrator Karen Reyes reviews and authorizes purchase order dispatch."
    ],
    "scenario": "To protect the estimate against supplier price increases while awaiting client approval, Dave freezes the summary, guaranteeing the quoted ₱43,950 total cannot drift."
  },
  "preparer-create-bom": {
    "title": "Create Blank BOM List",
    "icon": "➕",
    "badge": "Project Initialization",
    "color": "#0D9488",
    "functionText": "Initializes a new Bill of Materials container ready to receive component line items, quantities, and job reference numbers.",
    "steps": [
      "Type a clear project name or work order reference.",
      "Click \"+ Create Blank BOM List\" to initialize revision 1.",
      "System opens the component line editor immediately.",
      "Add parts one by one or use AI CSV/Text Import for bulk items."
    ],
    "scenario": "Dave receives Job Order #JO-8821 for a 3-Ton Daikin Inverter repair. He creates the blank list and begins adding required capacitors and fan motors."
  },
  "preparer-edit-bom": {
    "title": "Edit BOM Component Quantities",
    "icon": "✏️",
    "badge": "Line-Item Editor",
    "color": "#3B82F6",
    "functionText": "Modify component line items, adjust required piece counts, remove obsolete parts, or import parts lists via AI extraction.",
    "steps": [
      "Select catalog SKUs from the verified component dropdown.",
      "Enter required quantity as positive integers.",
      "System automatically prevents duplicate SKUs on the same BOM.",
      "Click \"Save BOM Changes\" to bump revision number and persist."
    ],
    "scenario": "The field technician discovers that a job requires 2 capacitors instead of 1. Dave clicks Edit, changes quantity from 1 to 2, and saves revision 2."
  },
  "preparer-compare-bom": {
    "title": "Multi-Supplier Quorum Comparison",
    "icon": "⚖️",
    "badge": "Sourcing Engine",
    "color": "#8B5CF6",
    "functionText": "Launches the multi-supplier price comparison matrix, enforcing the 3-vendor canvass quorum, 14-day freshness rules, and VAT breakdowns.",
    "steps": [
      "Click Compare to load live quotations from Everwell, C&C, and Manco.",
      "Check supplier canvass quorum (verifies minimum 3 bids per item).",
      "Inspect unit prices, delivery stock availability, and check dates.",
      "Select winning offers or let the AI optimizer auto-assign candidates."
    ],
    "scenario": "Dave compares quotes for 5 components. The engine instantly flags that Manco's quote is 28 days old and excludes it, ensuring AMGC only procures at fresh market rates."
  },
  "preparer-sheet-bom": {
    "title": "Pre-Procurement Sourcing Job Sheet",
    "icon": "📄",
    "badge": "Verified Summary",
    "color": "#059669",
    "functionText": "Open the frozen sourcing summary linked to this BOM showing locked prices, VAT breakdown, and administrator sign-off status.",
    "steps": [
      "Click \"📄 Sheet\" to open the finalized procurement snapshot.",
      "View the AI Executive Briefing summarizing savings and vendor distribution.",
      "Check whether Administrator Karen Reyes has released the purchase order.",
      "Print official job sheet for field technicians and accounting."
    ],
    "scenario": "Purchasing officer checks the frozen sheet to verify which supplier won each component before writing the official purchase order checks."
  },
  "preparer-delete-bom": {
    "title": "Permanently Delete BOM List",
    "icon": "🗑️",
    "badge": "Draft Management",
    "color": "#EF4444",
    "functionText": "Permanently removes an accidental or obsolete drafting BOM list. Protected against deleting frozen records linked to past financial audits.",
    "steps": [
      "Click Delete on an unneeded drafting BOM.",
      "Confirm deletion in the confirmation prompt.",
      "System logs audit record and removes draft from workspace.",
      "Archived or frozen summaries remain safely preserved in the ledger."
    ],
    "scenario": "Dave created a test draft with dummy part numbers. Once testing is complete, he deletes the draft to keep the preparer workspace clean and uncluttered."
  },
  "editor-add-line": {
    "title": "Add Verified Component Line",
    "icon": "➕",
    "badge": "Component Selection",
    "color": "#0D9488",
    "functionText": "Appends a new line item to the Bill of Materials linked to an accredited catalog SKU with whole-piece quantity validation.",
    "steps": [
      "Click \"+ Add Line Item\" to insert a new row in the parts table.",
      "Select the target HVAC component from the verified catalog dropdown.",
      "Enter required quantity (e.g. 1, 2, 5 whole units).",
      "Save BOM to update component totals."
    ],
    "scenario": "Dave needs to add a 30A contactor to the job parts list. He clicks \"+ Add Line Item\", picks SKU HCC-1XU02AA, sets quantity to 2, and saves."
  },
  "editor-ai-import": {
    "title": "AI CSV & Text BOM Import",
    "icon": "🤖",
    "badge": "Intelligent Ingest",
    "color": "#8B5CF6",
    "functionText": "Extracts component parts lists directly from technician text notes, service tickets, or supplier CSV files and maps them to catalog SKUs.",
    "steps": [
      "Click \"🤖 AI CSV / Text Import\" to open the import modal.",
      "Paste technician notes or drag-and-drop a CSV parts list.",
      "AI engine automatically normalizes component descriptions to catalog SKUs.",
      "Review matched items and import into the active BOM in one click."
    ],
    "scenario": "A technician sends a text: \"Need 2 pcs 45uf cap, 1 contactor 30A, and 1 kg r410a tank\". Dave pastes the text into AI Import; it matches all 3 SKUs and populates the BOM."
  },
  "editor-save-bom": {
    "title": "Save BOM Revision Changes",
    "icon": "💾",
    "badge": "Version Control",
    "color": "#059669",
    "functionText": "Validates line items, prevents duplicate SKUs, updates the revision counter, and saves changes to local storage and Supabase Cloud.",
    "steps": [
      "Verifies that no component appears twice (duplicate detection).",
      "Ensures all quantities are valid positive integers.",
      "Increments the BOM revision number (e.g. Revision 1 → Revision 2).",
      "Enables the \"Compare Saved BOM\" button for procurement evaluation."
    ],
    "scenario": "Dave updates the quantity of refrigerant canisters from 1 to 2. Clicking Save increments the list to Revision 2 and confirms all lines are ready for comparison."
  },
  "editor-compare-bom": {
    "title": "Proceed to Sourcing Comparison",
    "icon": "🚀",
    "badge": "Workflow Handoff",
    "color": "#2563EB",
    "functionText": "Transitions from the editing phase to the multi-supplier comparison engine to evaluate bids, stock levels, and tax calculations.",
    "steps": [
      "Ensures BOM is saved with no pending unsaved edits.",
      "Opens #/compare/:id with accredited supplier price matrix.",
      "Loads live quotes from Everwell, C&C, and Manco.",
      "Calculates 12% VAT and enables AI multi-objective strategy optimization."
    ],
    "scenario": "With all 5 line items saved in the BOM, Dave clicks Compare to see which accredited suppliers offer the lowest prices and fastest fulfillment."
  },
  "compare-lowest-cost": {
    "title": "Lowest Cost Sourcing Strategy",
    "icon": "⚡",
    "badge": "Price Minimization",
    "color": "#0D9488",
    "functionText": "Mathematically assigns the lowest-priced eligible quote for every individual line item across all accredited suppliers to achieve maximum savings.",
    "steps": [
      "Click \"⚡ Lowest Cost (₱)\" in the AI Optimizer bar.",
      "Engine evaluates all eligible supplier bids under the 14-day freshness limit.",
      "Picks the absolute cheapest quote on each component line.",
      "Recalculates subtotal and 12% VAT breakdown instantly."
    ],
    "scenario": "On a 5-item overhaul, Everwell is cheapest on capacitors (₱380), while C&C is cheapest on contactors (₱420). Lowest Cost selects both, saving AMGC ₱1,250 over single-vendor pricing."
  },
  "compare-single-supplier": {
    "title": "Single Supplier Consolidation Strategy",
    "icon": "📦",
    "badge": "Logistics Optimization",
    "color": "#2563EB",
    "functionText": "Consolidates procurement onto a single accredited vendor that covers 100% of line items to eliminate multi-vendor delivery fees and fragmented purchase orders.",
    "steps": [
      "Click \"📦 Single Supplier\" in the AI Optimizer bar.",
      "Engine identifies which supplier has active quotes and stock for all items.",
      "Switches all component selections to that single supplier.",
      "Shows total invoice amount under a single purchase order."
    ],
    "scenario": "For an urgent repair needed this afternoon, Dave cannot wait for deliveries from three different suppliers. Single Supplier selects C&C Airconditioning Supply for all items for one combined pickup."
  },
  "compare-stock-resilience": {
    "title": "Stock Resilience & Surplus Buffer Strategy",
    "icon": "🛡️",
    "badge": "Supply Chain Defense",
    "color": "#10B981",
    "functionText": "Prioritizes accredited suppliers with the deepest verified inventory buffer to eliminate stockout risks, backorders, and job site delays.",
    "steps": [
      "Click \"🛡️ Stock Resilience\" in the AI Optimizer bar.",
      "Engine evaluates recorded supplier warehouse inventory counts.",
      "Favors vendors with high stock headroom over marginal price savings.",
      "Prevents selecting suppliers down to their last 1-2 pieces."
    ],
    "scenario": "Manco has contactors for ₱410 with only 3 pcs in stock, while Everwell has them for ₱420 with 45 pcs. Stock Resilience selects Everwell to eliminate risk of stockout upon PO arrival."
  },
  "compare-balanced-mcda": {
    "title": "Balanced MCDA Multi-Objective Optimization",
    "icon": "⚖️",
    "badge": "Multi-Criteria Algorithm",
    "color": "#8B5CF6",
    "functionText": "Calculates a normalized utility score for each bid using administrator-configured MCDA weights (40% Cost, 30% Stock, 20% Freshness, 10% Consolidation).",
    "steps": [
      "Click \"⚖️ Balanced MCDA\" in the AI Optimizer bar.",
      "Applies utility formula: Score = (W_cost * S_cost) + (W_stock * S_stock) + (W_fresh * S_fresh) + (W_cons * S_cons).",
      "Assigns highest-utility candidate for each component line.",
      "Provides optimal balance between fiscal savings and operational reliability."
    ],
    "scenario": "For a commercial client maintenance contract, Dave uses Balanced MCDA to achieve competitive pricing while guaranteeing all parts come from fresh, high-stock vendors."
  },
  "compare-save-summary": {
    "title": "Save Sourcing Summary (Snapshot)",
    "icon": "💾",
    "badge": "Freeze Snapshot",
    "color": "#059669",
    "functionText": "Freezes current supplier selections, unit prices, BIR 12% VAT totals, and compliance proofs into an immutable historical summary awaiting admin sign-off.",
    "steps": [
      "Verify that all component lines are resolved with accredited quotes.",
      "Click \"Save Sourcing Summary\".",
      "System computes SHA-256 evaluation fingerprint to prevent tampering.",
      "Generates AI executive briefing and submits snapshot for admin sign-off."
    ],
    "scenario": "Dave completes the price evaluation for Job #AC-2026-088. He saves the summary, locking the ₱43,950 total so supplier price increases next week will not alter the estimate."
  },
  "compare-print-sheet": {
    "title": "Print Sourcing Job Sheet",
    "icon": "🖨️",
    "badge": "Print Job Sheet",
    "color": "#6366F1",
    "functionText": "Renders an official AMGC pre-procurement evaluation job sheet formatted for clean A4 printing with enterprise branding, VAT breakdown, and sign-off lines.",
    "steps": [
      "Click \"🖨️ Print Sourcing Job Sheet\" to trigger print preview.",
      "Includes company header, tax breakdown, supplier line items, and audit hash.",
      "Formatted for standard A4 paper with neat borders and no UI chrome.",
      "Ready for physical binder archiving or field technician work orders."
    ],
    "scenario": "Before heading to the supplier depot in Pasig, the procurement driver prints the job sheet showing exact item quantities and negotiated prices to present at the counter."
  },
  "compare-vat-dual": {
    "title": "Dual View (Net of VAT & Gross Price)",
    "icon": "📊",
    "badge": "Tax Inspection",
    "color": "#0D9488",
    "functionText": "Displays both the Net of VAT base cost and the 12% VAT-inclusive total on every component line in compliance with Philippine BIR regulations.",
    "steps": [
      "Click \"📊 Dual View\" in the VAT Breakdown bar.",
      "Displays base vatable sales figure alongside 12% VAT addition.",
      "Shows gross total payable per line and across the entire BOM.",
      "Provides full financial transparency for accounting reconciliation."
    ],
    "scenario": "Accountant checks whether the invoice matches BIR Official Receipt requirements: ₱39,241.07 Vatable Sales + ₱4,708.93 VAT = ₱43,950.00 Gross Total."
  },
  "compare-vat-inclusive": {
    "title": "VAT-Inclusive Invoicing View",
    "icon": "🏷️",
    "badge": "Gross Billing",
    "color": "#059669",
    "functionText": "Shows all component prices and line subtotals with the Philippine standard 12% Value Added Tax already factored in, matching client billing amounts.",
    "steps": [
      "Click \"🏷️ VAT-Inclusive\" in the VAT view toggle.",
      "All line prices display the final gross amount due.",
      "Matches supplier invoice totals and retail receipt figures.",
      "Used when preparing customer quotations with tax-inclusive billing."
    ],
    "scenario": "When preparing the client repair invoice, Dave switches to VAT-Inclusive so the customer sees the exact total payable without having to calculate separate tax lines."
  },
  "compare-vat-exclusive": {
    "title": "Net of VAT (Vatable Sales Base)",
    "icon": "📑",
    "badge": "Net Base Cost",
    "color": "#3B82F6",
    "functionText": "Displays component base prices excluding 12% Value Added Tax, enabling direct comparison of true component costs before tax.",
    "steps": [
      "Click \"📑 Net of VAT\" in the VAT view toggle.",
      "Strips 12% VAT to display net supplier material cost.",
      "Allows direct cost comparison across zero-rated or tax-exempt procurement.",
      "Shows gross total in parentheses for reference."
    ],
    "scenario": "For a PEZA-registered tax-exempt export client, Dave views Net of VAT figures to establish pure material costs before applying special tax-free billing rules."
  },
  "compare-simulate-drift": {
    "title": "Simulate Catalog Price Drift",
    "icon": "⚡",
    "badge": "Anti-Drift Guard",
    "color": "#F59E0B",
    "functionText": "Demonstrates the system's real-time drift detection engine by simulating a mid-evaluation price increase and proving stale saves are rejected.",
    "steps": [
      "Click button to simulate Everwell or C&C increasing a component price by ₱25.",
      "System flags \"CATALOG_DRIFT_DETECTED\" and invalidates the evaluation fingerprint.",
      "Blocks outdated saves until Dave re-evaluates the live catalog.",
      "Guarantees procurement never executes on obsolete pricing."
    ],
    "scenario": "Dave shows his professor how PartsCompare prevents financial loss: when a supplier changes prices while a technician is drafting, the system catches the drift and forces re-review."
  },
  "compare-quorum-notice": {
    "title": "Supplier Canvass Quorum Notice",
    "icon": "⚖️",
    "badge": "Procurement Policy",
    "color": "#F59E0B",
    "functionText": "Warns when a component line has fewer than the required 3 competitive supplier bids, enforcing corporate procurement integrity rules.",
    "steps": [
      "Inspect the quotation badge on each line (e.g. \"2 / 3 Quotes\").",
      "If fewer than 3 accredited vendors have submitted quotes, warning displays.",
      "Alerts maintainers to canvass additional suppliers for competitive pricing.",
      "Documented in final audit report to explain sole-source selections."
    ],
    "scenario": "Specialized expansion valve only has quotes from Everwell and Manco. The system alerts Dave that it is below the 3-vendor quorum, prompting him to call C&C for a third bid."
  },
  "summary-approve-signoff": {
    "title": "Executive Sign-Off & PO Release",
    "icon": "✍️",
    "badge": "Admin Authorization",
    "color": "#059669",
    "functionText": "Administrator authorization gate. Confirms procurement compliance, releases the purchase order for dispatch, and logs immutable sign-off.",
    "steps": [
      "Administrator Karen Reyes reviews frozen prices and vendor allocation.",
      "Enter optional authorization notes (e.g. \"Approved for SM Megamall Job\").",
      "Click \"✍️ Acknowledge & Approve Job Sheet\".",
      "Status updates to \"✓ Approved (PO Released)\" across all workspaces."
    ],
    "scenario": "Karen reviews Dave's ₱43,950 sourcing summary. She verifies that all 5 items meet the 14-day freshness limit, signs off, and releases the purchase order to accounting."
  },
  "summary-print-official": {
    "title": "Print Official Invoicing Job Sheet",
    "icon": "🖨️",
    "badge": "Executive Print",
    "color": "#2563EB",
    "functionText": "Generates the finalized, authorized AMGC Airconditioning Services Sourcing Job Sheet with administrative signature stamp and compliance proofs.",
    "steps": [
      "Click to generate the print-ready executive job sheet.",
      "Displays official company credentials, tax breakdown, and vendor allocation.",
      "Includes administrator sign-off timestamp and SHA-256 fingerprint.",
      "Provides legal proof of competitive canvassing for tax and financial audits."
    ],
    "scenario": "Technician brings the printed, signed job sheet to the client facility manager to verify that all replacement parts are authentic OEM parts procured at accredited rates."
  },
  "summary-export-csv": {
    "title": "Export Sourcing Matrix CSV",
    "icon": "📥",
    "badge": "Data Export",
    "color": "#0D9488",
    "functionText": "Exports full line-item sourcing details, supplier names, unit costs, and tax breakdowns into a clean spreadsheet for ERP or accounting integration.",
    "steps": [
      "Click \"Export CSV\" on the frozen summary.",
      "Downloads structured CSV containing SKU, description, vendor, price, and VAT.",
      "Import directly into QuickBooks, SAP, or Microsoft Excel.",
      "Facilitates automated purchase order generation."
    ],
    "scenario": "Accounting imports the exported CSV into their enterprise ledger to automatically generate individual purchase orders for Everwell and C&C."
  },
  "summary-audit-fingerprint": {
    "title": "Tamper-Evident SHA-256 Fingerprint",
    "icon": "🛡️",
    "badge": "Cryptographic Proof",
    "color": "#8B5CF6",
    "functionText": "Cryptographic hash generated at the instant of evaluation that binds the exact combination of catalog prices, policy rules, and selections.",
    "steps": [
      "Generated via SHA-256 hashing of evaluation state.",
      "Permanently displayed on job sheets and stored in audit ledger.",
      "Any post-evaluation price change is immediately revealed as a hash mismatch.",
      "Guarantees absolute data integrity and legal non-repudiation."
    ],
    "scenario": "During an annual audit, the external auditor compares the printed job sheet fingerprint against the database ledger hash to verify no prices were altered after sign-off."
  },
  "admin-edit-profile": {
    "title": "Enterprise Business Profile & Dynamic Branding",
    "icon": "🏢",
    "badge": "Universal Branding",
    "color": "#0D9488",
    "functionText": "Configures corporate name, tax type, business address, and contact numbers, dynamically updating headers, job sheets, and documents system-wide.",
    "steps": [
      "Enter business name (AMGC Airconditioning Services).",
      "Specify location, contact info, and tax registration details.",
      "Click \"Save Profile Changes\".",
      "All printed job sheets, headers, and reports reflect updated branding instantly."
    ],
    "scenario": "Karen updates the company branch address from Pasig to Mandaluyong. The new address immediately appears on all newly printed sourcing job sheets."
  },
  "admin-add-supplier": {
    "title": "Onboard & Accredit New HVAC Vendor",
    "icon": "➕",
    "badge": "Vendor Onboarding",
    "color": "#059669",
    "functionText": "Registers a new supplier organization into the accredited vendor network with depot location, contact information, and catalog tracking.",
    "steps": [
      "Click \"+ Add Accredited Supplier\" to open registration modal.",
      "Enter supplier name (e.g. Aurora Commercial Corporation).",
      "Specify depot branch location, contact number, and representative.",
      "Accredits vendor, allowing them to participate in 3-vendor canvass quorums."
    ],
    "scenario": "Karen accredits a new refrigeration supplier in Quezon City. Once added, Pearl can immediately upload their price list and Dave can canvass their components."
  },
  "catalog-request-supplier": {
    "title": "Propose New Accredited Vendor",
    "icon": "🏢",
    "badge": "Segregation of Duties (SoD)",
    "color": "#0D9488",
    "functionText": "Enables Catalog Maintainers to submit vendor proposals with depot location, contact person, and business justification for formal management accreditation.",
    "steps": [
      "Click \"🏢 Request New Supplier\" to launch vendor proposal modal.",
      "Enter proposed supplier company name, depot address, and direct sales contact.",
      "Specify business justification (e.g. OEM distribution, trade discounts, warranty coverage).",
      "Submit proposal; request queues in Administrator Console for corporate due diligence."
    ],
    "scenario": "Pearl discovers Apex Refrigeration offering 12% bulk trade discount on Danfoss TXVs. She submits an accreditation request with contact info for Karen's review."
  },
  "admin-supplier-requests": {
    "title": "Supplier Due Diligence & Accreditation Queue",
    "icon": "🏢",
    "badge": "Corporate Governance",
    "color": "#0D9488",
    "functionText": "Administrative authorization gate for vetting regional HVAC supplier proposals submitted by operational catalog maintainers before materials can be purchased.",
    "steps": [
      "Inspect proposed supplier company name, depot branch, contact person, and maintainer justification notes.",
      "Perform compliance check (BIR 2303 registration, business permits, payment terms).",
      "Click \"✓ Approve & Accredit\" to activate vendor in company directory or \"✕ Reject\" with feedback notes.",
      "System logs immutable audit event and synchronizes updated supplier network."
    ],
    "scenario": "Karen reviews Pearl's proposal for Apex Refrigeration, confirms their Pasig warehouse and replacement warranty, and clicks Approve. Apex is instantly active for CSV upload."
  },
  "admin-mcda-engine": {
    "title": "MCDA Multi-Criteria Utility Weight Engine",
    "icon": "⚙️",
    "badge": "Algorithm Configuration",
    "color": "#8B5CF6",
    "functionText": "Fine-tunes the relative importance of Cost, Stock, Freshness, and Consolidation in the AI multi-objective decision algorithm. Sum must equal 100%.",
    "steps": [
      "Adjust the 4 utility sliders according to current company procurement policy.",
      "Verify the total sum badge shows \"100% Balanced\".",
      "Click \"Save MCDA Utility Weights\".",
      "BOM Preparer AI recommendations automatically reflect updated business priorities."
    ],
    "scenario": "During the summer heatwave when parts are scarce, Karen increases the Stock Buffer weight to 45% so the system prioritizes suppliers with verified inventory."
  },
  "admin-mcda-cost": {
    "title": "Lowest Unit Cost Weight Ratio",
    "icon": "💰",
    "badge": "Fiscal Weight",
    "color": "#0D9488",
    "functionText": "Controls how aggressively the AI optimizer pursues unit price discounts in PHP. Higher values maximize cost savings per component.",
    "steps": [
      "Drag slider to adjust percentage weight (0% to 100%).",
      "Standard AMGC baseline is 40% cost weight.",
      "Increase when managing tight-budget commercial bids.",
      "Decrease during supply chain disruptions to favor stock security."
    ],
    "scenario": "For a low-margin competitive tender, Karen raises Cost weight to 55%, prioritizing suppliers with rock-bottom component prices."
  },
  "admin-mcda-stock": {
    "title": "Stock Surplus Buffer Weight Ratio",
    "icon": "🛡️",
    "badge": "Resilience Weight",
    "color": "#10B981",
    "functionText": "Controls the preference given to suppliers with deep warehouse inventory headroom. Protects against backorders and stockouts.",
    "steps": [
      "Drag slider to adjust percentage weight (0% to 100%).",
      "Standard AMGC baseline is 30% stock weight.",
      "Penalizes suppliers with low stock (<5 units available).",
      "Favors distributors capable of fulfilling multiple concurrent repair jobs."
    ],
    "scenario": "To prevent field technicians arriving at empty supplier depots, Karen maintains a 30% stock weight, ensuring vendors have sufficient inventory."
  },
  "admin-mcda-freshness": {
    "title": "Quotation Freshness Weight Ratio",
    "icon": "⏱️",
    "badge": "Recency Weight",
    "color": "#F59E0B",
    "functionText": "Rewards recently checked quotes and penalizes older quotes nearing the 14-day policy limit, ensuring pricing accuracy.",
    "steps": [
      "Drag slider to adjust percentage weight (0% to 100%).",
      "Standard AMGC baseline is 20% freshness weight.",
      "Quotes verified today receive maximum freshness utility score.",
      "Quotes older than 7 days receive progressive score discounts."
    ],
    "scenario": "During volatile currency or copper price fluctuations, Karen increases Freshness weight to ensure only quotes checked in the last 48 hours win bids."
  },
  "admin-mcda-consolidation": {
    "title": "Supplier Multi-Line Consolidation Ratio",
    "icon": "📦",
    "badge": "Logistics Weight",
    "color": "#2563EB",
    "functionText": "Rewards assigning multiple BOM lines to the same accredited supplier, minimizing purchase order fragmentation and delivery overhead.",
    "steps": [
      "Drag slider to adjust percentage weight (0% to 100%).",
      "Standard AMGC baseline is 10% consolidation weight.",
      "Reduces administrative time spent managing multiple vendor deliveries.",
      "Strengthens negotiating leverage with primary supply partners."
    ],
    "scenario": "Karen sets a 10% consolidation weight so that if two suppliers have similar prices, the system awards both items to the same vendor to save courier fees."
  },
  "admin-mcda-save": {
    "title": "Save Active MCDA Utility Weights",
    "icon": "💾",
    "badge": "Policy Activation",
    "color": "#059669",
    "functionText": "Validates that utility slider weights total exactly 100% and commits the new configuration to the live system and Supabase Cloud database.",
    "steps": [
      "Ensure total weight badge reads \"Total: 100% ✓ Balanced\".",
      "Click \"Save MCDA Utility Weights\".",
      "System records audit log of policy change.",
      "BOM Preparer workspace immediately updates its algorithmic scoring."
    ],
    "scenario": "Karen finalizes the quarterly procurement matrix, clicks Save, and all technicians drafting repair estimates instantly receive updated AI recommendations."
  },
  "admin-mcda-autobalance": {
    "title": "Auto-Balance Weights to 100%",
    "icon": "⚡",
    "badge": "Automatic Normalization",
    "color": "#8B5CF6",
    "functionText": "Automatically normalizes all 4 MCDA utility sliders proportionally so their sum equals exactly 100% without tedious manual slider adjustments.",
    "steps": [
      "Adjust any sliders freely to express relative priorities.",
      "If total is not 100%, click \"⚡ Auto-Balance to 100%\".",
      "Algorithm mathematically scales values to total exactly 100%.",
      "Enables the Save button immediately."
    ],
    "scenario": "Karen adjusts Cost to 45% and Stock to 35%, leaving total at 110%. She clicks Auto-Balance; the engine scales the values to 40/30/20/10 in 1 second."
  },
  "admin-mcda-presets": {
    "title": "Standard Enterprise Weight Presets",
    "icon": "🎯",
    "badge": "Quick Configurations",
    "color": "#3B82F6",
    "functionText": "One-click predefined procurement strategies designed for different operational modes: Standard AMGC, Equal Balanced, Cost Focus, or Stock Buffer.",
    "steps": [
      "Click \"Standard AMGC\" for optimal day-to-day operations (40/30/20/10).",
      "Click \"Balanced\" for equal 25% distribution across all four criteria.",
      "Click \"Cost Focus\" (55/20/15/10) for tight-budget projects.",
      "Click \"Stock Buffer\" (20/45/25/10) for emergency repairs during shortages."
    ],
    "scenario": "A hurricane causes supply shortages across Luzon. Karen clicks the \"Stock Buffer\" preset to immediately protect AMGC against vendor stockouts."
  },
  "admin-account-requests": {
    "title": "Staff Account Provisioning Queue",
    "icon": "👥",
    "badge": "Access Authorization",
    "color": "#06B6D4",
    "functionText": "Administrative queue to review employee registration submissions, verify role eligibility, and activate authorized user accounts.",
    "steps": [
      "Review applicant name, proposed username, and requested role.",
      "Verify identity and background authorization.",
      "Click \"✓ Approve & Activate\" to create credentials in database.",
      "Staff member can now log in and access their designated workspace."
    ],
    "scenario": "Newly hired technician Marco Santos requests an account via the Sign In portal. Karen inspects the queue, approves the request, and Marco receives preparer access."
  },
  "admin-password-resets": {
    "title": "Anti-Impostor 2FA Password Reset Authorization",
    "icon": "🛡️",
    "badge": "Security Authorization",
    "color": "#F59E0B",
    "functionText": "Queue for staff password reset requests that passed 6-Digit PIN or Security Question verification. Prevents unauthorized account takeovers.",
    "steps": [
      "Only requests passing anti-impostor 2FA verification reach this queue.",
      "Karen inspects applicant role, timestamp, and verification method.",
      "Click \"✓ Approve Reset\" to activate the employee's new password.",
      "Unverified or fraudulent attempts are blocked and logged in the audit ledger."
    ],
    "scenario": "Dave forgot his password and answered his security question (\"manifold gauge\"). His reset request appears here; Karen approves it, completing secure account recovery."
  },
  "admin-staff-lifecycle": {
    "title": "Staff Succession & Soft Deactivation",
    "icon": "👤",
    "badge": "Account Lifecycle",
    "color": "#3B82F6",
    "functionText": "Manage role promotions, emergency deactivations, and staffing transitions while preserving historical audit foreign keys and sign-off records.",
    "steps": [
      "View all active staff, assigned roles, and login statuses.",
      "Click \"Deactivate\" to immediately revoke login access for departed staff.",
      "Past BOMs, summaries, and approvals remain intact (soft deactivation).",
      "Click \"Promote to Admin\" to assign administrative authority."
    ],
    "scenario": "When a maintainer resigns, Karen deactivates their account. The maintainer can no longer log in, but all historical catalog quotes they verified remain attributable in the ledger."
  },
  "admin-audit-ledger": {
    "title": "Immutable Cryptographic Audit Event Ledger",
    "icon": "📜",
    "badge": "Provenance Trail",
    "color": "#6366F1",
    "functionText": "Cryptographically attributable event log recording logins, quote updates, BOM freezes, approvals, and security resets with actor, timestamp, and details.",
    "steps": [
      "Every critical system event is logged automatically with actor and timestamp.",
      "Tracks user authentication, policy edits, and password reset attempts.",
      "Synchronized to Supabase PostgreSQL cloud database.",
      "Provides legal accountability and forensic traceability for audits."
    ],
    "scenario": "Karen reviews the ledger to verify who approved the SM Megamall chiller BOM and confirms Dave created it and Karen signed off at 2:15 PM."
  },
  "admin-supabase-sync": {
    "title": "Live Supabase Cloud PostgreSQL Sync",
    "icon": "☁️",
    "badge": "Cloud Synchronization",
    "color": "#10B981",
    "functionText": "Synchronizes local catalog offers, BOM items, company settings, and audit logs to the enterprise Supabase Cloud PostgreSQL database in real time.",
    "steps": [
      "Displays live connection status and realtime subscription state.",
      "Click \"Sync Local Catalog & BOMs to Supabase\" to push local records.",
      "Enables multi-device collaboration across field tablets and office workstations.",
      "Guarantees zero data loss if browser cache is cleared."
    ],
    "scenario": "Pearl adds 20 new supplier quotes on her office PC. She clicks Sync to Supabase; field technicians opening PartsCompare on tablets immediately see the new quotes."
  },
  "admin-test-latency": {
    "title": "Supabase Cloud Latency & Health Diagnostic",
    "icon": "⚡",
    "badge": "Health Diagnostic",
    "color": "#2DD4BF",
    "functionText": "Pings the live Supabase PostgreSQL server to benchmark network latency, verify API credentials, and check database availability.",
    "steps": [
      "Click \"⚡ Test Supabase Latency\".",
      "Sends lightweight query to Supabase REST endpoint.",
      "Measures round-trip response time in milliseconds.",
      "Confirms cloud readiness for enterprise multi-user synchronization."
    ],
    "scenario": "Before beginning a high-volume catalog import, Pearl tests latency (measuring 42ms), confirming high-speed connection to the cloud database."
  },
  "nav-preparer": {
    "title": "BOM Preparer Workspace Portal",
    "icon": "📋",
    "badge": "Maker Workspace",
    "color": "#3B82F6",
    "functionText": "Switch to the BOM Preparer environment to author exact-part project lists, compare supplier quotes, and freeze procurement job sheets.",
    "steps": [
      "Click to open the Preparer Workspace (#/lists).",
      "Create new repair BOMs or edit active drafting lists.",
      "Evaluate multi-supplier quotes with BIR 12% VAT calculations.",
      "Freeze sourcing decisions for administrative sign-off."
    ],
    "scenario": "Dave clicks \"Preparer Workspace\" in the top navigation to view his active HVAC repair lists and prepare today's compressor replacement estimate."
  },
  "nav-catalog": {
    "title": "Supplier Offer Catalog Portal",
    "icon": "🔧",
    "badge": "Maintainer Workspace",
    "color": "#10B981",
    "functionText": "Switch to the Offer Catalog to curate component prices, ingest quotations via AI, and monitor supplier inventory buffers.",
    "steps": [
      "Click to open the Offer Catalog (#/catalog).",
      "Use \"AI Smart Quote Ingest\" to parse Viber/WhatsApp quotations.",
      "Upload multi-supplier CSV price spreadsheets.",
      "Inspect quote freshness and stock availability."
    ],
    "scenario": "Pearl clicks \"Offer Catalog\" to update capacitor and contactor prices texted by Everwell and C&C sales representatives."
  },
  "nav-summaries": {
    "title": "Saved Sourcing Summaries Portal",
    "icon": "📁",
    "badge": "Archive Portal",
    "color": "#059669",
    "functionText": "Access the permanent archive of all frozen Bill of Materials sourcing summaries, executive sign-offs, and compliance certificates.",
    "steps": [
      "Click to open the Saved Summaries registry (#/summaries).",
      "Browse historical repair job sheets by date and project title.",
      "Inspect locked pricing and management approval status.",
      "Print official A4 job sheets or export CSV matrices."
    ],
    "scenario": "Operations manager opens Saved Summaries to review all repair estimates signed off during the past month and confirm total procurement spend."
  },
  "nav-orders": {
    "title": "Purchase Orders & Parts Tracking",
    "icon": "🧾",
    "badge": "Procurement & Logistics",
    "color": "#0D9488",
    "functionText": "Generate supplier purchase orders from approved job sheets, manage courier dispatch, and track part-by-part warehouse receiving.",
    "steps": [
      "Open the Purchase Order Register (#/orders) or Parts Tracking (#/tracking).",
      "Generate POs from approved summaries or click \"+ Create Purchase Order\".",
      "Issue POs, log courier/waybill tracking numbers, and monitor ETAs.",
      "Record partial or full component deliveries and print official POs."
    ],
    "scenario": "After Karen approves Job #AC-2026-088, Dave generates POs for Everwell and C&C, and Pearl logs the partial delivery of capacitors upon arrival at the Cainta warehouse."
  },
  "nav-admin": {
    "title": "Enterprise Administration Console",
    "icon": "👑",
    "badge": "Auditor Workspace",
    "color": "#F59E0B",
    "functionText": "Switch to the Administration Console to govern enterprise policies, configure MCDA utility weights, authorize staff, and inspect audit logs.",
    "steps": [
      "Click to open the Administration Console (#/).",
      "Adjust MCDA multi-objective utility weight sliders.",
      "Approve new employee accounts and verified password resets.",
      "Audit immutable cryptographic event logs and cloud sync status."
    ],
    "scenario": "Karen clicks \"Administration Console\" to review pending password reset requests and inspect the monthly procurement compliance audit."
  },
  "nav-theme-toggle": {
    "title": "Day / Dark Ergonomic Mode Toggle",
    "icon": "🌓",
    "badge": "Display Theme",
    "color": "#6366F1",
    "functionText": "Switches the interface between High-Contrast Dark Mode (ergonomic for field tablets and dim server rooms) and Clean Light Mode (ideal for office printing).",
    "steps": [
      "Click the theme button to instantly toggle between light and dark themes.",
      "Theme preference is saved to your browser session.",
      "All cards, tables, badges, and guide cards adapt color schemes smoothly."
    ],
    "scenario": "Technician working outdoors in bright daylight clicks the theme toggle to switch to High-Contrast Light Mode for optimal readability on their tablet screen."
  },
  "nav-simulation-badge": {
    "title": "Simulation Sandbox Indicator",
    "icon": "🎮",
    "badge": "Isolated Sandbox",
    "color": "#2DD4BF",
    "functionText": "Indicates that the system is currently running in a safe, isolated simulation environment where edits do not affect real company database records.",
    "steps": [
      "Displays when testing roles via the 1-click landing page demo buttons.",
      "Allows free experimentation with BOM creation, price drift, and resets.",
      "Real AMGC records and Supabase Cloud database remain protected.",
      "Click \"Exit Sandbox\" at any time to return to the live production gateway."
    ],
    "scenario": "During your presentation, you show your professor the simulation sandbox, demonstrating that examiners can safely test features without corrupting live business records."
  },
  "nav-security-pin": {
    "title": "2FA Recovery PIN & Security Question Manager",
    "icon": "🛡️",
    "badge": "Security Profile",
    "color": "#0D9488",
    "functionText": "View and update your personal 6-Digit Anti-Impostor PIN and role-specific Security Question used for self-service password recovery.",
    "steps": [
      "Click \"🛡️ Recovery PIN\" in the top bar.",
      "View your currently registered 6-Digit PIN and Security Question.",
      "Update your answers or change PIN when policy requires.",
      "Ensures you can always recover your account if your password is forgotten."
    ],
    "scenario": "Dave updates his security question to ensure only he can authorize password resets for his preparer account."
  },
  "auth-staff-login": {
    "title": "Staff Workspace Access Portal",
    "icon": "🔑",
    "badge": "Authenticated Gate",
    "color": "#2DD4BF",
    "functionText": "Secure gateway authenticating accredited AMGC personnel into role-specific workspaces with encrypted session management and Supabase sync.",
    "steps": [
      "Enter authorized staff username (dave_pm, pearl_dba, karen_admin).",
      "Enter password (default: demo for presentations).",
      "System verifies active status and provisions role capabilities.",
      "Logs login timestamp in cryptographic audit event ledger."
    ],
    "scenario": "Dave signs in at the start of his shift. The system verifies his preparer role and automatically loads his active BOM repair projects."
  },
  "auth-forgot-password": {
    "title": "Anti-Impostor Password Recovery",
    "icon": "🛡️",
    "badge": "Self-Service 2FA",
    "color": "#F59E0B",
    "functionText": "Self-service account recovery requiring 6-Digit PIN and role-specific Security Question verification, blocking unauthorized impostor resets.",
    "steps": [
      "Click \"Forgot password?\" to launch the identity verification wizard.",
      "Enter your username to load your unique security challenge.",
      "Provide your 6-Digit PIN or correct Security Question answer.",
      "Admins recover instantly; maintainers and preparers queue for admin approval."
    ],
    "scenario": "Dave forgets his password. He enters PIN \"240811\" and answers \"manifold gauge\". His request is verified and forwarded to Karen for one-click approval."
  },
  "auth-quick-fill": {
    "title": "One-Click Staff Username Quick-Fill",
    "icon": "👤",
    "badge": "Demo Accelerator",
    "color": "#3B82F6",
    "functionText": "Instantly populates the username field with accredited staff identities (Dave, Pearl, Karen) for rapid demonstration without manual typing.",
    "steps": [
      "Click \"👤 Dave (Preparer)\" to populate dave_pm.",
      "Click \"🔧 Pearl (Maintainer)\" to populate pearl_dba.",
      "Click \"👑 Karen (Admin)\" to populate karen_admin.",
      "Type \"demo\" in the password box and click Sign In."
    ],
    "scenario": "During your thesis defense, you use quick-fill buttons to switch between Dave, Pearl, and Karen in 2 seconds without risk of spelling mistakes."
  },
  "auth-request-account": {
    "title": "Staff Account Access Request",
    "icon": "📝",
    "badge": "Employee Onboarding",
    "color": "#06B6D4",
    "functionText": "Allows new AMGC technicians and catalog maintainers to submit an account request with contact info, role preference, and security PIN.",
    "steps": [
      "Click \"Request Account\" on the sign-in modal.",
      "Enter full name, desired username, requested role, and complex enterprise password.",
      "Watch the real-time checklist turn green as all 5 complexity criteria (8+ chars, upper, lower, number, symbol) are met.",
      "Set your 6-Digit Recovery PIN and Security Question answer.",
      "Submit for Administrator Karen Reyes to review and activate."
    ],
    "scenario": "New HVAC technician submits an onboarding request with an enterprise-grade password. Karen receives an alert in the Admin Console and activates the account in one click."
  },
  "demo-admin": {
    "title": "Simulated Administrator Console",
    "icon": "👑",
    "badge": "Interactive Sandbox",
    "color": "#F59E0B",
    "functionText": "Explore governance policies, configure MCDA multi-objective weights, audit user signups, and monitor the tamper-evident ledger.",
    "steps": [
      "Click to enter the Administrator Workspace in an isolated demo sandbox.",
      "Adjust MCDA utility sliders (Cost, Stock, Freshness, Consolidation).",
      "Review supplier accreditation and approved password reset requests.",
      "Test cloud synchronization without altering production data."
    ],
    "scenario": "Karen audits monthly system procurement compliance and sets the quote freshness threshold to 14 days to eliminate obsolete pricing."
  },
  "demo-maintainer": {
    "title": "Simulated Offer Catalog Workspace",
    "icon": "🔧",
    "badge": "Interactive Sandbox",
    "color": "#10B981",
    "functionText": "Curate, update, and ingest component offers from accredited suppliers (Everwell, C&C, Manco).",
    "steps": [
      "Click to access the Catalog Maintainer dashboard with demo data.",
      "Use \"AI Smart Quote Ingest\" to parse Viber quotations or upload bulk CSVs.",
      "Audit unit prices in PHP and monitor stock headroom.",
      "Inspect freshness age badges for all active quotations."
    ],
    "scenario": "Pearl ingests a newly texted quotation from Everwell Parts and immediately synchronizes updated compressor capacitor prices."
  },
  "demo-preparer": {
    "title": "Simulated BOM Preparer Workspace",
    "icon": "📋",
    "badge": "Interactive Sandbox",
    "color": "#3B82F6",
    "functionText": "Build job parts lists, compare multi-supplier quotations, run MCDA optimization, and freeze historical summaries.",
    "steps": [
      "Click to evaluate a live repair BOM (e.g. Split-Type AC Overhaul).",
      "Select between Lowest Cost, Single Supplier, or MCDA Balanced strategy.",
      "Freeze the verified sourcing summary to permanently lock prices.",
      "Print official A4 sourcing job sheets for field teams."
    ],
    "scenario": "Dave evaluates quotes for Job #AC-2026-088. He applies the MCDA Balanced strategy to optimize for low cost while maintaining 100% stock coverage."
  }
}
;

  let guideCardEl = null;
  let guideCardTimer = null;
  let guideCardHideTimer = null;

  function initInteractiveGuideCards() {
    window.PC_FEATURE_GUIDES = FEATURE_GUIDES;
    if (document.getElementById('interactiveGuideCard')) return;

    guideCardEl = document.createElement('div');
    guideCardEl.id = 'interactiveGuideCard';
    guideCardEl.className = 'interactive-guide-card';
    guideCardEl.style.display = 'none';
    document.body.appendChild(guideCardEl);

    guideCardEl.addEventListener('mouseenter', () => {
      clearTimeout(guideCardHideTimer);
    });

    guideCardEl.addEventListener('mouseleave', () => {
      hideGuideCard();
    });

    document.addEventListener('mouseover', (ev) => {
      const trigger = ev.target.closest('[data-guide-key]');
      if (!trigger) return;
      const key = trigger.dataset.guideKey;
      if (!key || !FEATURE_GUIDES[key]) return;

      clearTimeout(guideCardHideTimer);
      clearTimeout(guideCardTimer);

      guideCardTimer = setTimeout(() => {
        showGuideCard(trigger, FEATURE_GUIDES[key]);
      }, 180);
    });

    document.addEventListener('mouseout', (ev) => {
      const trigger = ev.target.closest('[data-guide-key]');
      if (!trigger) return;

      clearTimeout(guideCardTimer);
      guideCardHideTimer = setTimeout(() => {
        hideGuideCard();
      }, 150);
    });

    document.addEventListener('click', () => {
      hideGuideCard();
    });
  }

  function showGuideCard(triggerEl, data) {
    if (!guideCardEl || !data) return;

    const accentColor = data.color || '#0D9488';
    guideCardEl.innerHTML = `
      <div class="guide-card-header" style="border-left: 4px solid ${accentColor};">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:22px;">${data.icon}</span>
          <div>
            <div style="font-size:14px; font-weight:700; color:var(--ink);">${esc(data.title)}</div>
            <div class="small" style="color:var(--mute); font-size:11px;">Feature Guide &amp; Real-World Workflow</div>
          </div>
        </div>
        <span class="badge" style="background:${accentColor}20; color:${accentColor}; border:1px solid ${accentColor}40; font-size:10px; font-weight:700;">${esc(data.badge)}</span>
      </div>

      <div class="guide-card-section" style="margin-top:8px;">
        <div class="guide-section-title">🎯 PRIMARY FUNCTION:</div>
        <p class="guide-section-desc">${esc(data.functionText)}</p>
      </div>

      <div class="guide-card-section">
        <div class="guide-section-title">📋 STEP-BY-STEP WORKFLOW:</div>
        <div class="guide-steps-list">
          ${data.steps.map((st, i) => `
            <div class="guide-step-row">
              <span class="guide-step-num" style="background:${accentColor};">${i + 1}</span>
              <span class="guide-step-text">${esc(st)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="guide-card-section guide-scenario-box" style="border-color:${accentColor}35; background:${accentColor}0a;">
        <div class="guide-section-title" style="color:${accentColor};">💡 REAL-WORLD HVAC SCENARIO:</div>
        <p class="guide-scenario-text">${esc(data.scenario)}</p>
      </div>
    `;

    guideCardEl.style.display = 'block';
    guideCardEl.style.opacity = '0';
    guideCardEl.style.transform = 'translateY(6px)';

    const rect = triggerEl.getBoundingClientRect();
    const cardWidth = Math.min(390, window.innerWidth - 24);
    guideCardEl.style.width = cardWidth + 'px';

    const cardHeight = guideCardEl.offsetHeight || 280;
    const margin = 10;

    let left = rect.left;
    if (left + cardWidth > window.innerWidth - margin) {
      left = window.innerWidth - cardWidth - margin;
    }
    if (left < margin) left = margin;

    let top = rect.bottom + 8;
    if (top + cardHeight > window.innerHeight - margin && rect.top > cardHeight + 8) {
      top = rect.top - cardHeight - 8;
    }

    guideCardEl.style.left = left + 'px';
    guideCardEl.style.top = (top + window.scrollY) + 'px';

    requestAnimationFrame(() => {
      guideCardEl.style.opacity = '1';
      guideCardEl.style.transform = 'translateY(0)';
    });
  }

  function hideGuideCard() {
    if (!guideCardEl) return;
    clearTimeout(guideCardTimer);
    clearTimeout(guideCardHideTimer);
    guideCardEl.style.opacity = '0';
    guideCardEl.style.transform = 'translateY(6px)';
    setTimeout(() => {
      if (guideCardEl && guideCardEl.style.opacity === '0') {
        guideCardEl.style.display = 'none';
      }
    }, 180);
  }

  /* ---------- MAX (100%) SMOOTHNESS SCROLL ENGINE (GLOBAL & CONTAINER INERTIA LERP) ---------- */
  function initSmoothScrollEngine(smoothness = 1.0) {
    if (window.PC_SMOOTH_SCROLL) return window.PC_SMOOTH_SCROLL;
    const SMOOTHNESS = Math.min(1.0, Math.max(0.1, Number(smoothness) || 1.0));
    // At max (1.0), use a 0.085 frame-normalized lerp factor for ultra-silky inertia glide
    const BASE_LERP = Math.max(0.085, 1 - SMOOTHNESS * 0.915);
    let currentY = window.scrollY || window.pageYOffset || 0;
    let targetY = currentY;
    let rafId = null;
    let lastFrameTime = 0;
    const containerStates = new WeakMap();

    const getMaxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const findScrollableContainer = (node, deltaY) => {
      let el = node && node.nodeType === 1 ? node : (node && node.parentElement);
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return { nativeOnly: true, el };
        const style = window.getComputedStyle(el);
        const overflowY = style ? style.overflowY : '';
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          if ((deltaY < 0 && el.scrollTop > 0) || (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)) {
            return { nativeOnly: false, el };
          }
        }
        el = el.parentElement;
      }
      return null;
    };

    const smoothScrollContainer = (el, delta) => {
      let st = containerStates.get(el);
      if (!st) {
        st = { current: el.scrollTop, target: el.scrollTop, raf: null, lastTime: 0 };
        containerStates.set(el, st);
      }
      if (!st.raf) {
        st.current = el.scrollTop;
        st.target = el.scrollTop;
        st.lastTime = performance.now();
      }
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      st.target = Math.max(0, Math.min(maxTop, st.target + delta));

      const stepContainer = (now) => {
        const dt = Math.min(32, Math.max(8, now - (st.lastTime || now)));
        st.lastTime = now;
        const frameScale = dt / 16.667;
        const alpha = 1 - Math.pow(1 - BASE_LERP, frameScale);
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        st.target = Math.max(0, Math.min(max, st.target));
        const diff = st.target - st.current;
        if (Math.abs(diff) <= 0.4) {
          st.current = st.target;
          el.scrollTop = Math.round(st.current);
          st.raf = null;
          return;
        }
        st.current += diff * alpha;
        el.scrollTop = st.current;
        st.raf = requestAnimationFrame(stepContainer);
      };

      if (!st.raf) {
        st.raf = requestAnimationFrame(stepContainer);
      }
    };

    const tick = (now) => {
      const dt = Math.min(32, Math.max(8, (now || performance.now()) - (lastFrameTime || now || performance.now())));
      lastFrameTime = now || performance.now();
      const frameScale = dt / 16.667;
      const alpha = 1 - Math.pow(1 - BASE_LERP, frameScale);

      const maxScroll = getMaxScroll();
      targetY = Math.max(0, Math.min(maxScroll, targetY));
      const diff = targetY - currentY;
      if (Math.abs(diff) <= 0.4) {
        currentY = targetY;
        window.scrollTo(0, Math.round(currentY));
        rafId = null;
        return;
      }
      currentY += diff * alpha;
      window.scrollTo(0, currentY);
      rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!rafId) {
        currentY = window.scrollY || window.pageYOffset || 0;
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('wheel', (ev) => {
      if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      let delta = ev.deltaY;
      if (ev.deltaMode === 1) delta *= 40;
      else if (ev.deltaMode === 2) delta *= window.innerHeight * 0.85;

      const inner = findScrollableContainer(ev.target, delta);
      if (inner) {
        if (inner.nativeOnly) return;
        ev.preventDefault();
        smoothScrollContainer(inner.el, delta);
        return;
      }

      const maxScroll = getMaxScroll();
      if (maxScroll <= 0) return;

      if (!rafId) {
        currentY = window.scrollY || window.pageYOffset || 0;
        targetY = currentY;
      }

      ev.preventDefault();
      targetY = Math.max(0, Math.min(maxScroll, targetY + delta));
      startLoop();
    }, { passive: false });

    window.addEventListener('scroll', () => {
      if (!rafId) {
        currentY = window.scrollY || window.pageYOffset || 0;
        targetY = currentY;
      }
    }, { passive: true });

    const api = {
      smoothness: SMOOTHNESS,
      sync(y) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        const next = typeof y === 'number' ? y : (window.scrollY || window.pageYOffset || 0);
        currentY = next;
        targetY = next;
      },
      scrollToY(y) {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          window.scrollTo(0, y);
          api.sync(y);
          return;
        }
        if (!rafId) currentY = window.scrollY || window.pageYOffset || 0;
        targetY = Math.max(0, Math.min(getMaxScroll(), Number(y) || 0));
        startLoop();
      },
      scrollToElement(el, offsetPx = 76) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dest = (window.scrollY || window.pageYOffset || 0) + rect.top - offsetPx;
        api.scrollToY(dest);
      }
    };

    window.PC_SMOOTH_SCROLL = api;
    return api;
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSmoothScrollEngine(1.0);
      loadInitialCompanyProfile();
      initFloatingHelpWidget();
      initInteractiveGuideCards();
    });
  } else {
    initSmoothScrollEngine(1.0);
    loadInitialCompanyProfile();
    initFloatingHelpWidget();
    initInteractiveGuideCards();
  }
  
  route();
})();
