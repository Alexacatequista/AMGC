/* 
 * Landing page.
 * Universal Enterprise PartsCompare Architecture
 */
(function () {
  const A = window.PC_ART;
  const money = (m) => 'PHP ' + (m / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const PARTS = [
    { 
      name: 'CBB65-45UF-450V', 
      desc: 'Dual Run Motor Capacitor 45µF 450VAC', 
      art: () => A.chip(), 
      offers: [
        ['Everwell Parts & Equipment Corp.', 38000, 45, 2], 
        ['C&C Airconditioning Supply', 42000, 30, 4], 
        ['Manco Refrigeration Supply', 39500, 3, 1]
      ] 
    },
    { 
      name: 'HCC-1XU02AA', 
      desc: 'Heavy Duty Defrost Contactor 30A 240V', 
      art: () => A.sensor(), 
      offers: [
        ['C&C Airconditioning Supply', 45000, 40, 1], 
        ['Everwell Parts & Equipment Corp.', 48000, 25, 3], 
        ['Manco Refrigeration Supply', 51000, 20, 28] // Stale: 28 days
      ] 
    },
    { 
      name: 'R410A-CAN-1KG', 
      desc: 'Virgin Refrigerant R410A Sealed Canister 1 kg', 
      art: () => A.servo(), 
      offers: [
        ['C&C Airconditioning Supply', 72000, 50, 2], 
        ['Everwell Parts & Equipment Corp.', 75000, 60, 2], 
        ['Manco Refrigeration Supply', 78000, 15, 5]
      ] 
    },
  ];

  const step = (n, icon, t, p) => '<div class="step rv"><div class="step-ic">' + A.icons[icon] + '</div><div class="step-n">Step ' + n + '</div><h3>' + t + '</h3><p>' + p + '</p></div>';
  const feat = (icon, t, p) => '<div class="feat rv"><div class="feat-ic">' + A.icons[icon] + '</div><h3>' + t + '</h3><p>' + p + '</p></div>';

  function html() {
    return '<section class="hero">' + A.circuit()
      + '<div class="hero-in"><div class="hero-copy rv in">'
      + '<div class="pill" id="heroCompanyPill" style="margin-bottom:12px;background:rgba(45,212,191,0.15);color:#0D9488;border:1px solid rgba(45,212,191,0.3);font-weight:600">Enterprise Sourcing Operations</div>'
      + '<h1>Compare Philippine HVAC supplier offers. Keep the proof.</h1>'
      + '<p class="lead">Audit dated component prices from accredited suppliers (Everwell Parts, C&C Airconditioning Supply, Manco Refrigeration). Apply AI normalization, enforce configurable freshness rules, and freeze tamper-proof sourcing summaries.</p>'
      + '<div class="row" style="gap:12px; flex-wrap:wrap; align-items:center;">'
      + '<a class="btn primary big" href="#/login" data-guide-key="staff-login">🔒 Sign In to Sourcing Portal (Live)</a>'
      + '<button type="button" class="btn ghost big" data-action="scroll" data-target="how">See how it works</button>'
      + '</div>'
      + '<div class="hero-quick-roles">'
      + '<div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#7CD3CF;margin-bottom:8px;display:flex;align-items:center;gap:6px;">'
      + '<span>🎮 Test-Drive in Safe Simulation Sandbox (No Password Required):</span>'
      + '</div>'
      + '<div class="row" style="gap:8px;flex-wrap:wrap;">'
      + '<button type="button" class="btn hero-role-btn" data-action="start-simulation" data-role="admin" data-guide-key="demo-admin" title="Test drive as Admin in Simulation Sandbox">👑 <strong>Karen</strong> (Demo Admin)</button>'
      + '<button type="button" class="btn hero-role-btn" data-action="start-simulation" data-role="maintainer" data-guide-key="demo-maintainer" title="Test drive as Maintainer in Simulation Sandbox">🔧 <strong>Pearl</strong> (Demo Maintainer)</button>'
      + '<button type="button" class="btn hero-role-btn" data-action="start-simulation" data-role="preparer" data-guide-key="demo-preparer" title="Test drive as Preparer in Simulation Sandbox">📋 <strong>Dave</strong> (Demo Preparer)</button>'
      + '</div>'
      + '</div>'
      + '<p class="fine">ICCT Colleges Capstone Project Nexus &bull; Partner: <span id="heroPartnerText">AMGC Airconditioning Services</span>.</p></div>'
      + '<div class="hero-art" aria-hidden="true"><div class="hero-chip">' + A.chip('#0B3C43', '#7CD3CF') + '</div>'
      + '<div class="fcard c1"><div class="mono">CBB65-45UF-450V</div><div class="small2">Everwell Parts &middot; ' + money(38000) + ' each</div><span class="badge ok">&#10003; Eligible &middot; Lowest</span></div>'
      + '<div class="fcard c2"><div class="mono">Manco Refrigeration</div><div class="small2">Checked 28 days ago</div><span class="badge bad">Excluded: Exceeds freshness limit</span></div>'
      + '<div class="fcard c3"><div class="small2">Parts subtotal (Job #AC-2026-088)</div><div class="big-n">' + money(439500) + '</div><span class="badge ok">&#10003; Complete &middot; 5 lines resolved</span></div></div></div></section>'
      
      + '<section class="strip"><div class="strip-in"><span>Exact Component SKUs</span><span>Accredited Supplier Networks</span><span>Dynamic MCDA Utility</span><span>AI Decision Explanations</span><span>Frozen Snapshots</span></div></section>'

      /* 1. HOW IT WORKS */
      + '<section class="sec" id="how"><div class="sec-in"><div class="sec-h rv"><h2>From parts list to frozen sourcing summary</h2><p>A rigorous, auditable workflow to verify and preserve component pricing.</p></div><div class="steps">'
      + step(1, 'tag', 'Curate Component Catalog', 'Database maintainers enter exact part numbers and accredited supplier quotations with unit price, stock, date, and invoice reference.')
      + step(2, 'list', 'Prepare Job BOM', 'Job preparers build project requirements with AI CSV import or exact part selection.')
      + step(3, 'check', 'Dynamic MCDA & Rules', 'Every quotation is vetted against freshness limits and 100% quantity coverage. Choose between Cost Minimizer, Supplier Consolidation, or Balanced MCDA.')
      + step(4, 'lock', 'Freeze & Print Summary', 'The chosen values, supplier distributions, and AI executive explanations are permanently frozen into an auditable job sheet.') + '</div></div></section>'

      /* 2. INTERACTIVE DEMO SLIDER */
      + '<section class="sec alt" id="try"><div class="sec-in"><div class="sec-h rv"><h2>Interactive Eligibility Simulator</h2><p>Adjust the sliders to simulate market conditions. Quotes older than the age limit or lacking stock quantity drop out in real-time.</p></div>'
      + '<div class="try rv"><div class="try-ctl"><div><label for="try-part">Component</label><select id="try-part">' + PARTS.map((p, i) => '<option value="' + i + '">' + p.name + ' - ' + p.desc + '</option>').join('') + '</select></div>'
      + '<div><label for="try-qty">Quantity needed: <strong id="try-qty-v">6</strong></label><input id="try-qty" type="range" min="1" max="50" value="6"></div>'
      + '<div><label for="try-age">Oldest accepted check: <strong id="try-age-v">14</strong> days</label><input id="try-age" type="range" min="3" max="35" value="14"></div>'
      + '<div class="try-art" id="try-art"></div></div><div class="try-out" id="try-out" aria-live="polite"></div></div></div></section>'

      /* 3. CORE PRINCIPLES */
      + '<section class="sec"><div class="sec-in"><div class="sec-h rv"><h2>Engineered for procurement transparency</h2><p>Eliminating hidden markups, outdated quotes, and inaccurate job estimates.</p></div><div class="feats">'
      + feat('check', 'Rigorous Eligibility', 'Every vendor offer demonstrates explicit compliance or itemized exclusion reasons.')
      + feat('warn', 'Unresolved is Not Zero', 'Incomplete parts are never hidden as zero cost, protecting technicians from underpriced estimates.')
      + feat('clock', 'Configurable Freshness Window', 'Accounts for supply chain market fluctuations through strictly dated quotations.')
      + feat('lock', 'Immutable Snapshots', 'Saved summaries are cryptographically fingerprinted and immune to subsequent catalog edits.') + '</div></div></section>'

      /* 4. CALL TO ACTION - DUAL ACCESS GATE */
      + '<section class="cta"><div class="cta-in rv">'
      + '<h2>Experience the Sourcing Workflow or Sign In</h2>'
      + '<p>Authorized AMGC staff can sign in to the live production workspace. Evaluators, students, and guests can safely test-drive an isolated simulation sandbox without seeing private company records.</p>'
      + '<div class="row" style="justify-content:center;gap:12px;margin-bottom:6px;flex-wrap:wrap;">'
      + '<a class="btn primary big" href="#/login" data-guide-key="staff-login" style="font-weight:700; padding:12px 28px; font-size:16px;">🔒 Sign In to Staff Workspace (Live Enterprise)</a>'
      + '</div>'
      + '<div class="small" style="color:var(--mute); margin-bottom:20px;">Strict password authentication &bull; Direct access to live AMGC records</div>'
      + '<div style="display:flex; align-items:center; gap:12px; max-width:440px; margin:0 auto 16px; color:var(--mute);">'
      + '<div style="flex:1; height:1px; background:var(--line);"></div>'
      + '<span class="small" style="font-weight:700; text-transform:uppercase; letter-spacing:0.6px; font-size:11px;">Or Explore in Safe Simulation Mode</span>'
      + '<div style="flex:1; height:1px; background:var(--line);"></div>'
      + '</div>'
      + '<div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap;">'
      + '<button type="button" class="btn hero-role-btn" data-action="start-simulation" data-role="admin" data-guide-key="demo-admin" style="display:inline-flex; align-items:center; gap:6px;">🎮 Simulated Admin (Karen)</button>'
      + '<button type="button" class="btn hero-role-btn" data-action="start-simulation" data-role="maintainer" data-guide-key="demo-maintainer" style="display:inline-flex; align-items:center; gap:6px;">🎮 Simulated Maintainer (Pearl)</button>'
      + '<button type="button" class="btn hero-role-btn" data-action="start-simulation" data-role="preparer" data-guide-key="demo-preparer" style="display:inline-flex; align-items:center; gap:6px;">🎮 Simulated Preparer (Dave)</button>'
      + '</div>'
      + '<div class="small" style="color:#2DD4BF; margin-top:14px; font-weight:600;">'
      + '🛡️ Isolated Demo Sandbox: Tests AI comparison &amp; BOM tools with sample data. Live company database is 100% protected.'
      + '</div>'
      + '</div></section>'

      /* 5. BEDLOFT-STYLE STRUCTURED FOOTER */
      + '<footer class="foot-pro" id="footer">'
      + '<div class="foot-pro-in">'
      
      + '<div class="foot-col foot-brand-col">'
      + '<div class="brand" style="color:#fff;margin-bottom:12px">'
      + '<svg width="28" height="28" viewBox="0 0 96 96" aria-hidden="true"><rect width="96" height="96" rx="22" fill="#2DD4BF"/><rect x="20" y="22" width="36" height="10" rx="5" fill="#0F1B2D" fill-opacity="0.6"/><rect x="20" y="44" width="44" height="10" rx="5" fill="#0F1B2D"/><rect x="20" y="66" width="30" height="10" rx="5" fill="#0F1B2D" fill-opacity="0.6"/><circle cx="70" cy="49" r="13" fill="#0F1B2D"/><path d="M63.5 49.5l4.5 4.5 8.5-9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<span>Parts<span style="color:#2DD4BF">Compare</span></span>'
      + '</div>'
      + '<p style="color:#94A3B8;font-size:13px;line-height:1.6;margin-bottom:14px">Universal Bill of Materials Comparison System using curated supplier quotations. Providing reproducible evaluations and frozen sourcing summaries.</p>'
      + '</div>'

      + '<div class="foot-col">'
      + '<div class="foot-heading">ENTERPRISE</div>'
      + '<ul class="foot-links">'
      + '<li><a href="#/about">About System</a></li>'
        + '<li><button type="button" class="navbtn-link" data-action="scroll" data-target="try" style="background:none;border:none;color:#94A3B8;padding:0;font:inherit;cursor:pointer;">Interactive Simulator</button></li>'
      + '<li><a href="mailto:support@partscompare.edu.ph">support@partscompare.edu.ph</a></li>'
      + '<li><a href="https://icct.edu.ph" target="_blank" rel="noopener">ICCT Colleges Foundation Inc.</a></li>'
      + '</ul></div>'

      + '<div class="foot-col">'
      + '<div class="foot-heading">POLICIES &amp; FAQS</div>'
      + '<ul class="foot-links">'
      + '<li><a href="#/faqs">Frequently Asked Questions</a></li>'
      + '<li><a href="#/faqs">Offer Freshness Rule</a></li>'
      + '<li><a href="#/faqs">Unresolved Requirements Policy</a></li>'
      + '<li><a href="#/faqs">Preserved Sourcing Snapshots</a></li>'
      + '</ul></div>'

      + '<div class="foot-col">'
      + '<div class="foot-heading">HEADQUARTERS</div>'
      + '<ul class="foot-links">'
      + '<li><span style="color:#CBD5E1;font-size:13px;">College of Engineering &amp; Digital Technology</span></li>'
      + '<li><span id="footerLocationText" style="color:#94A3B8;font-size:13px;">V.V. Soliven Ave. II, Cainta, Rizal, Philippines</span></li>'
      + '<li><a href="mailto:support@partscompare.edu.ph" style="color:#2DD4BF;">Send an Email</a></li>'
      + '<li><a href="#/login">Authorized Access Portals</a></li>'
      + '</ul></div>'

      + '</div>'
      + '<div class="foot-pro-bottom">'
      + '<div class="foot-pro-bottom-in">'
      + '<span>&copy; 2026 PartsCompare &bull; Project Nexus (CEDT). All rights reserved.</span>'
      + '</div></div>'
      + '</footer>';
  }

  function drawTry() {
    const p = PARTS[+document.getElementById('try-part').value];
    const qty = +document.getElementById('try-qty').value, age = +document.getElementById('try-age').value;
    document.getElementById('try-qty-v').textContent = qty; 
    document.getElementById('try-age-v').textContent = age;
    document.getElementById('try-art').innerHTML = p.art();
    const rows = p.offers.map(([shop, price, rq, ago]) => {
      const reasons = []; 
      if (ago > age) reasons.push('Checked ' + ago + ' days ago, exceeds the ' + age + '-day freshness limit'); 
      if (rq < qty) reasons.push('Only ' + rq + ' recorded in stock, ' + qty + ' required');
      return { shop, price, rq, ago, ok: !reasons.length, reasons };
    });
    const el = rows.filter((r) => r.ok); 
    const min = el.length ? Math.min(...el.map((r) => r.price)) : null;
    document.getElementById('try-out').innerHTML = '<h3>' + p.name + ' &times; ' + qty + ' units</h3>'
      + rows.map((r) => '<div class="toffer' + (r.ok ? '' : ' off') + (r.ok && r.price === min ? ' best' : '') + '"><div><strong>' + r.shop + '</strong><div class="small2">' + money(r.price) + ' each &middot; recorded stock ' + r.rq + ' &middot; checked ' + r.ago + ' days ago</div>'
        + (r.ok ? '' : '<ul>' + r.reasons.map((x) => '<li>' + x + '</li>').join('') + '</ul>') + '</div><div class="tright">'
        + (r.ok ? '<span class="badge ok">&#10003; Eligible</span>' + (r.price === min ? '<span class="badge gray">Lowest eligible</span>' : '') : '<span class="badge bad">Excluded</span>') + '</div></div>').join('')
      + '<div class="tres">' + (el.length ? '<span>Line cost with lowest eligible offer</span><strong>' + money(min * qty) + '</strong>' : '<span class="badge warn">! Unresolved: no eligible offer</span><span>Not counted in total, and not treated as zero.</span>') + '</div>';
  }

  function mount() {
    ['try-part', 'try-qty', 'try-age'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', drawTry);
    });
    drawTry();
    const els = document.querySelectorAll('.rv:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  window.PC_LANDING = { html, mount };
})();
