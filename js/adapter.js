/*
 * DATA ADAPTER & SUPABASE CLOUD INTEGRATION
 * Universal Enterprise PartsCompare Architecture
 * Supports Dynamic Company Settings, Staff Lifecycle / Succession,
 * Interactive MCDA Utility Weights, and Immutable Audit Ledger.
 */
(function () {
  const KEY = 'partscompare_enterprise_v3';
  const SKEY = 'partscompare_enterprise_session';
  const SIM_KEY = 'partscompare_simulation_sandbox_v1';
  const SIM_SKEY = 'partscompare_simulation_session';

  const SUPABASE_URL = 'https://xahcgiwwyaskazgbgejh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_AkccI9Jh_aikiAkSizP37g_ZIP7iJ5z';

  let realSupabase = null;
  let supabase = null;
  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      realSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      supabase = realSupabase;
    }
  } catch (err) {
    console.warn('Supabase initialization fallback to local:', err);
  }

  function isSimulation() {
    try {
      return sessionStorage.getItem('pc_simulation_mode') === 'true';
    } catch (e) {
      return false;
    }
  }

  function getStorage() {
    return isSimulation() ? sessionStorage : localStorage;
  }

  function getKey() {
    return isSimulation() ? SIM_KEY : KEY;
  }

  function getSessionKey() {
    return isSimulation() ? SIM_SKEY : SKEY;
  }

  function syncSupabaseState() {
    supabase = isSimulation() ? null : realSupabase;
  }

  function load() {
    syncSupabaseState();
    const storage = getStorage();
    const storageKey = getKey();
    let s = null;
    try { 
      s = JSON.parse(storage.getItem(storageKey)); 
    } catch (e) { 
      s = null; 
    }
    
    // Seed fixtures if empty or uninitialized
    if (!s || !s.parts || !s.company_settings) {
      s = JSON.parse(JSON.stringify(window.PC_FIXTURES));
      if (isSimulation() && s.company_settings) {
        s.company_settings.business_name = 'AMGC Services (Demo Sandbox)';
      }
      save(s);
    }

    // Ensure company_settings exists
    if (!s.company_settings) {
      s.company_settings = {
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
        mcda_consolidation_weight: 10,
        updated_at: new Date().toISOString()
      };
      save(s);
    }

    if (s.company_settings) {
      let csChanged = false;
      if (!s.company_settings.contact_number) {
        s.company_settings.contact_number = '+63 (02) 8655-2491 / +63 917 123 4567';
        csChanged = true;
      }
      if (s.company_settings.required_supplier_quotes == null) {
        s.company_settings.required_supplier_quotes = 3;
        csChanged = true;
      }
      // Auto-heal any decimal MCDA weights (e.g. 0.40 -> 40)
      if (s.company_settings.mcda_cost_weight != null && s.company_settings.mcda_cost_weight > 0 && s.company_settings.mcda_cost_weight <= 1.0) {
        s.company_settings.mcda_cost_weight = Math.round(s.company_settings.mcda_cost_weight * 100);
        csChanged = true;
      }
      if (s.company_settings.mcda_stock_weight != null && s.company_settings.mcda_stock_weight > 0 && s.company_settings.mcda_stock_weight <= 1.0) {
        s.company_settings.mcda_stock_weight = Math.round(s.company_settings.mcda_stock_weight * 100);
        csChanged = true;
      }
      if (s.company_settings.mcda_freshness_weight != null && s.company_settings.mcda_freshness_weight > 0 && s.company_settings.mcda_freshness_weight <= 1.0) {
        s.company_settings.mcda_freshness_weight = Math.round(s.company_settings.mcda_freshness_weight * 100);
        csChanged = true;
      }
      if (s.company_settings.mcda_consolidation_weight != null && s.company_settings.mcda_consolidation_weight > 0 && s.company_settings.mcda_consolidation_weight <= 1.0) {
        s.company_settings.mcda_consolidation_weight = Math.round(s.company_settings.mcda_consolidation_weight * 100);
        csChanged = true;
      }
      if (csChanged) save(s);
    }

    if (!s.suppliers || !Array.isArray(s.suppliers) || s.suppliers.length === 0) {
      s.suppliers = JSON.parse(JSON.stringify(window.PC_FIXTURES.suppliers));
      save(s);
    }

    // Auto-clean demo test suppliers (e.g. SuntukanSaAceHardware) from local-first storage and Supabase
    if (s.suppliers && Array.isArray(s.suppliers)) {
      const demoMatches = s.suppliers.filter(x => x.name && /suntukan/i.test(x.name));
      if (demoMatches.length > 0) {
        const demoIds = demoMatches.map(x => x.id);
        s.suppliers = s.suppliers.filter(x => !demoIds.includes(x.id));
        if (s.offers && Array.isArray(s.offers)) {
          s.offers = s.offers.filter(o => !demoIds.includes(o.supplier_id));
        }
        save(s);
        if (supabase) {
          try {
            demoIds.forEach(id => {
              supabase.from('suppliers').delete().eq('id', id).then(() => {});
              supabase.from('catalog_offers').delete().eq('supplier_id', id).then(() => {});
            });
          } catch (e) {}
        }
      }
    }

    // Auto-clean demo test summaries and lists (e.g. BotlogCompany) from local-first storage and Supabase
    if (s.summaries && Array.isArray(s.summaries)) {
      const demoSums = s.summaries.filter(x => x.title && /botlog/i.test(x.title));
      if (demoSums.length > 0) {
        const sumIds = demoSums.map(x => x.id);
        s.summaries = s.summaries.filter(x => !sumIds.includes(x.id));
        save(s);
        if (supabase) {
          try {
            sumIds.forEach(id => {
              supabase.from('sourcing_summaries').delete().eq('id', id).then(() => {});
            });
            supabase.from('sourcing_summaries').delete().ilike('name', '%botlog%').then(() => {});
          } catch (e) {}
        }
      }
    }

    if (s.lists && Array.isArray(s.lists)) {
      const demoLists = s.lists.filter(x => x.title && /botlog/i.test(x.title));
      if (demoLists.length > 0) {
        const listIds = demoLists.map(x => x.id);
        s.lists = s.lists.filter(x => !listIds.includes(x.id));
        save(s);
        if (supabase) {
          try {
            listIds.forEach(id => {
              supabase.from('bom_items').delete().eq('list_id', id).then(() => {});
            });
          } catch (e) {}
        }
      }
    }

    // Ensure users have is_active flag and anti-impostor recovery credentials
    const DEFAULT_RECOVERY = {
      dave_pm: { pin: '240811', q: 'What is your employee ID badge or favorite HVAC tool?', a: 'manifold gauge', pass: 'Dave#2026!' },
      pearl_dba: { pin: '350922', q: 'What was the name of your first elementary school?', a: 'san roque elementary', pass: 'Pearl@2026#' },
      karen_admin: { pin: '890415', q: 'What city or municipality were you born in?', a: 'manila', pass: 'Karen$2026*' }
    };
    if (s.users) {
      let usersChanged = false;
      s.users.forEach(u => {
        if (u.is_active === undefined) { u.is_active = true; usersChanged = true; }
        const def = DEFAULT_RECOVERY[(u.username || '').toLowerCase()] || { pin: '517283', q: 'What city or municipality were you born in?', a: 'pasig' };
        if (!u.recovery_pin) { u.recovery_pin = def.pin; usersChanged = true; }
        if (!u.security_question) { u.security_question = def.q; usersChanged = true; }
        if (!u.security_answer) { u.security_answer = def.a; usersChanged = true; }
        if (def && def.pass && (!u.password || u.password === 'demo')) {
          u.password = def.pass;
          usersChanged = true;
        }
        // Ensure Dave and Pearl demo accounts use their distinct security question in existing localStorage
        if (def && u.security_question === 'What city or municipality were you born in?' && u.username !== 'karen_admin') {
          u.security_question = def.q;
          u.security_answer = def.a;
          usersChanged = true;
        }
      });
      if (usersChanged) save(s);
    }

    // Ensure account_requests exists
    if (!s.account_requests || !Array.isArray(s.account_requests)) {
      s.account_requests = [
        {
          id: 'req-01',
          name: 'Engr. Marco Santos',
          username: 'marco_hvac',
          role: 'preparer',
          password: 'demo',
          recovery_pin: '517283',
          security_question: 'What city or municipality were you born in?',
          security_answer: 'pasig',
          status: 'PENDING',
          created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
          reviewed_at: null,
          reviewed_by: null
        }
      ];
      save(s);
    }

    if (!s.password_reset_requests || !Array.isArray(s.password_reset_requests)) {
      s.password_reset_requests = [];
      save(s);
    }

    if (!s.reset_lockouts || typeof s.reset_lockouts !== 'object') {
      s.reset_lockouts = {};
      save(s);
    }

    if (!s.supplier_requests || !Array.isArray(s.supplier_requests)) {
      s.supplier_requests = JSON.parse(JSON.stringify(window.PC_FIXTURES.supplier_requests || [
        {
          id: 'sreq-01',
          name: 'Apex Refrigeration & Industrial Supply',
          location: 'Km. 19 Ortigas Ave. Ext., Pasig City',
          contact: 'Engr. Arnold Mendoza (+63 917 555 4892)',
          notes: 'Authorized Danfoss distributor offering bulk trade discount of 12% on TXVs and filter driers with 1-year replacement warranty.',
          requested_by: 'pearl_dba',
          requested_by_name: 'Pearl Alexa J. Catequista',
          status: 'PENDING',
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          reviewed_at: null,
          reviewed_by: null,
          reason: null
        }
      ]));
      save(s);
    }

    // Ensure policy is present
    if (!s.policy) {
      s.policy = { 
        version: 'POL-ENT-01', 
        max_age_days: s.company_settings.max_quote_age_days || 14, 
        currency: s.company_settings.currency_code || 'PHP', 
        synthetic: false 
      };
      save(s);
    }

    if (!s.audit_logs) {
      s.audit_logs = [];
      save(s);
    }

    if (!Array.isArray(s.supplier_upload_logs)) {
      s.supplier_upload_logs = [];
      save(s);
    }

    // Purchase Orders & delivery tracking ledger
    if (!Array.isArray(s.purchase_orders)) {
      s.purchase_orders = JSON.parse(JSON.stringify((window.PC_FIXTURES && window.PC_FIXTURES.purchase_orders) || []));
      s.__po_seeded = true;
      save(s);
    } else if (s.purchase_orders.length === 0 && !s.__po_seeded && window.PC_FIXTURES && Array.isArray(window.PC_FIXTURES.purchase_orders) && window.PC_FIXTURES.purchase_orders.length > 0) {
      s.purchase_orders = JSON.parse(JSON.stringify(window.PC_FIXTURES.purchase_orders));
      s.__po_seeded = true;
      save(s);
    }

    // Ensure parts have AMGC internal warehouse stock & reorder threshold
    if (Array.isArray(s.parts)) {
      let partsMigrated = false;
      const fixParts = (window.PC_FIXTURES && window.PC_FIXTURES.parts) || [];
      s.parts.forEach((p) => {
        const fp = fixParts.find((x) => x.id === p.id || x.exact_id === p.exact_id);
        if (p.warehouse_stock == null) {
          p.warehouse_stock = fp && fp.warehouse_stock != null ? fp.warehouse_stock : 10;
          partsMigrated = true;
        }
        if (p.min_reorder_level == null) {
          p.min_reorder_level = fp && fp.min_reorder_level != null ? fp.min_reorder_level : 5;
          partsMigrated = true;
        }
      });
      if (partsMigrated) save(s);
    }

    // Ensure offers have historical price trend tracking (prev_price_minor & price_history)
    if (Array.isArray(s.offers)) {
      let offersMigrated = false;
      const fixOffers = (window.PC_FIXTURES && window.PC_FIXTURES.offers) || [];
      s.offers.forEach((o) => {
        const fo = fixOffers.find((x) => x.id === o.id);
        if (o.prev_price_minor === undefined) {
          o.prev_price_minor = fo && fo.prev_price_minor !== undefined ? fo.prev_price_minor : null;
          offersMigrated = true;
        }
        if (!Array.isArray(o.price_history)) {
          o.price_history = fo && Array.isArray(fo.price_history)
            ? JSON.parse(JSON.stringify(fo.price_history))
            : (o.price_minor != null ? [{ price_minor: o.price_minor, date: o.checked_date || todayStr() }] : []);
          offersMigrated = true;
        }
      });
      if (offersMigrated) save(s);
    }

    if (!Array.isArray(s.warehouse_logs)) {
      s.warehouse_logs = [];
      save(s);
    }

    return s;
  }

  function save(s) { 
    try {
      const storage = getStorage();
      const storageKey = getKey();
      storage.setItem(storageKey, JSON.stringify(s)); 
    } catch (e) {
      console.error('Storage write error:', e);
    }
  }

  function nextId(s, prefix) { 
    s.counters.id = (s.counters.id || 100) + 1; 
    return prefix + s.counters.id; 
  }

  function fail(status, code, message, field_errors) { 
    return { status, code, message, field_errors }; 
  }

  function todayStr() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function daysBetween(a, b) {
    const t = (x) => { const [y, m, d] = x.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((t(b) - t(a)) / 86400000);
  }

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'fp' + (h >>> 0).toString(16);
  }

  function uuid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'tok-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  const CAN = {
    preparer: ['lists', 'summaries', 'orders'],
    maintainer: ['catalog', 'orders'],
    administrator: ['catalog', 'lists', 'summaries', 'admin', 'orders'],
  };

  /* ---------- PURCHASE ORDER HELPERS ---------- */
  const PO_STATUSES = ['DRAFT', 'ISSUED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'];
  // Allowed manual status transitions (receiving is handled separately)
  const PO_TRANSITIONS = {
    DRAFT: ['ISSUED', 'CANCELLED'],
    ISSUED: ['CONFIRMED', 'IN_TRANSIT', 'CANCELLED'],
    CONFIRMED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: [],
    PARTIALLY_RECEIVED: ['IN_TRANSIT'],
    RECEIVED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
  };
  const PO_RECEIVABLE = ['ISSUED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'];

  function isAdminRole(u) {
    return u && (u.role === 'administrator' || u.role === 'admin');
  }

  function canSeeAllOrders(u) {
    return isAdminRole(u) || u.role === 'maintainer';
  }

  function poTotals(po) {
    const ordered = po.lines.reduce((a, l) => a + l.quantity, 0);
    const received = po.lines.reduce((a, l) => a + (l.received_qty || 0), 0);
    return { ordered, received, outstanding: ordered - received };
  }

  function getPO(s, u, id) {
    const po = (s.purchase_orders || []).find((x) => x.id === id);
    if (!po) throw fail(404, 'NOT_FOUND', 'Purchase order not found.');
    if (!canSeeAllOrders(u) && po.owner_id !== u.id) {
      throw fail(403, 'FORBIDDEN', 'Access denied to this purchase order.');
    }
    return po;
  }

  function pushPOHistory(po, u, status, event, note) {
    po.history = po.history || [];
    po.history.push({
      at: new Date().toISOString(),
      by: u.name,
      role: u.role,
      status,
      event,
      note: (note || '').trim() || null,
    });
    po.updated_at = new Date().toISOString();
    po.revision = (po.revision || 1) + 1;
  }

  function syncPurchaseOrder(po) {
    if (!supabase) return;
    (async () => {
      try {
        await supabase.from('purchase_orders').upsert([{
          id: po.id,
          po_number: po.po_number,
          summary_id: po.summary_id,
          summary_title: po.summary_title,
          supplier_id: po.supplier_id,
          supplier_name: po.supplier_name,
          status: po.status,
          subtotal_minor: po.subtotal_minor,
          currency: po.currency,
          expected_date: po.expected_date || null,
          courier: po.courier || null,
          tracking_ref: po.tracking_ref || null,
          payment_terms: po.payment_terms || null,
          delivery_address: po.delivery_address || null,
          notes: po.notes || null,
          created_by: po.created_by,
          lines: po.lines,
          history: po.history,
          created_at: po.created_at,
          updated_at: po.updated_at || po.created_at,
        }]);
      } catch (e) { /* offline-first: local ledger remains authoritative */ }
    })();
  }

  function currentUser(s) {
    const sessionKey = getSessionKey();
    const id = sessionStorage.getItem(sessionKey);
    const u = s.users.find((x) => x.id === id);
    if (!u) throw fail(401, 'UNAUTHENTICATED', 'Please sign in.');
    if (u.is_active === false) {
      throw fail(403, 'ACCOUNT_DEACTIVATED', 'This staff account has been deactivated. Please contact an Administrator.');
    }
    return u;
  }

  function need(s, cap) {
    const u = currentUser(s);
    if (u.role === 'administrator' || u.role === 'admin') return u; // Admin has full access
    if (!CAN[u.role] || !CAN[u.role].includes(cap)) {
      throw fail(403, 'FORBIDDEN', 'Your role (' + u.role + ') is not permitted to perform this action.');
    }
    return u;
  }

  const wrap = (fn) => new Promise((resolve, reject) => {
    setTimeout(async () => { 
      try { 
        const res = await fn();
        resolve(res); 
      } catch (e) { 
        reject(e); 
      } 
    }, 60);
  });

  /* ---------- STANDARDIZED AUDIT LOGGING HELPER ---------- */
  function logAudit(action, target, details, user) {
    const s = load();
    const actorName = user ? `${user.name} (${user.role.toUpperCase()})` : 'System';
    const logEntry = {
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor: actorName,
      action: action,
      target: target || 'Enterprise System',
      details: typeof details === 'string' ? details : JSON.stringify(details),
      created_at: new Date().toISOString()
    };
    
    s.audit_logs = s.audit_logs || [];
    s.audit_logs.push(logEntry);
    save(s);

    if (supabase) {
      (async () => {
        try {
          await supabase.from('audit_logs').insert([logEntry]);
        } catch (e) {}
      })();
    }
  }

  /* ---------- RULES EVALUATION ---------- */
  function evaluateOffer(offer, part, qty, policy, today) {
    const r = [];
    if (offer.price_minor == null || offer.recorded_quantity == null || !offer.checked_date || !offer.source_reference) {
      r.push('MISSING_DATA');
    }
    if (!offer.active || !part.active) {
      r.push('INACTIVE');
    }
    if (offer.price_basis !== 'per_piece') {
      r.push('PRICE_BASIS_MISMATCH');
    }
    if (offer.currency !== policy.currency) {
      r.push('CURRENCY_MISMATCH');
    }
    if (offer.checked_date) {
      if (offer.checked_date > today) {
        r.push('FUTURE_DATE');
      } else if (daysBetween(offer.checked_date, today) > policy.max_age_days) {
        r.push('STALE');
      }
    }
    if (offer.recorded_quantity != null && offer.recorded_quantity < qty) {
      r.push('INSUFFICIENT_QUANTITY');
    }
    return r;
  }

  function buildComparison(s, list, selections) {
    const policy = s.policy;
    if (!policy) throw fail(422, 'CONFIG_REQUIRED', 'No comparison policy has been adopted yet.');
    if (!list.lines || !list.lines.length) throw fail(422, 'EMPTY_LIST', 'An empty list cannot be compared.');
    const today = todayStr();

    const lines = list.lines.map((ln) => {
      const part = s.parts.find((p) => p.id === ln.part_id) || { id: ln.part_id, exact_id: 'UNKNOWN', description: 'Unknown item', active: false };
      const candidates = s.offers.filter((o) => o.part_id === ln.part_id).map((o) => {
        const reasons = evaluateOffer(o, part, ln.quantity, policy, today);
        const sup = s.suppliers.find((x) => x.id === o.supplier_id);
        return {
          offer_id: o.id,
          offer_revision: o.revision || 1,
          supplier_id: o.supplier_id,
          supplier_name: sup ? sup.name : 'Unknown Supplier',
          price_minor: o.price_minor,
          prev_price_minor: o.prev_price_minor != null ? o.prev_price_minor : null,
          price_history: Array.isArray(o.price_history) ? o.price_history : [],
          currency: o.currency || policy.currency || 'PHP',
          price_basis: o.price_basis || 'per_piece',
          recorded_quantity: o.recorded_quantity,
          checked_date: o.checked_date,
          source_reference: o.source_reference,
          synthetic: !!o.synthetic,
          eligible: reasons.length === 0,
          reasons,
        };
      });

      const eligible = candidates.filter((c) => c.eligible);
      const reqQuorum = (s.company_settings && s.company_settings.required_supplier_quotes) || 3;
      const meets_quorum = eligible.length >= reqQuorum;
      let lowest = [];
      if (eligible.length) {
        const min = Math.min(...eligible.map((c) => c.price_minor));
        lowest = eligible.filter((c) => c.price_minor === min).map((c) => c.offer_id);
      }

      const chosenId = selections ? selections[ln.id] : null;
      let selected = null;
      if (chosenId) {
        selected = candidates.find((c) => c.offer_id === chosenId);
        if (!selected || !selected.eligible) {
          throw fail(422, 'INVALID_INPUT', 'An excluded or unknown offer was selected.');
        }
      }

      let reason = null;
      if (!candidates.length) reason = 'NO_RECORDED_OFFER';
      else if (!eligible.length) reason = 'NO_ELIGIBLE_OFFER';
      else if (!selected) reason = 'NO_SELECTION';

      return {
        line_id: ln.id,
        part_id: part.id,
        exact_id: part.exact_id,
        description: part.description,
        quantity: ln.quantity,
        candidates,
        lowest_eligible_offer_ids: lowest,
        selected_offer_id: selected ? selected.offer_id : null,
        line_status: selected ? 'RESOLVED' : 'UNRESOLVED',
        unresolved_reason: reason,
        line_cost_minor: selected ? selected.price_minor * ln.quantity : null,
        eligible_count: eligible.length,
        required_supplier_quotes: reqQuorum,
        meets_quorum
      };
    });

    const reqQuorum = (s.company_settings && s.company_settings.required_supplier_quotes) || 3;
    const unresolved = lines.filter((l) => l.line_status === 'UNRESOLVED').length;
    const subtotal = lines.reduce((a, l) => a + (l.line_cost_minor || 0), 0);
    const belowQuorumCount = lines.filter((l) => l.eligible_count < reqQuorum).length;

    const fpSource = JSON.stringify({
      lr: list.revision,
      pv: policy.version,
      l: lines.map((l) => [
        l.line_id,
        l.quantity,
        l.candidates.map((c) => [c.offer_id, c.offer_revision, c.price_minor, c.recorded_quantity, c.checked_date, c.reasons.join('+')])
      ]),
    });

    return {
      list_revision: list.revision,
      policy_version: policy.version,
      review_fingerprint: hash(fpSource),
      currency: policy.currency,
      money_scale: 2,
      evaluation_date: today,
      policy: { max_age_days: policy.max_age_days, currency: policy.currency },
      lines,
      summary: {
        status: unresolved === 0 ? 'COMPLETE' : 'INCOMPLETE',
        unresolved_count: unresolved,
        subtotal_minor: subtotal,
        required_supplier_quotes: reqQuorum,
        below_quorum_count: belowQuorumCount
      },
    };
  }

  function ownList(s, u, id) {
    const l = s.lists.find((x) => x.id === id);
    if (!l) throw fail(404, 'NOT_FOUND', 'List not found.');
    if (u.role !== 'administrator' && u.role !== 'admin' && l.owner_id !== u.id) {
      throw fail(403, 'FORBIDDEN', 'Access denied to this list.');
    }
    return l;
  }

  function validateLines(s, lines) {
    const fe = {};
    const seen = new Set();
    lines.forEach((ln, i) => {
      const part = s.parts.find((p) => p.id === ln.part_id);
      if (!ln.part_id) fe[i] = 'Choose a part.';
      else if (!part) fe[i] = 'Unknown part.';
      else if (!part.active) fe[i] = 'This part is inactive.';
      else if (seen.has(ln.part_id)) fe[i] = 'This part is already on the list.';
      else if (!Number.isInteger(ln.quantity) || ln.quantity < 1) fe[i] = 'Quantity must be a positive whole number.';
      seen.add(ln.part_id);
    });
    return fe;
  }

  const WEAK_PINS = new Set([
    '000000', '111111', '222222', '333333', '444444',
    '555555', '666666', '777777', '888888', '999999',
    '123456', '654321', '123123', '112233', '012345'
  ]);

  function validateRecoveryPin(pin) {
    const clean = String(pin || '').trim();
    if (!/^\d{6}$/.test(clean)) {
      throw fail(400, 'INVALID_PIN', 'Recovery PIN must be exactly 6 numeric digits (0–9).');
    }
    if (WEAK_PINS.has(clean)) {
      throw fail(400, 'WEAK_PIN', 'Please choose a stronger 6-digit PIN (avoid sequences like 123456 or repeated digits like 000000).');
    }
    return clean;
  }

  function normalizeSecurityAnswer(ans) {
    return String(ans || '').trim().toLowerCase().replace(/\s+/g, ' ');
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

  function normalizeWeight(w, fallback) {
    if (w == null) return fallback;
    const num = parseFloat(w);
    if (isNaN(num)) return fallback;
    if (num > 0 && num <= 1.0) return Math.round(num * 100);
    return Math.round(num);
  }

  const api = {
    /* ---------- AUTHENTICATION & SESSION ---------- */
    isSimulationMode: () => isSimulation(),
    validatePasswordComplexity: (pass) => validatePasswordComplexity(pass),

    startSimulation: (role = 'preparer') => wrap(async () => {
      sessionStorage.setItem('pc_simulation_mode', 'true');
      syncSupabaseState();

      // Ensure fresh simulation fixtures in sessionStorage
      let s = null;
      try { s = JSON.parse(sessionStorage.getItem(SIM_KEY)); } catch (e) { s = null; }
      if (!s || !s.parts || !s.company_settings) {
        s = JSON.parse(JSON.stringify(window.PC_FIXTURES));
        if (s.company_settings) {
          s.company_settings.business_name = 'AMGC Services (Demo Sandbox)';
        }
        sessionStorage.setItem(SIM_KEY, JSON.stringify(s));
      }

      const roleUserMap = {
        admin: 'karen_admin',
        administrator: 'karen_admin',
        maintainer: 'pearl_dba',
        preparer: 'dave_pm'
      };
      const targetUsername = roleUserMap[role] || role || 'dave_pm';
      const u = s.users.find((x) => x.username.toLowerCase() === targetUsername.toLowerCase()) || s.users[0];
      sessionStorage.setItem(SIM_SKEY, u.id);
      return { id: u.id, name: u.name, role: u.role, is_simulation: true, capabilities: CAN[u.role] || [] };
    }),

    exitSimulation: () => wrap(async () => {
      sessionStorage.removeItem('pc_simulation_mode');
      sessionStorage.removeItem(SIM_SKEY);
      sessionStorage.removeItem(SIM_KEY);
      syncSupabaseState();
      return { ok: true };
    }),

    login: (username, password, isQuickDemo = false) => wrap(() => {
      const s = load();
      const u = s.users.find((x) => 
        x.username.toLowerCase() === username.toLowerCase() || 
        (x.alias && x.alias.toLowerCase() === username.toLowerCase())
      );
      if (!u) {
        throw fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials. Check your username or role.');
      }
      if (u.is_active === false) {
        throw fail(403, 'ACCOUNT_DEACTIVATED', 'This staff account has been deactivated. Please contact an Administrator.');
      }
      if (!isSimulation() || !isQuickDemo) {
        const cleanTyped = String(password || '').trim();
        const cleanExpected = String(u.password || 'demo').trim();
        // Allow both currently configured password (or newly reset password) AND the universal demo password 'demo'
        if (cleanTyped !== cleanExpected && cleanTyped !== 'demo') {
          throw fail(401, 'INVALID_CREDENTIALS', 'Invalid password. Please check your credentials and try again.');
        }
      }
      const sessionKey = getSessionKey();
      sessionStorage.setItem(sessionKey, u.id);
      logAudit('USER_LOGIN', `Auth @${u.username}`, `Staff signed in successfully as ${u.role}` + (isSimulation() ? ' [SIMULATION]' : ''), u);
      return { id: u.id, name: u.name, role: u.role, is_simulation: isSimulation(), capabilities: CAN[u.role] || [] };
    }),

    logout: () => wrap(() => { 
      const sessionKey = getSessionKey();
      sessionStorage.removeItem(sessionKey); 
      if (isSimulation()) {
        sessionStorage.removeItem('pc_simulation_mode');
        sessionStorage.removeItem(SIM_KEY);
      }
      return {}; 
    }),

    me: () => wrap(() => {
      const s = load();
      const u = currentUser(s);
      return { id: u.id, name: u.name, role: u.role, is_simulation: isSimulation(), capabilities: CAN[u.role] || [] };
    }),

    resetDemo: () => wrap(() => { 
      localStorage.removeItem(KEY); 
      const fresh = load(); 
      return fresh; 
    }),

    /* ---------- MODULE 1: ENTERPRISE BUSINESS PROFILE & UNIVERSAL BRANDING ---------- */
    getCompanyProfile: () => wrap(async () => {
      const s = load();
      if (supabase) {
        try {
          const { data, error } = await supabase.from('company_settings').select('*').eq('id', 1).single();
          if (!error && data) {
            const remoteTime = data.updated_at ? new Date(data.updated_at).getTime() : 0;
            const localTime = s.company_settings && s.company_settings.updated_at ? new Date(s.company_settings.updated_at).getTime() : 0;
            // Only adopt remote data if remote has a newer timestamp
            if (remoteTime > localTime) {
              if (data.mcda_cost_weight != null && data.mcda_cost_weight <= 1.0) data.mcda_cost_weight = Math.round(data.mcda_cost_weight * 100);
              if (data.mcda_stock_weight != null && data.mcda_stock_weight <= 1.0) data.mcda_stock_weight = Math.round(data.mcda_stock_weight * 100);
              if (data.mcda_freshness_weight != null && data.mcda_freshness_weight <= 1.0) data.mcda_freshness_weight = Math.round(data.mcda_freshness_weight * 100);
              if (data.mcda_consolidation_weight != null && data.mcda_consolidation_weight <= 1.0) data.mcda_consolidation_weight = Math.round(data.mcda_consolidation_weight * 100);
              s.company_settings = Object.assign({}, s.company_settings, data);
              save(s);
            }
          }
        } catch (e) {
          console.warn('Supabase fetch company_settings error:', e);
        }
      }
      return s.company_settings || window.PC_FIXTURES.company_settings;
    }),

    saveCompanyProfile: (profile) => wrap(async () => {
      const s = load();
      const u = need(s, 'admin');

      const costW = normalizeWeight(profile.mcda_cost_weight, (s.company_settings && s.company_settings.mcda_cost_weight) || 40);
      const stockW = normalizeWeight(profile.mcda_stock_weight, (s.company_settings && s.company_settings.mcda_stock_weight) || 30);
      const freshW = normalizeWeight(profile.mcda_freshness_weight, (s.company_settings && s.company_settings.mcda_freshness_weight) || 20);
      const consW = normalizeWeight(profile.mcda_consolidation_weight, (s.company_settings && s.company_settings.mcda_consolidation_weight) || 10);

      const clean = {
        id: 1,
        business_name: (profile.business_name || '').trim() || (s.company_settings && s.company_settings.business_name) || 'AMGC Airconditioning Services',
        business_type: (profile.business_type || '').trim() || (s.company_settings && s.company_settings.business_type) || 'Commercial & Industrial HVAC Services',
        location: (profile.location || '').trim() || (s.company_settings && s.company_settings.location) || 'V.V. Soliven Ave. II, Cainta, Rizal, Philippines',
        contact_number: (profile.contact_number || profile.contact || '').trim() || (s.company_settings && s.company_settings.contact_number) || '+63 (02) 8655-2491 / +63 917 123 4567',
        currency_code: (profile.currency_code || 'PHP').trim().toUpperCase(),
        currency_symbol: (profile.currency_symbol || '₱').trim(),
        max_quote_age_days: Number.isInteger(profile.max_quote_age_days) ? profile.max_quote_age_days : 14,
        required_supplier_quotes: Number.isInteger(profile.required_supplier_quotes) && profile.required_supplier_quotes >= 1 ? profile.required_supplier_quotes : 3,
        mcda_cost_weight: costW,
        mcda_stock_weight: stockW,
        mcda_freshness_weight: freshW,
        mcda_consolidation_weight: consW,
        updated_at: new Date().toISOString()
      };

      s.company_settings = clean;
      // Sync policy currency & age limit
      if (s.policy) {
        s.policy.currency = clean.currency_code;
        s.policy.max_age_days = clean.max_quote_age_days;
      }
      save(s);

      if (supabase) {
        try {
          const cloudPayload = {
            id: 1,
            business_name: clean.business_name,
            business_type: clean.business_type,
            location: clean.location,
            currency_code: clean.currency_code,
            currency_symbol: clean.currency_symbol,
            max_quote_age_days: clean.max_quote_age_days,
            required_supplier_quotes: clean.required_supplier_quotes,
            mcda_cost_weight: clean.mcda_cost_weight / 100,
            mcda_stock_weight: clean.mcda_stock_weight / 100,
            mcda_freshness_weight: clean.mcda_freshness_weight / 100,
            mcda_consolidation_weight: clean.mcda_consolidation_weight / 100,
            updated_at: clean.updated_at
          };
          await supabase.from('company_settings').upsert([cloudPayload]);
        } catch (e) {
          console.warn('Supabase saveCompanyProfile upsert error:', e);
        }
      }

      logAudit('PROFILE_UPDATE', 'Enterprise Profile #1', `Updated enterprise profile to "${clean.business_name}" (${clean.business_type}, ${clean.location}, Contact: ${clean.contact_number})`, u);
      return clean;
    }),

    /* ---------- MODULE 2: STAFF LIFECYCLE, SUCCESSION & SOFT DEACTIVATION ---------- */
    listStaff: () => wrap(() => {
      const s = load();
      need(s, 'admin');
      return s.users.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        alias: u.alias,
        is_active: u.is_active !== false
      }));
    }),

    promoteStaffToAdmin: (userId) => wrap(() => {
      const s = load();
      const current = need(s, 'admin');
      const target = s.users.find(x => x.id === userId);
      if (!target) throw fail(404, 'NOT_FOUND', 'Staff user not found.');
      target.role = 'administrator';
      save(s);
      logAudit('STAFF_STATUS_CHANGE', `Staff #${target.id} (@${target.username})`, `Promoted ${target.name} to Administrator for succession handover.`, current);
      return target;
    }),

    toggleStaffStatus: (userId) => wrap(() => {
      const s = load();
      const current = need(s, 'admin');
      const target = s.users.find(x => x.id === userId);
      if (!target) throw fail(404, 'NOT_FOUND', 'Staff user not found.');
      if (target.id === current.id) {
        throw fail(400, 'SELF_DEACTIVATION', 'You cannot deactivate your own active session account.');
      }
      target.is_active = !target.is_active;
      save(s);
      logAudit('STAFF_STATUS_CHANGE', `Staff #${target.id} (@${target.username})`, `${target.is_active ? 'Reactivated' : 'Deactivated'} staff account for ${target.name}.`, current);
      return target;
    }),

    deleteStaff: (userId) => wrap(async () => {
      const s = load();
      const current = need(s, 'admin');
      const target = s.users.find(x => x.id === userId);
      if (!target) throw fail(404, 'NOT_FOUND', 'Staff user not found.');
      if (target.id === current.id) {
        throw fail(400, 'SELF_DELETION', 'You cannot delete your own active administrator account.');
      }

      // Check if user has authored lists or summaries
      const hasAuthored = (s.lists || []).some(l => l.author_id === userId) ||
                          (s.summaries || []).some(sum => sum.author_id === userId);
      if (hasAuthored) {
        target.is_active = false;
        save(s);
        logAudit('STAFF_DEACTIVATED', `Staff #${target.id}`, `Staff member has historical BOM records; deactivated instead of deleted to protect audit trail.`, current);
        return { ok: true, softDeactivated: true, message: 'This staff member has authored historical BOMs/summaries. They have been deactivated instead of deleted to preserve audit integrity.' };
      }

      s.users = s.users.filter(x => x.id !== userId);
      save(s);
      logAudit('STAFF_DELETED', `Staff #${target.id} (@${target.username})`, `Permanently deleted staff account for ${target.name}.`, current);
      return { ok: true, deleted: true, id: userId };
    }),

    /* ---------- MODULE 2B: STAFF ACCOUNT ACCESS & PROVISIONING REQUESTS ---------- */
    listAccountRequests: () => wrap(async () => {
      const s = load();
      need(s, 'admin');
      if (supabase) {
        try {
          const { data, error } = await supabase.from('account_requests').select('*').order('created_at', { ascending: false });
          if (!error && data && data.length) {
            if (!s.account_requests) s.account_requests = [];
            data.forEach(cloudReq => {
              const idx = s.account_requests.findIndex(r => r.id === cloudReq.id || r.username === cloudReq.username);
              if (idx >= 0) {
                s.account_requests[idx] = Object.assign({}, s.account_requests[idx], cloudReq);
              } else {
                s.account_requests.push(cloudReq);
              }
            });
            save(s);
          }
        } catch (e) {}
      }
      return (s.account_requests || []).map(r => Object.assign({}, r));
    }),

    submitAccountRequest: (reqData) => wrap(async () => {
      const s = load();
      const name = (reqData.name || '').trim();
      const username = (reqData.username || '').trim().toLowerCase();
      const role = reqData.role === 'maintainer' ? 'maintainer' : 'preparer';
      const password = reqData.password || '';
      const recoveryPin = validateRecoveryPin(reqData.recovery_pin);
      const securityQuestion = (reqData.security_question || '').trim();
      const securityAnswer = normalizeSecurityAnswer(reqData.security_answer);

      if (!name) throw fail(400, 'VALIDATION_ERROR', 'Full name is required.');
      if (!username) throw fail(400, 'VALIDATION_ERROR', 'Desired username is required.');
      const passCheck = validatePasswordComplexity(password);
      if (!passCheck.valid) {
        throw fail(400, 'WEAK_PASSWORD', 'Password must satisfy enterprise complexity requirements: minimum 8 characters and include uppercase (A-Z), lowercase (a-z), numbers (0-9), and special symbols (!@#$%...).');
      }
      if (!securityQuestion) throw fail(400, 'VALIDATION_ERROR', 'Please choose a Security Question.');
      if (!securityAnswer || securityAnswer.length < 2) throw fail(400, 'VALIDATION_ERROR', 'Security Answer must be at least 2 characters.');

      // Check if username already exists in users
      const existingUser = (s.users || []).find(u => u.username.toLowerCase() === username);
      if (existingUser) {
        throw fail(409, 'USERNAME_TAKEN', `The username @${username} is already registered in the system.`);
      }

      // Check if pending request exists with same username
      if (!s.account_requests) s.account_requests = [];
      const pendingReq = s.account_requests.find(r => r.username.toLowerCase() === username && r.status === 'PENDING');
      if (pendingReq) {
        throw fail(409, 'REQUEST_EXISTS', `A pending registration request for @${username} has already been submitted.`);
      }

      const reqObj = {
        id: 'req-' + Date.now(),
        name,
        username,
        role,
        password,
        recovery_pin: recoveryPin,
        security_question: securityQuestion,
        security_answer: securityAnswer,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null
      };

      s.account_requests.unshift(reqObj);
      save(s);

      if (supabase) {
        try {
          await supabase.from('account_requests').insert([reqObj]);
        } catch (e) {}
      }

      logAudit('STAFF_REQUEST_SUBMITTED', `@${username}`, `Registration request submitted by ${name} for role "${role}" (6-Digit PIN & Security Question configured)`);
      return { ok: true, request: reqObj };
    }),

    approveAccountRequest: (requestId) => wrap(async () => {
      const s = load();
      const current = need(s, 'admin');
      if (!s.account_requests) s.account_requests = [];
      const req = s.account_requests.find(r => r.id === requestId);
      if (!req) throw fail(404, 'NOT_FOUND', 'Account request not found.');
      if (req.status === 'APPROVED') throw fail(400, 'ALREADY_APPROVED', 'This request is already approved.');

      req.status = 'APPROVED';
      req.reviewed_at = new Date().toISOString();
      req.reviewed_by = current.name;

      // Find or create user in s.users
      let user = (s.users || []).find(u => u.username.toLowerCase() === req.username.toLowerCase());
      if (user) {
        user.name = req.name;
        user.role = req.role;
        user.password = req.password;
        if (req.recovery_pin) user.recovery_pin = req.recovery_pin;
        if (req.security_question) user.security_question = req.security_question;
        if (req.security_answer) user.security_answer = req.security_answer;
        user.is_active = true;
      } else {
        user = {
          id: 'u' + Date.now(),
          name: req.name,
          username: req.username,
          alias: req.username,
          role: req.role,
          password: req.password,
          recovery_pin: req.recovery_pin || '517283',
          security_question: req.security_question || 'What city or municipality were you born in?',
          security_answer: req.security_answer || 'pasig',
          is_active: true
        };
        s.users.push(user);
      }

      save(s);

      if (supabase) {
        try {
          await supabase.from('account_requests').update({
            status: 'APPROVED',
            reviewed_at: req.reviewed_at,
            reviewed_by: req.reviewed_by
          }).eq('id', req.id);
        } catch (e) {}
      }

      logAudit('STAFF_REQUEST_APPROVED', `Staff #${user.id} (@${user.username})`, `Administrator ${current.name} approved registration request for ${user.name} (${user.role})`, current);
      return { ok: true, user, request: req };
    }),

    rejectAccountRequest: (requestId, reason) => wrap(async () => {
      const s = load();
      const current = need(s, 'admin');
      if (!s.account_requests) s.account_requests = [];
      const req = s.account_requests.find(r => r.id === requestId);
      if (!req) throw fail(404, 'NOT_FOUND', 'Account request not found.');
      if (req.status === 'REJECTED') throw fail(400, 'ALREADY_REJECTED', 'This request is already rejected.');

      req.status = 'REJECTED';
      req.reviewed_at = new Date().toISOString();
      req.reviewed_by = current.name;
      req.reason = reason || 'Declined by Administrator';

      save(s);

      if (supabase) {
        try {
          await supabase.from('account_requests').update({
            status: 'REJECTED',
            reviewed_at: req.reviewed_at,
            reviewed_by: req.reviewed_by,
            reason: req.reason
          }).eq('id', req.id);
        } catch (e) {}
      }

      logAudit('STAFF_REQUEST_REJECTED', `Request #${req.id} (@${req.username})`, `Administrator ${current.name} declined registration request for ${req.name} (@${req.username})`, current);
      return { ok: true, request: req };
    }),

    /* ---------- MODULE 2C: IDENTITY-VERIFIED PASSWORD RECOVERY & ANTI-IMPOSTOR ENGINE ---------- */
    getRecoveryChallenge: (usernameInput) => wrap(() => {
      const s = load();
      const query = String(usernameInput || '').trim().toLowerCase();
      if (!query) throw fail(400, 'VALIDATION_ERROR', 'Please enter your username.');
      const u = (s.users || []).find(x =>
        x.username.toLowerCase() === query ||
        (x.alias && x.alias.toLowerCase() === query)
      );
      if (!u) {
        throw fail(404, 'ACCOUNT_NOT_FOUND', 'No authorized staff account found with that username.');
      }
      if (u.is_active === false) {
        throw fail(403, 'ACCOUNT_DEACTIVATED', 'This staff account is deactivated. Please contact an Administrator directly.');
      }
      if (!s.reset_lockouts) s.reset_lockouts = {};
      const uKey = u.username.toLowerCase();
      const lock = s.reset_lockouts[uKey];
      if (lock && lock.locked_until) {
        const diffMs = new Date(lock.locked_until).getTime() - Date.now();
        if (diffMs > 0) {
          const secsLeft = Math.ceil(diffMs / 1000);
          throw fail(429, 'RECOVERY_LOCKED', `Account recovery for @${u.username} is temporarily locked due to multiple failed verification attempts (${secsLeft}s remaining).`);
        } else {
          s.reset_lockouts[uKey] = { attempts: 0, locked_until: null };
          save(s);
        }
      }
      const isAdmin = u.role === 'administrator' || u.role === 'admin';
      return {
        username: u.username,
        name: u.name,
        role: u.role,
        is_admin: isAdmin,
        security_question: u.security_question || 'What city or municipality were you born in?',
        requires_both_factors: isAdmin
      };
    }),

    submitPasswordReset: (payload) => wrap(async () => {
      const s = load();
      const query = String(payload.username || '').trim().toLowerCase();
      const u = (s.users || []).find(x =>
        x.username.toLowerCase() === query ||
        (x.alias && x.alias.toLowerCase() === query)
      );
      if (!u) throw fail(404, 'ACCOUNT_NOT_FOUND', 'Staff account not found.');
      if (u.is_active === false) throw fail(403, 'ACCOUNT_DEACTIVATED', 'This staff account is deactivated.');

      if (!s.reset_lockouts) s.reset_lockouts = {};
      const uKey = u.username.toLowerCase();
      let lock = s.reset_lockouts[uKey] || { attempts: 0, locked_until: null };
      if (lock.locked_until) {
        const diffMs = new Date(lock.locked_until).getTime() - Date.now();
        if (diffMs > 0) {
          const secsLeft = Math.ceil(diffMs / 1000);
          throw fail(429, 'RECOVERY_LOCKED', `Account recovery for @${u.username} is locked (${secsLeft}s remaining).`);
        } else {
          lock = { attempts: 0, locked_until: null };
        }
      }

      const newPassword = String(payload.new_password || '');
      const passCheck = validatePasswordComplexity(newPassword);
      if (!passCheck.valid) {
        throw fail(400, 'WEAK_PASSWORD', 'New password must meet enterprise complexity criteria: minimum 8 characters, with uppercase (A-Z), lowercase (a-z), numbers (0-9), and special symbols (!@#$%...).');
      }

      const isAdmin = u.role === 'administrator' || u.role === 'admin';
      const pinRaw = String(payload.pin || '').trim();
      const ansNorm = normalizeSecurityAnswer(payload.security_answer);
      const pinProvided = pinRaw.length > 0;
      const ansProvided = ansNorm.length > 0;

      if (isAdmin && (!pinProvided || !ansProvided)) {
        throw fail(400, 'VALIDATION_ERROR', 'Administrator self-recovery requires BOTH your 6-Digit Recovery PIN and your Security Question Answer.');
      }
      if (!isAdmin && !pinProvided && !ansProvided) {
        throw fail(400, 'VALIDATION_ERROR', 'Please enter your 6-Digit Recovery PIN and/or your Security Question Answer to verify your identity.');
      }

      const pinMatches = pinProvided && pinRaw === String(u.recovery_pin || '');
      const ansMatches = ansProvided && ansNorm === normalizeSecurityAnswer(u.security_answer || '');

      let verifiedOk = false;
      if (isAdmin) {
        verifiedOk = pinMatches && ansMatches;
      } else {
        // Every factor provided by the requester must match (prevents guessing one while failing another)
        const pinCheck = pinProvided ? pinMatches : true;
        const ansCheck = ansProvided ? ansMatches : true;
        verifiedOk = (pinProvided || ansProvided) && pinCheck && ansCheck;
      }

      if (!verifiedOk) {
        lock.attempts = (lock.attempts || 0) + 1;
        if (lock.attempts >= 5) {
          lock.locked_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          s.reset_lockouts[uKey] = lock;
          save(s);
          logAudit('SECURITY_ACCOUNT_LOCKOUT', `Auth @${u.username}`, `Blocked potential impostor: 5 consecutive failed password recovery attempts locked @${u.username} for 5 minutes.`);
          throw fail(429, 'RECOVERY_LOCKED', `Maximum failed attempts (5/5) reached! Recovery for @${u.username} is locked for 5 minutes and reported to the Audit Ledger.`);
        }
        s.reset_lockouts[uKey] = lock;
        save(s);
        const left = 5 - lock.attempts;
        logAudit('SECURITY_RESET_FAILED', `Auth @${u.username}`, `Failed anti-impostor identity check (${lock.attempts}/5) during password recovery for @${u.username}.`);
        throw fail(401, 'VERIFICATION_FAILED', `Identity verification failed (incorrect PIN or Security Answer). ${left} attempt(s) remaining before 5-minute lockout.`);
      }

      // Identity verified — reset lockout counter
      s.reset_lockouts[uKey] = { attempts: 0, locked_until: null };

      const isDualFactor = pinMatches && ansMatches;
      if (isAdmin || isDualFactor) {
        u.password = newPassword;
        save(s);
        logAudit(isAdmin ? 'ADMIN_PASSWORD_RECOVERED' : 'STAFF_PASSWORD_RECOVERED', `Auth @${u.username}`, `${u.name} (${u.role}) verified BOTH 6-Digit PIN + Security Question (2FA) and recovered account password immediately.`, u);
        return {
          ok: true,
          mode: 'IMMEDIATE_ADMIN_RESET',
          message: `✓ 2-Factor Identity Verified (PIN + Security Question)! Password for @${u.username} has been updated immediately.`
        };
      }

      const methodLabel = (pinMatches && ansMatches)
        ? 'PIN + Security Question (2FA)'
        : pinMatches
          ? '6-Digit Recovery PIN'
          : 'Security Question';

      if (!s.password_reset_requests) s.password_reset_requests = [];
      // Mark any older PENDING reset request for this same user as superseded/rejected
      s.password_reset_requests.forEach(r => {
        if (r.username.toLowerCase() === uKey && r.status === 'PENDING') {
          r.status = 'REJECTED';
          r.reason = 'Superseded by newer verified request';
          r.reviewed_at = new Date().toISOString();
          r.reviewed_by = 'System';
        }
      });

      const pwrObj = {
        id: 'pwr-' + Date.now(),
        user_id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        new_password: newPassword,
        verification_method: methodLabel,
        verified: true,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null
      };

      s.password_reset_requests.unshift(pwrObj);
      save(s);

      if (supabase) {
        try {
          await supabase.from('password_reset_requests').insert([pwrObj]);
        } catch (e) {}
      }

      logAudit('PASSWORD_RESET_REQUESTED', `Staff @${u.username}`, `${u.name} passed anti-impostor check (${methodLabel}) and queued a password reset request for Admin approval.`);
      return {
        ok: true,
        mode: 'QUEUED_FOR_ADMIN',
        request: pwrObj,
        message: `✓ Identity Verified (${methodLabel})! Your password reset request has been submitted to the Administrator Console for approval.`
      };
    }),

    listPasswordResetRequests: () => wrap(async () => {
      const s = load();
      need(s, 'admin');
      if (supabase) {
        try {
          const { data, error } = await supabase.from('password_reset_requests').select('*').order('created_at', { ascending: false });
          if (!error && data && data.length) {
            if (!s.password_reset_requests) s.password_reset_requests = [];
            data.forEach(cloudPwr => {
              const idx = s.password_reset_requests.findIndex(r => r.id === cloudPwr.id);
              if (idx >= 0) {
                s.password_reset_requests[idx] = Object.assign({}, s.password_reset_requests[idx], cloudPwr);
              } else {
                s.password_reset_requests.push(cloudPwr);
              }
            });
            save(s);
          }
        } catch (e) {}
      }
      return (s.password_reset_requests || []).map(r => Object.assign({}, r, { new_password: '••••••' }));
    }),

    approvePasswordResetRequest: (requestId) => wrap(async () => {
      const s = load();
      const current = need(s, 'admin');
      if (!s.password_reset_requests) s.password_reset_requests = [];
      const req = s.password_reset_requests.find(r => r.id === requestId);
      if (!req) throw fail(404, 'NOT_FOUND', 'Password reset request not found.');
      if (req.status === 'APPROVED') throw fail(400, 'ALREADY_APPROVED', 'This password reset request is already approved.');

      const u = (s.users || []).find(x => x.id === req.user_id || x.username.toLowerCase() === req.username.toLowerCase());
      if (!u) throw fail(404, 'USER_NOT_FOUND', 'Target staff account not found.');

      u.password = req.new_password;
      if (s.reset_lockouts) {
        s.reset_lockouts[u.username.toLowerCase()] = { attempts: 0, locked_until: null };
      }

      req.status = 'APPROVED';
      req.reviewed_at = new Date().toISOString();
      req.reviewed_by = current.name;
      save(s);

      if (supabase) {
        try {
          await supabase.from('password_reset_requests').update({
            status: 'APPROVED',
            reviewed_at: req.reviewed_at,
            reviewed_by: req.reviewed_by
          }).eq('id', req.id);
        } catch (e) {}
      }

      logAudit('PASSWORD_RESET_APPROVED', `Staff #${u.id} (@${u.username})`, `Administrator ${current.name} approved verified password reset (${req.verification_method}) for ${u.name}.`, current);
      return { ok: true, user: { id: u.id, name: u.name, username: u.username, role: u.role } };
    }),

    rejectPasswordResetRequest: (requestId, reason) => wrap(async () => {
      const s = load();
      const current = need(s, 'admin');
      if (!s.password_reset_requests) s.password_reset_requests = [];
      const req = s.password_reset_requests.find(r => r.id === requestId);
      if (!req) throw fail(404, 'NOT_FOUND', 'Password reset request not found.');
      if (req.status === 'REJECTED') throw fail(400, 'ALREADY_REJECTED', 'This password reset request is already declined.');

      req.status = 'REJECTED';
      req.reviewed_at = new Date().toISOString();
      req.reviewed_by = current.name;
      req.reason = reason || 'Declined by Administrator';
      save(s);

      if (supabase) {
        try {
          await supabase.from('password_reset_requests').update({
            status: 'REJECTED',
            reviewed_at: req.reviewed_at,
            reviewed_by: req.reviewed_by,
            reason: req.reason
          }).eq('id', req.id);
        } catch (e) {}
      }

      logAudit('PASSWORD_RESET_REJECTED', `Reset #${req.id} (@${req.username})`, `Administrator ${current.name} declined password reset request for ${req.name} (@${req.username}).`, current);
      return { ok: true };
    }),

    getMySecuritySettings: () => wrap(() => {
      const s = load();
      const u = currentUser(s);
      return {
        username: u.username,
        name: u.name,
        role: u.role,
        security_question: u.security_question || 'What city or municipality were you born in?',
        has_pin: !!u.recovery_pin
      };
    }),

    updateMySecuritySettings: (payload) => wrap(() => {
      const s = load();
      const u = currentUser(s);
      const expectedPass = u.password || 'demo';
      if (String(payload.current_password || '') !== expectedPass) {
        throw fail(401, 'INVALID_PASSWORD', 'Current password is incorrect.');
      }
      const newPin = validateRecoveryPin(payload.recovery_pin);
      const newQ = String(payload.security_question || '').trim();
      const newA = normalizeSecurityAnswer(payload.security_answer);
      if (!newQ) throw fail(400, 'VALIDATION_ERROR', 'Please select a Security Question.');
      if (!newA || newA.length < 2) throw fail(400, 'VALIDATION_ERROR', 'Security Answer must be at least 2 characters.');

      u.recovery_pin = newPin;
      u.security_question = newQ;
      u.security_answer = newA;
      save(s);
      logAudit('SECURITY_CREDENTIALS_UPDATED', `Auth @${u.username}`, `${u.name} updated their 6-Digit Recovery PIN and Security Question.`, u);
      return { ok: true };
    }),

    /* ---------- MODULE 3: INTERACTIVE MCDA UTILITY WEIGHT ENGINE ---------- */
    getMcdaWeights: () => wrap(() => {
      const s = load();
      const cs = s.company_settings || {};
      const cost = normalizeWeight(cs.mcda_cost_weight, 40);
      const stock = normalizeWeight(cs.mcda_stock_weight, 30);
      const freshness = normalizeWeight(cs.mcda_freshness_weight, 20);
      const consolidation = normalizeWeight(cs.mcda_consolidation_weight, 10);
      return { cost, stock, freshness, consolidation };
    }),

    saveMcdaWeights: (weights) => wrap(async () => {
      const s = load();
      const u = need(s, 'admin');
      const cost = normalizeWeight(weights.cost, 40);
      const stock = normalizeWeight(weights.stock, 30);
      const freshness = normalizeWeight(weights.freshness, 20);
      const consolidation = normalizeWeight(weights.consolidation, 10);
      const sum = cost + stock + freshness + consolidation;

      if (sum !== 100) {
        throw fail(422, 'INVALID_WEIGHTS', `MCDA utility weights must sum exactly to 100% (currently ${sum}%).`);
      }

      s.company_settings = s.company_settings || {};
      s.company_settings.mcda_cost_weight = cost;
      s.company_settings.mcda_stock_weight = stock;
      s.company_settings.mcda_freshness_weight = freshness;
      s.company_settings.mcda_consolidation_weight = consolidation;
      s.company_settings.updated_at = new Date().toISOString();
      save(s);

      if (supabase) {
        try {
          const cloudPayload = {
            id: 1,
            mcda_cost_weight: cost / 100,
            mcda_stock_weight: stock / 100,
            mcda_freshness_weight: freshness / 100,
            mcda_consolidation_weight: consolidation / 100,
            updated_at: s.company_settings.updated_at
          };
          await supabase.from('company_settings').upsert([cloudPayload]);
        } catch (e) {
          console.warn('Supabase saveMcdaWeights upsert error:', e);
        }
      }

      logAudit('POLICY_UPDATE', 'MCDA Utility Weights', `Adjusted MCDA weights: Cost=${cost}%, Stock=${stock}%, Freshness=${freshness}%, Consolidation=${consolidation}%`, u);
      return { cost, stock, freshness, consolidation };
    }),

    /* ---------- MODULE 4: AUDIT TRAIL LOGGING & SNAPSHOT VERIFICATION ---------- */
    listAuditLogs: () => wrap(async () => {
      const s = load();
      need(s, 'admin');
      if (supabase) {
        try {
          const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25);
          if (!error && data && data.length) {
            return data;
          }
        } catch (e) {}
      }
      return (s.audit_logs || []).slice(-25).reverse();
    }),

    /* ---------- POLICY RULES ---------- */
    getPolicy: () => wrap(() => load().policy),

    setPolicy: (max_age_days, currency) => wrap(async () => {
      const s = load();
      const u = currentUser(s);
      if (!Number.isInteger(max_age_days) || max_age_days < 0) {
        throw fail(422, 'INVALID_INPUT', 'Age limit must be a positive number of days.', { max_age_days: 'Enter 0 or more.' });
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw fail(422, 'INVALID_INPUT', 'Currency must be a 3-letter code (e.g. PHP).', { currency: 'Use PHP.' });
      }
      s.counters.policy = (s.counters.policy || 0) + 1;
      s.policy = { 
        version: 'POL-ENT-' + String(s.counters.policy).padStart(2, '0'), 
        max_age_days, 
        currency, 
        synthetic: false 
      };
      
      if (s.company_settings) {
        s.company_settings.max_quote_age_days = max_age_days;
        s.company_settings.currency_code = currency;
      }
      save(s);
      
      logAudit('POLICY_UPDATE', 'Global Quote Freshness', `Set max age threshold to ${max_age_days} days (${currency})`, u);
      return s.policy;
    }),

    /* ---------- CATALOG & OFFERS ---------- */
    listParts: () => wrap(() => { 
      const s = load(); 
      currentUser(s); 
      return s.parts; 
    }),

    listSuppliers: () => wrap(() => { 
      const s = load(); 
      currentUser(s); 
      return s.suppliers || []; 
    }),

    createSupplier: (data) => wrap(async () => {
      const s = load();
      const u = need(s, 'catalog');
      const name = (data.name || '').trim();
      const location = (data.location || '').trim() || 'Philippines';
      const contact = (data.contact || '').trim();
      const accredited = data.accredited !== false;

      if (!name) throw fail(400, 'VALIDATION_ERROR', 'Supplier company name is required.');
      if (!s.suppliers) s.suppliers = [];
      const dup = s.suppliers.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (dup) throw fail(409, 'SUPPLIER_EXISTS', `A supplier named "${name}" is already registered.`);

      const sup = {
        id: nextId(s, 's'),
        name,
        location,
        contact,
        accredited
      };
      s.suppliers.push(sup);
      save(s);

      if (supabase) {
        try {
          await supabase.from('suppliers').insert([sup]);
        } catch (e) {}
      }

      logAudit('SUPPLIER_CREATED', `Supplier #${sup.id}`, `Registered new accredited vendor: "${sup.name}" (${sup.location})`, u);
      return { ok: true, supplier: sup };
    }),

    updateSupplier: (id, data) => wrap(async () => {
      const s = load();
      const u = need(s, 'catalog');
      if (!s.suppliers) s.suppliers = [];
      const sup = s.suppliers.find(x => x.id === id);
      if (!sup) throw fail(404, 'NOT_FOUND', 'Supplier not found.');

      const name = (data.name || '').trim();
      if (!name) throw fail(400, 'VALIDATION_ERROR', 'Supplier company name is required.');
      const dup = s.suppliers.find(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase());
      if (dup) throw fail(409, 'SUPPLIER_EXISTS', `Another supplier named "${name}" is already registered.`);

      sup.name = name;
      if (data.location !== undefined) sup.location = (data.location || '').trim() || 'Philippines';
      if (data.contact !== undefined) sup.contact = (data.contact || '').trim();
      if (data.accredited !== undefined) sup.accredited = !!data.accredited;
      save(s);

      if (supabase) {
        try {
          await supabase.from('suppliers').upsert([sup]);
        } catch (e) {}
      }

      logAudit('SUPPLIER_UPDATED', `Supplier #${sup.id}`, `Updated vendor profile for "${sup.name}"`, u);
      return { ok: true, supplier: sup };
    }),

    toggleSupplierStatus: (id) => wrap(async () => {
      const s = load();
      const u = need(s, 'catalog');
      if (!s.suppliers) s.suppliers = [];
      const sup = s.suppliers.find(x => x.id === id);
      if (!sup) throw fail(404, 'NOT_FOUND', 'Supplier not found.');

      sup.accredited = !sup.accredited;
      save(s);

      if (supabase) {
        try {
          await supabase.from('suppliers').update({ accredited: sup.accredited }).eq('id', sup.id);
        } catch (e) {}
      }

      logAudit('SUPPLIER_STATUS_CHANGED', `Supplier #${sup.id}`, `Changed accreditation for "${sup.name}" to ${sup.accredited ? 'Accredited' : 'Suspended'}`, u);
      return { ok: true, supplier: sup };
    }),

    deleteSupplier: (id) => wrap(async () => {
      const s = load();
      const u = need(s, 'catalog');
      if (!s.suppliers) s.suppliers = [];
      const sup = s.suppliers.find(x => x.id === id);
      if (!sup) throw fail(404, 'NOT_FOUND', 'Supplier not found.');

      const supName = sup.name;
      s.suppliers = s.suppliers.filter(x => x.id !== id);
      if (s.offers && Array.isArray(s.offers)) {
        s.offers = s.offers.filter(o => o.supplier_id !== id);
      }
      save(s);

      if (supabase) {
        try {
          await supabase.from('suppliers').delete().eq('id', id);
          await supabase.from('catalog_offers').delete().eq('supplier_id', id);
        } catch (e) {}
      }

      logAudit('SUPPLIER_DELETED', `Supplier #${id}`, `Permanently deleted vendor "${supName}" from directory`, u);
      return { ok: true, deletedId: id, name: supName };
    }),

    /* ---------- SUPPLIER ACCREDITATION REQUESTS (GOVERNANCE WORKFLOW) ---------- */
    listSupplierRequests: () => wrap(async () => {
      const s = load();
      currentUser(s);
      if (supabase) {
        try {
          const { data, error } = await supabase.from('supplier_requests').select('*').order('created_at', { ascending: false });
          if (!error && data && data.length) {
            if (!s.supplier_requests) s.supplier_requests = [];
            data.forEach(cloudReq => {
              const idx = s.supplier_requests.findIndex(r => r.id === cloudReq.id);
              if (idx >= 0) {
                s.supplier_requests[idx] = Object.assign({}, s.supplier_requests[idx], cloudReq);
              } else {
                s.supplier_requests.push(cloudReq);
              }
            });
            save(s);
          }
        } catch (e) {}
      }
      return (s.supplier_requests || []).map(r => Object.assign({}, r));
    }),

    submitSupplierRequest: (reqData) => wrap(async () => {
      const s = load();
      const u = need(s, 'catalog');
      const name = (reqData.name || '').trim();
      const location = (reqData.location || '').trim();
      const contact = (reqData.contact || '').trim();
      const notes = (reqData.notes || '').trim();

      if (!name) throw fail(400, 'VALIDATION_ERROR', 'Supplier company name is required.');
      if (!location) throw fail(400, 'VALIDATION_ERROR', 'Depot or branch location is required.');
      if (!contact) throw fail(400, 'VALIDATION_ERROR', 'Contact person and phone/email is required.');
      if (!notes) throw fail(400, 'VALIDATION_ERROR', 'Accreditation justification notes are required.');

      if (!s.suppliers) s.suppliers = [];
      const dupSupplier = s.suppliers.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (dupSupplier) {
        throw fail(409, 'SUPPLIER_EXISTS', `A supplier named "${name}" is already accredited in the directory.`);
      }

      if (!s.supplier_requests) s.supplier_requests = [];
      const dupPending = s.supplier_requests.find(r => r.name.toLowerCase() === name.toLowerCase() && r.status === 'PENDING');
      if (dupPending) {
        throw fail(409, 'REQUEST_EXISTS', `A pending accreditation request for "${name}" is already awaiting admin review.`);
      }

      const reqObj = {
        id: 'sreq-' + Date.now(),
        name,
        location,
        contact,
        notes,
        requested_by: u.username,
        requested_by_name: u.name,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        reason: null
      };

      s.supplier_requests.unshift(reqObj);
      save(s);

      if (supabase) {
        try {
          await supabase.from('supplier_requests').insert([reqObj]);
        } catch (e) {}
      }

      logAudit('SUPPLIER_REQUEST_SUBMITTED', `Supplier "${name}"`, `Maintainer ${u.name} submitted accreditation request for "${name}" (${location})`, u);
      return { ok: true, request: reqObj };
    }),

    approveSupplierRequest: (requestId) => wrap(async () => {
      const s = load();
      const current = need(s, 'admin');
      if (!s.supplier_requests) s.supplier_requests = [];
      const req = s.supplier_requests.find(r => r.id === requestId);
      if (!req) throw fail(404, 'NOT_FOUND', 'Supplier request not found.');
      if (req.status === 'APPROVED') throw fail(400, 'ALREADY_APPROVED', 'This request is already approved.');

      req.status = 'APPROVED';
      req.reviewed_at = new Date().toISOString();
      req.reviewed_by = current.name;

      if (!s.suppliers) s.suppliers = [];
      let sup = s.suppliers.find(x => x.name.toLowerCase() === req.name.toLowerCase());
      if (!sup) {
        sup = {
          id: nextId(s, 's'),
          name: req.name,
          location: req.location,
          contact: req.contact,
          accredited: true
        };
        s.suppliers.push(sup);
      } else {
        sup.accredited = true;
      }

      save(s);

      if (supabase) {
        try {
          await supabase.from('supplier_requests').update({
            status: 'APPROVED',
            reviewed_at: req.reviewed_at,
            reviewed_by: req.reviewed_by
          }).eq('id', req.id);
          await supabase.from('suppliers').upsert([sup]);
        } catch (e) {}
      }

      logAudit('SUPPLIER_ACCREDITED', `Supplier #${sup.id} ("${sup.name}")`, `Administrator ${current.name} approved vendor accreditation request submitted by ${req.requested_by_name}`, current);
      return { ok: true, supplier: sup, request: req };
    }),

    rejectSupplierRequest: (requestId, reason) => wrap(async () => {
      const s = load();
      const current = need(s, 'admin');
      if (!s.supplier_requests) s.supplier_requests = [];
      const req = s.supplier_requests.find(r => r.id === requestId);
      if (!req) throw fail(404, 'NOT_FOUND', 'Supplier request not found.');
      if (req.status === 'REJECTED') throw fail(400, 'ALREADY_REJECTED', 'This request is already rejected.');

      req.status = 'REJECTED';
      req.reviewed_at = new Date().toISOString();
      req.reviewed_by = current.name;
      req.reason = reason || 'Accreditation declined by Administrator.';

      save(s);

      if (supabase) {
        try {
          await supabase.from('supplier_requests').update({
            status: 'REJECTED',
            reviewed_at: req.reviewed_at,
            reviewed_by: req.reviewed_by,
            reason: req.reason
          }).eq('id', req.id);
        } catch (e) {}
      }

      logAudit('SUPPLIER_REQUEST_REJECTED', `Supplier "${req.name}"`, `Administrator ${current.name} rejected vendor accreditation request: "${req.reason}"`, current);
      return { ok: true, request: req };
    }),

    createPart: (p) => wrap(() => {
      const s = load();
      const u = need(s, 'catalog');
      const fe = {};
      const id = (p.exact_id || '').trim().toUpperCase();
      if (!id) fe.exact_id = 'Exact part ID is required.';
      else if (s.parts.some((x) => x.exact_id.toUpperCase() === id)) fe.exact_id = 'This part ID already exists.';
      if (Object.keys(fe).length) throw fail(422, 'INVALID_INPUT', 'Please fix highlighted fields.', fe);
      
      const part = {
        id: nextId(s, 'p'),
        exact_id: id,
        description: (p.description || '').trim(),
        unit: 'piece',
        active: true,
        category: p.category || 'General'
      };
      s.parts.push(part);
      save(s);
      logAudit('CREATE_PART', `Part #${part.exact_id}`, `Registered new part ${part.exact_id} - ${part.description}`, u);
      return part;
    }),

    listOffers: () => wrap(() => { 
      const s = load(); 
      need(s, 'catalog'); 
      return s.offers; 
    }),

    saveOffer: (o) => wrap(() => {
      const s = load();
      const u = need(s, 'catalog');
      const fe = {};
      if (!o.part_id) fe.part_id = 'Choose a part.';
      if (!o.supplier_id) fe.supplier_id = 'Choose a supplier.';
      if (o.price_minor != null && (!Number.isInteger(o.price_minor) || o.price_minor < 0)) fe.price = 'Price must be 0 or more.';
      if (o.recorded_quantity != null && (!Number.isInteger(o.recorded_quantity) || o.recorded_quantity < 0)) fe.recorded_quantity = 'Quantity must be a whole number, 0 or more.';
      if (o.checked_date && !/^\d{4}-\d{2}-\d{2}$/.test(o.checked_date)) fe.checked_date = 'Use a valid date (YYYY-MM-DD).';
      if (Object.keys(fe).length) throw fail(422, 'INVALID_INPUT', 'Please fix highlighted fields.', fe);

      const clean = {
        part_id: o.part_id,
        supplier_id: o.supplier_id,
        price_minor: o.price_minor,
        currency: (o.currency || s.policy.currency || 'PHP').toUpperCase(),
        price_basis: o.price_basis || 'per_piece',
        recorded_quantity: o.recorded_quantity,
        checked_date: o.checked_date || null,
        source_reference: (o.source_reference || '').trim() || null,
        active: o.active !== false,
      };

      let resultOffer = null;
      const nowIso = new Date().toISOString();
      const targetPartObj = s.parts.find((p) => p.id === clean.part_id) || {};
      const targetSupObj = s.suppliers.find((sp) => sp.id === clean.supplier_id) || {};
      if (!Array.isArray(s.supplier_upload_logs)) s.supplier_upload_logs = [];

      if (o.id) {
        const cur = s.offers.find((x) => x.id === o.id);
        if (!cur) throw fail(404, 'NOT_FOUND', 'Offer not found.');
        if (cur.revision !== o.revision) {
          throw fail(409, 'REVISION_CONFLICT', 'This offer was modified by another user. Reload and retry.');
        }
        const prevPrice = cur.price_minor;
        const prevStock = cur.recorded_quantity;
        const prevDate = cur.checked_date;
        if (clean.price_minor != null && prevPrice != null && clean.price_minor !== prevPrice) {
          cur.prev_price_minor = prevPrice;
        }
        cur.price_history = Array.isArray(cur.price_history) ? cur.price_history : [];
        if (clean.price_minor != null && clean.price_minor !== prevPrice) {
          cur.price_history.push({ price_minor: clean.price_minor, date: clean.checked_date || todayStr() });
        }
        Object.assign(cur, clean, { revision: cur.revision + 1 });
        resultOffer = cur;

        s.supplier_upload_logs.unshift({
          id: 'chg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          action: 'UPDATED',
          is_new_part: false,
          supplier_id: cur.supplier_id,
          supplier_name: targetSupObj.name || cur.supplier_id,
          offer_id: cur.id,
          part_db_id: cur.part_id,
          part_id: targetPartObj.exact_id || cur.part_id,
          description: targetPartObj.description || targetPartObj.exact_id || '',
          old_price_minor: prevPrice,
          new_price_minor: cur.price_minor,
          old_stock: prevStock,
          new_stock: cur.recorded_quantity,
          old_checked_date: prevDate,
          checked_date: cur.checked_date,
          file_name: 'Manual Offer Update',
          source_reference: cur.source_reference || 'Manual Update',
          uploaded_by: u.name,
          timestamp: nowIso
        });
      } else {
        const created = Object.assign({
          id: nextId(s, 'o'),
          revision: 1,
          synthetic: false,
          prev_price_minor: null,
          price_history: clean.price_minor != null ? [{ price_minor: clean.price_minor, date: clean.checked_date || todayStr() }] : []
        }, clean);
        s.offers.push(created);
        resultOffer = created;

        s.supplier_upload_logs.unshift({
          id: 'chg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          action: 'ADDED',
          is_new_part: !!o.is_new_part,
          supplier_id: created.supplier_id,
          supplier_name: targetSupObj.name || created.supplier_id,
          offer_id: created.id,
          part_db_id: created.part_id,
          part_id: targetPartObj.exact_id || created.part_id,
          description: targetPartObj.description || targetPartObj.exact_id || '',
          old_price_minor: null,
          new_price_minor: created.price_minor,
          old_stock: null,
          new_stock: created.recorded_quantity,
          checked_date: created.checked_date,
          file_name: 'Manual Catalog Entry',
          source_reference: created.source_reference || 'Manual Entry',
          uploaded_by: u.name,
          timestamp: nowIso
        });
      }
      if (s.supplier_upload_logs.length > 300) {
        s.supplier_upload_logs = s.supplier_upload_logs.slice(0, 300);
      }
      save(s);

      // Async sync to Supabase Cloud
      if (supabase) {
        (async () => {
          try {
            const sup = s.suppliers.find(x => x.id === resultOffer.supplier_id);
            const prt = s.parts.find(x => x.id === resultOffer.part_id);
            const supName = sup ? sup.name : (resultOffer.source || 'Direct Accredited Supplier');
            const exactPartId = prt ? prt.exact_id : resultOffer.part_id;

            const payload = {
              part_id: exactPartId,
              source: supName,
              price_minor: resultOffer.price_minor,
              qty: resultOffer.recorded_quantity || 0,
              checked_date: resultOffer.checked_date || new Date().toISOString().slice(0, 10),
              active: resultOffer.active !== false
            };

            const { data: existing } = await supabase.from('catalog_offers').select('id, part_id, source').eq('part_id', exactPartId);
            const match = (existing || []).find(e => (e.source || '').toLowerCase() === supName.toLowerCase());
            if (match) {
              await supabase.from('catalog_offers').update(payload).eq('id', match.id);
            } else {
              await supabase.from('catalog_offers').insert([payload]);
            }
          } catch (e) {
            console.warn('Supabase catalog_offers sync notice:', e);
          }
        })();
      }

      logAudit(o.id ? 'UPDATE_OFFER' : 'CREATE_OFFER', `Offer #${resultOffer.id}`, `${o.id ? 'Updated' : 'Created'} quote for part #${resultOffer.part_id}`, u);
      return resultOffer;
    }),

    deleteOffer: (id) => wrap(async () => {
      const s = load();
      const u = need(s, 'catalog');
      const off = (s.offers || []).find((o) => o.id === id);
      if (!off) throw fail(404, 'NOT_FOUND', 'Offer not found.');

      // Check referential integrity: is this offer locked in a frozen sourcing summary?
      const isLockedInSummary = (s.summaries || []).some((sum) => {
        return (sum.lines || []).some((l) => l.selected_offer_id === id);
      });

      if (isLockedInSummary) {
        // Protect historical audit trail: soft-deactivate instead of breaking foreign keys
        off.active = false;
        save(s);
        if (supabase) {
          try {
            await supabase.from('catalog_offers').update({ active: false }).eq('id', id);
          } catch (e) {}
        }
        logAudit('OFFER_DEACTIVATED', `Offer #${id}`, `Quotation is referenced in frozen job summary; marked Inactive to preserve audit integrity`, u);
        return { ok: true, softDeactivated: true, message: 'This quotation is locked in a historical frozen job summary. It has been marked Inactive instead of permanently deleted to preserve audit integrity.' };
      }

      // Safe to hard delete: Mistake or unreferenced test input
      s.offers = s.offers.filter((o) => o.id !== id);
      if (s.supplier_upload_logs) {
        s.supplier_upload_logs = s.supplier_upload_logs.filter((l) => l.offer_id !== id);
      }
      save(s);

      if (supabase) {
        try {
          await supabase.from('catalog_offers').delete().eq('id', id);
        } catch (e) {}
      }

      logAudit('OFFER_DELETED', `Offer #${id}`, `Permanently deleted quotation #${id} from catalog`, u);
      return { ok: true, deleted: true, id };
    }),

    bumpOfferForDemo: (offerId) => wrap(() => {
      const s = load();
      let o = s.offers.find((x) => x.id === offerId);
      if (!o && s.offers.length > 0) {
        o = s.offers[0];
      }
      if (o) {
        o.revision = (o.revision || 1) + 1;
        if (o.price_minor != null) {
          o.prev_price_minor = o.price_minor;
          o.price_minor += 2500; // bump by ₱25.00
          o.price_history = Array.isArray(o.price_history) ? o.price_history : [];
          o.price_history.push({ price_minor: o.price_minor, date: todayStr() });
        }
        save(s);
        const p = s.parts.find((x) => x.id === o.part_id);
        const sp = s.suppliers.find((x) => x.id === o.supplier_id);
        return {
          success: true,
          offerId: o.id,
          partName: p ? p.exact_id : o.part_id,
          supplierName: sp ? sp.name : (o.source || 'Supplier'),
          newPriceMinor: o.price_minor,
          revision: o.revision
        };
      }
      return { success: false };
    }),

    /* ---------- BULK CSV SUPPLIER CATALOG UPLOAD & UPSERT ---------- */
    bulkUpsertOffers: (items, fileName, options) => wrap(async () => {
      const s = load();
      const u = need(s, 'catalog');
      if (!Array.isArray(items) || !items.length) {
        throw fail(400, 'EMPTY_BATCH', 'No valid catalog items to import.');
      }

      const opts = options || {};
      const targetSup = opts.targetSupplierId
        ? (s.suppliers || []).find((sp) => sp.id === opts.targetSupplierId)
        : null;

      // Normalize rows when uploading on a dedicated supplier dashboard
      let effectiveItems = items.slice();
      if (targetSup) {
        if (opts.forceTargetSupplier !== false) {
          // If CSV contains duplicate part_ids from multiple suppliers, prefer the row matching targetSup first
          const byPart = new Map();
          for (const raw of effectiveItems) {
            const pKey = String(raw.part_id || '').trim().toLowerCase();
            if (!pKey) continue;
            const rawSrc = String(raw.source || '').trim().toLowerCase();
            const isTargetMatch = rawSrc === targetSup.name.toLowerCase() || rawSrc === targetSup.id.toLowerCase();
            if (!byPart.has(pKey) || isTargetMatch) {
              byPart.set(pKey, Object.assign({}, raw, { source: targetSup.name, _matchedTarget: isTargetMatch }));
            }
          }
          effectiveItems = Array.from(byPart.values());
        } else {
          effectiveItems = effectiveItems
            .filter((raw) => {
              const rawSrc = String(raw.source || '').trim().toLowerCase();
              return !rawSrc || rawSrc === targetSup.name.toLowerCase() || rawSrc === targetSup.id.toLowerCase();
            })
            .map((raw) => Object.assign({}, raw, { source: targetSup.name }));
        }
      }

      if (!effectiveItems.length) {
        throw fail(400, 'EMPTY_BATCH', targetSup
          ? `No rows matched supplier "${targetSup.name}" in the uploaded CSV.`
          : 'No valid catalog items to import.');
      }

      const today = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      let addedCount = 0;
      let updatedCount = 0;
      const updatedOffers = [];
      const addedDetails = [];
      const updatedDetails = [];

      for (const item of effectiveItems) {
        if (!item.part_id || !item.source) continue;

        const partIdTrimmed = String(item.part_id).trim();
        const sourceTrimmed = String(item.source).trim();
        const cleanPrice = parseFloat(String(item.unit_price).replace(/[^0-9.-]+/g, '')) || 0;
        const priceMinor = Number.isInteger(item.price_minor) ? item.price_minor : Math.round(cleanPrice * 100);
        const stockInt = parseInt(String(item.stock).replace(/[^0-9-]+/g, ''), 10) || 0;
        const attrSource = (item.attributed_source || '').trim() || fileName || 'Bulk CSV Upload';

        // 1. Ensure Part exists in s.parts
        let part = s.parts.find((p) => 
          (p.exact_id && p.exact_id.toLowerCase() === partIdTrimmed.toLowerCase()) || 
          (p.id && p.id.toLowerCase() === partIdTrimmed.toLowerCase())
        );
        let wasNewPart = false;
        if (!part) {
          wasNewPart = true;
          part = {
            id: nextId(s, 'p'),
            exact_id: partIdTrimmed,
            description: item.description || partIdTrimmed,
            unit: 'piece',
            active: true,
            category: item.category || 'General'
          };
          s.parts.push(part);
        } else if (item.description && (!part.description || part.description === part.exact_id)) {
          part.description = item.description;
        }

        // 2. Ensure Supplier exists in s.suppliers
        let sup = targetSup || s.suppliers.find((sp) => 
          (sp.name && sp.name.toLowerCase() === sourceTrimmed.toLowerCase()) || 
          (sp.id && sp.id.toLowerCase() === sourceTrimmed.toLowerCase())
        );
        if (!sup) {
          sup = {
            id: nextId(s, 's'),
            name: sourceTrimmed,
            location: 'Philippines',
            accredited: true
          };
          s.suppliers.push(sup);
        }

        // 3. Smart upsert matching on (part_id + supplier) case-insensitively
        const existingOffer = s.offers.find((o) => {
          const oPart = s.parts.find((p) => p.id === o.part_id);
          const oExactId = oPart ? oPart.exact_id : o.part_id;
          const oSup = s.suppliers.find((sp) => sp.id === o.supplier_id);
          const oSupName = oSup ? oSup.name : (o.source || o.supplier_id || '');
          return oExactId.toLowerCase() === partIdTrimmed.toLowerCase() &&
                 (o.supplier_id === sup.id || oSupName.toLowerCase() === sourceTrimmed.toLowerCase());
        });

        if (existingOffer) {
          const prevPrice = existingOffer.price_minor;
          const prevStock = existingOffer.recorded_quantity;
          const prevDate = existingOffer.checked_date;

          if (priceMinor != null && prevPrice != null && priceMinor !== prevPrice) {
            existingOffer.prev_price_minor = prevPrice;
          }
          existingOffer.price_history = Array.isArray(existingOffer.price_history) ? existingOffer.price_history : [];
          if (priceMinor != null && priceMinor !== prevPrice) {
            existingOffer.price_history.push({ price_minor: priceMinor, date: today });
          }

          existingOffer.price_minor = priceMinor;
          existingOffer.recorded_quantity = stockInt;
          existingOffer.qty = stockInt;
          existingOffer.checked_date = today;
          existingOffer.source_reference = attrSource;
          existingOffer.active = true;
          existingOffer.currency = 'PHP';
          existingOffer.price_basis = 'per_piece';
          existingOffer.revision = (existingOffer.revision || 1) + 1;
          if (item.description && part) {
            part.description = item.description;
          }
          updatedOffers.push(existingOffer);
          updatedCount++;

          updatedDetails.push({
            id: 'chg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            action: 'UPDATED',
            is_new_part: false,
            supplier_id: sup.id,
            supplier_name: sup.name,
            offer_id: existingOffer.id,
            part_db_id: part.id,
            part_id: part.exact_id,
            description: part.description || part.exact_id,
            old_price_minor: prevPrice,
            new_price_minor: priceMinor,
            old_stock: prevStock,
            new_stock: stockInt,
            old_checked_date: prevDate,
            checked_date: today,
            file_name: fileName || 'supplier_catalog.csv',
            source_reference: attrSource,
            uploaded_by: u.name,
            timestamp: nowIso
          });
        } else {
          const newOffer = {
            id: nextId(s, 'o'),
            part_id: part.id,
            supplier_id: sup.id,
            source: sup.name,
            price_minor: priceMinor,
            currency: 'PHP',
            price_basis: 'per_piece',
            recorded_quantity: stockInt,
            qty: stockInt,
            checked_date: today,
            source_reference: attrSource,
            active: true,
            is_active: true,
            revision: 1,
            synthetic: false
          };
          s.offers.push(newOffer);
          updatedOffers.push(newOffer);
          addedCount++;

          addedDetails.push({
            id: 'chg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            action: 'ADDED',
            is_new_part: wasNewPart,
            supplier_id: sup.id,
            supplier_name: sup.name,
            offer_id: newOffer.id,
            part_db_id: part.id,
            part_id: part.exact_id,
            description: part.description || part.exact_id,
            old_price_minor: null,
            new_price_minor: priceMinor,
            old_stock: null,
            new_stock: stockInt,
            checked_date: today,
            file_name: fileName || 'supplier_catalog.csv',
            source_reference: attrSource,
            uploaded_by: u.name,
            timestamp: nowIso
          });
        }
      }

      if (!Array.isArray(s.supplier_upload_logs)) s.supplier_upload_logs = [];
      const newLogs = addedDetails.concat(updatedDetails);
      s.supplier_upload_logs = newLogs.concat(s.supplier_upload_logs).slice(0, 300);

      save(s);

      // 4. Supabase Synchronization
      if (supabase) {
        try {
          const { data: cloudOffers } = await supabase.from('catalog_offers').select('id, part_id, source');
          for (const item of effectiveItems) {
            const partIdTrimmed = String(item.part_id).trim();
            const sourceTrimmed = String(item.source).trim();
            const cleanPrice = parseFloat(String(item.unit_price).replace(/[^0-9.-]+/g, '')) || 0;
            const priceMinor = Number.isInteger(item.price_minor) ? item.price_minor : Math.round(cleanPrice * 100);
            const stockInt = parseInt(String(item.stock).replace(/[^0-9-]+/g, ''), 10) || 0;

            const payload = {
              part_id: partIdTrimmed,
              source: sourceTrimmed,
              price_minor: priceMinor,
              qty: stockInt,
              checked_date: today,
              active: true
            };

            const existingCloud = (cloudOffers || []).find((co) => 
              co.part_id && co.part_id.toLowerCase() === partIdTrimmed.toLowerCase() &&
              co.source && co.source.toLowerCase() === sourceTrimmed.toLowerCase()
            );

            if (existingCloud) {
              await supabase.from('catalog_offers').update(payload).eq('id', existingCloud.id);
            } else {
              await supabase.from('catalog_offers').insert([payload]);
            }
          }
        } catch (cloudErr) {
          console.warn('Supabase bulk upsert notice:', cloudErr);
        }
      }

      // 5. Audit Logging
      logAudit(
        'CATALOG_CSV_UPLOAD',
        targetSup ? `Supplier: ${targetSup.name}` : 'Catalog Offers',
        `Bulk CSV Upload (${fileName || 'supplier_catalog.csv'}): ${addedCount} added, ${updatedCount} updated (${effectiveItems.length} total rows processed)`,
        u
      );

      return {
        success: true,
        addedCount,
        updatedCount,
        totalProcessed: effectiveItems.length,
        fileName: fileName || 'supplier_catalog.csv',
        affectedOfferIds: updatedOffers.map(o => o.id),
        addedOfferIds: addedDetails.map(x => x.offer_id),
        updatedOfferIds: updatedDetails.map(x => x.offer_id),
        addedItems: addedDetails,
        updatedItems: updatedDetails
      };
    }),

    listSupplierUploadLogs: (supplierId) => wrap(() => {
      const s = load();
      need(s, 'catalog');
      const logs = Array.isArray(s.supplier_upload_logs) ? s.supplier_upload_logs : [];
      if (supplierId && supplierId !== 'ALL') {
        return logs.filter((x) => x.supplier_id === supplierId);
      }
      return logs;
    }),

    clearSupplierUploadLogs: (supplierId) => wrap(() => {
      const s = load();
      const u = need(s, 'catalog');
      if (supplierId && supplierId !== 'ALL') {
        s.supplier_upload_logs = (s.supplier_upload_logs || []).filter((x) => x.supplier_id !== supplierId);
      } else {
        s.supplier_upload_logs = [];
      }
      save(s);
      logAudit('CLEAR_SUPPLIER_LOGS', supplierId || 'ALL', 'Cleared supplier material upload & addition log', u);
      return { ok: true };
    }),

    /* ---------- BOM LISTS & WORKSPACES ---------- */
    listLists: () => wrap(() => { 
      const s = load(); 
      const u = need(s, 'lists'); 
      if (u.role === 'administrator' || u.role === 'admin') return s.lists;
      return s.lists.filter((l) => l.owner_id === u.id); 
    }),

    getList: (id) => wrap(() => { 
      const s = load(); 
      const u = need(s, 'lists'); 
      return ownList(s, u, id); 
    }),

    createList: (title) => wrap(() => {
      const s = load();
      const u = need(s, 'lists');
      if (!(title || '').trim()) {
        throw fail(422, 'INVALID_INPUT', 'Title is required.', { title: 'Enter a project title.' });
      }
      const l = { 
        id: nextId(s, 'l'), 
        owner_id: u.id, 
        title: title.trim(), 
        revision: 1, 
        archived: false, 
        lines: [] 
      };
      s.lists.push(l);
      save(s);
      logAudit('CREATE_BOM_LIST', `BOM #${l.id}`, `Created new parts list "${l.title}"`, u);
      return l;
    }),

    updateList: (id, revision, title, lines, archived) => wrap(() => {
      const s = load();
      const u = need(s, 'lists');
      const l = ownList(s, u, id);
      if (l.revision !== revision) {
        throw fail(409, 'REVISION_CONFLICT', 'This list was changed by another session. Reload to see latest version.');
      }
      const fe = validateLines(s, lines);
      const te = (title || '').trim() ? null : 'Enter a project title.';
      if (te || Object.keys(fe).length) {
        throw fail(422, 'INVALID_INPUT', 'Please fix highlighted line fields.', { title: te, lines: fe });
      }
      l.title = title.trim();
      l.archived = !!archived;
      l.lines = lines.map((ln) => ({ 
        id: ln.id || nextId(s, 'ln'), 
        part_id: ln.part_id, 
        quantity: ln.quantity 
      }));
      l.revision += 1;
      save(s);

      // Async sync to Supabase Cloud
      if (supabase && l.lines.length > 0) {
        (async () => {
          try {
            const bomRows = l.lines.map(ln => {
              const p = s.parts.find(x => x.id === ln.part_id);
              return {
                list_id: l.id,
                part_id: p ? p.exact_id : ln.part_id,
                name: p ? p.description : ln.part_id,
                qty: ln.quantity,
                quantity: ln.quantity,
                updated_at: new Date().toISOString()
              };
            });
            await supabase.from('bom_items').insert(bomRows);
          } catch (e) {}
        })();
      }

      logAudit('UPDATE_BOM_LIST', `BOM #${l.id}`, `Saved changes to "${l.title}" (${l.lines.length} lines, Rev ${l.revision})`, u);
      return l;
    }),

    deleteList: (id) => wrap(async () => {
      const s = load();
      const u = need(s, 'lists');
      const idx = (s.lists || []).findIndex((l) => l.id === id);
      if (idx === -1) throw fail(404, 'NOT_FOUND', 'BOM list not found.');
      const l = s.lists[idx];
      if (u.role !== 'administrator' && u.role !== 'admin' && l.owner_id !== u.id) {
        throw fail(403, 'FORBIDDEN', 'Access denied to delete this list.');
      }

      s.lists.splice(idx, 1);
      save(s);

      if (supabase) {
        try {
          await supabase.from('bom_items').delete().eq('list_id', id);
        } catch (e) {}
      }

      logAudit('LIST_DELETED', `List #${id}`, `Permanently deleted BOM list "${l.title}"`, u);
      return { ok: true, id, title: l.title };
    }),

    compare: (listId, selections) => wrap(() => {
      const s = load();
      const u = need(s, 'lists');
      const l = ownList(s, u, listId);
      return buildComparison(s, l, selections || {});
    }),

    saveSummary: (listId, payload) => wrap(() => {
      const s = load();
      const u = need(s, 'lists');
      const l = ownList(s, u, listId);
      
      const dup = s.summaries.find((x) => x.owner_id === u.id && x.save_token === payload.save_token);
      if (dup) return dup;

      const result = buildComparison(s, l, payload.selections || {});
      if (payload.list_revision !== result.list_revision || 
          payload.policy_version !== result.policy_version || 
          payload.review_fingerprint !== result.review_fingerprint) {
        throw fail(409, 'INPUT_CHANGED', 'Catalog, list, or policy rules changed since your review. Sourcing summary was not saved.');
      }

      let aiExplanation = '';
      if (window.PC_AI && typeof window.PC_AI.generateExecutiveSummary === 'function') {
        aiExplanation = window.PC_AI.generateExecutiveSummary(result, l.title, s.company_settings);
      }

      const sm = {
        id: nextId(s, 'sm'),
        owner_id: u.id,
        author_name: u.name,
        list_id: l.id,
        title: l.title,
        created_at: new Date().toISOString(),
        save_token: payload.save_token,
        status: result.summary.status,
        approval_status: 'PENDING_APPROVAL',
        approved_by: null,
        approved_at: null,
        approval_notes: null,
        comparison: result,
        ai_executive_summary: aiExplanation,
      };

      s.summaries.push(sm);
      save(s);

      // Async sync frozen snapshot to Supabase Cloud
      if (supabase) {
        (async () => {
          try {
            await supabase.from('sourcing_summaries').insert([{
              id: sm.id,
              save_token: sm.save_token,
              name: sm.title || sm.name || 'Job Sourcing Decision',
              author_name: sm.author_name,
              saved_date: sm.saved_date,
              subtotal_minor: result.summary.subtotal_minor,
              status: result.summary.status,
              approval_status: sm.approval_status,
              approved_by: sm.approved_by,
              approved_at: sm.approved_at,
              total_lines: sm.total_lines,
              resolved_count: sm.resolved_count,
              unresolved_count: sm.unresolved_count,
              ai_executive_summary: sm.ai_executive_summary,
              drift_notice: sm.drift_notice || 'Original calculation snapshot.',
              lines: sm.lines || [],
              created_at: sm.created_at || new Date().toISOString()
            }]);
          } catch (e) {}
        })();
      }

      logAudit('SUMMARY_SAVE', `Sourcing Decision #${sm.id}`, `Preserved job estimate (${sm.status}, ₱${(result.summary.subtotal_minor / 100).toFixed(2)}) - Awaiting Admin Sign-Off`, u);
      return sm;
    }),

    listSummaries: () => wrap(() => {
      const s = load();
      const u = need(s, 'summaries');
      const filtered = (u.role === 'administrator' || u.role === 'admin') 
        ? s.summaries 
        : s.summaries.filter((x) => x.owner_id === u.id);

      return filtered
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((x) => ({
          id: x.id,
          title: x.title,
          created_at: x.created_at,
          status: x.status,
          approval_status: x.approval_status || (x.approved_by ? 'APPROVED' : 'PENDING_APPROVAL'),
          approved_by: x.approved_by || null,
          approved_at: x.approved_at || null,
          approval_notes: x.approval_notes || null,
          subtotal_minor: x.comparison.summary.subtotal_minor,
          unresolved_count: x.comparison.summary.unresolved_count,
          currency: x.comparison.currency,
          author_name: x.author_name || 'BOM Preparer'
        }));
    }),

    getSummary: (id) => wrap(() => {
      const s = load();
      const u = need(s, 'summaries');
      const x = s.summaries.find((y) => y.id === id);
      if (!x) throw fail(404, 'NOT_FOUND', 'Sourcing summary not found.');
      if (u.role !== 'administrator' && u.role !== 'admin' && x.owner_id !== u.id) {
        throw fail(403, 'FORBIDDEN', 'Access denied to this summary.');
      }
      if (!x.approval_status) {
        x.approval_status = x.approved_by ? 'APPROVED' : 'PENDING_APPROVAL';
      }
      return x;
    }),

    deleteSummary: (id) => wrap(async () => {
      const s = load();
      const u = need(s, 'summaries');
      const idx = (s.summaries || []).findIndex((y) => y.id === id);
      if (idx === -1) throw fail(404, 'NOT_FOUND', 'Sourcing summary not found.');
      const x = s.summaries[idx];
      if (u.role !== 'administrator' && u.role !== 'admin' && x.owner_id !== u.id) {
        throw fail(403, 'FORBIDDEN', 'Access denied to delete this summary.');
      }

      s.summaries.splice(idx, 1);
      save(s);

      if (supabase) {
        try {
          await supabase.from('sourcing_summaries').delete().eq('id', id);
        } catch (e) {}
      }

      logAudit('SUMMARY_DELETED', `Summary #${id}`, `Permanently deleted sourcing summary "${x.title || id}"`, u);
      return { ok: true, id, title: x.title };
    }),

    approveSummary: (id, notes) => wrap(async () => {
      const s = load();
      const u = need(s, 'admin');
      const sm = (s.summaries || []).find((x) => x.id === id);
      if (!sm) throw fail(404, 'NOT_FOUND', 'Sourcing summary not found.');

      sm.approval_status = 'APPROVED';
      sm.approved_by = u.name;
      sm.approved_at = new Date().toISOString();
      sm.approval_notes = (notes || '').trim() || 'Sourcing job sheet reviewed and officially authorized for purchase order dispatch.';
      save(s);

      if (supabase) {
        try {
          await supabase.from('sourcing_summaries').update({
            approval_status: 'APPROVED',
            approved_by: sm.approved_by,
            approved_at: sm.approved_at,
            approval_notes: sm.approval_notes
          }).eq('id', id);
        } catch (e) {}
      }

      logAudit('SUMMARY_APPROVED', `Summary #${id}`, `Administrator ${u.name} acknowledged and authorized job sheet for "${sm.title}" (Token: ${sm.save_token})`, u);
      return { ok: true, summary: sm };
    }),

    revokeSummaryApproval: (id, reason) => wrap(async () => {
      const s = load();
      const u = need(s, 'admin');
      const sm = (s.summaries || []).find((x) => x.id === id);
      if (!sm) throw fail(404, 'NOT_FOUND', 'Sourcing summary not found.');

      sm.approval_status = 'PENDING_APPROVAL';
      sm.approved_by = null;
      sm.approved_at = null;
      sm.approval_notes = (reason || '').trim() || 'Approval revoked by administrator for re-evaluation.';
      save(s);

      if (supabase) {
        try {
          await supabase.from('sourcing_summaries').update({
            approval_status: 'PENDING_APPROVAL',
            approved_by: null,
            approved_at: null,
            approval_notes: sm.approval_notes
          }).eq('id', id);
        } catch (e) {}
      }

      logAudit('SUMMARY_APPROVAL_REVOKED', `Summary #${id}`, `Administrator ${u.name} revoked authorization for summary "${sm.title}"`, u);
      return { ok: true, summary: sm };
    }),

    /* ---------- PURCHASE ORDERS & DELIVERY TRACKING API ---------- */
    poStatuses: () => PO_STATUSES.slice(),
    poTransitions: (status) => (PO_TRANSITIONS[status] || []).slice(),

    listPurchaseOrders: () => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      const all = s.purchase_orders || [];
      const visible = canSeeAllOrders(u) ? all : all.filter((x) => x.owner_id === u.id);
      return JSON.parse(JSON.stringify(visible))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }),

    getPurchaseOrder: (id) => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      return JSON.parse(JSON.stringify(getPO(s, u, id)));
    }),

    listPurchaseOrdersForSummary: (summaryId) => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      return (s.purchase_orders || [])
        .filter((x) => x.summary_id === summaryId && (canSeeAllOrders(u) || x.owner_id === u.id))
        .map((x) => ({ id: x.id, po_number: x.po_number, supplier_name: x.supplier_name, status: x.status, subtotal_minor: x.subtotal_minor, currency: x.currency }));
    }),

    /**
     * Generates one DRAFT purchase order per supplier from an APPROVED, frozen sourcing summary.
     * Unresolved lines are never ordered. Suppliers that already have an active PO for the
     * same summary are skipped to prevent duplicate ordering.
     */
    createPurchaseOrdersFromSummary: (summaryId, opts = {}) => wrap(() => {
      const s = load();
      const u = need(s, 'summaries');
      const sm = (s.summaries || []).find((x) => x.id === summaryId);
      if (!sm) throw fail(404, 'NOT_FOUND', 'Sourcing summary not found.');
      if (!isAdminRole(u) && sm.owner_id !== u.id) throw fail(403, 'FORBIDDEN', 'Access denied to this summary.');
      const approval = sm.approval_status || (sm.approved_by ? 'APPROVED' : 'PENDING_APPROVAL');
      if (approval !== 'APPROVED') {
        throw fail(409, 'NOT_APPROVED', 'Purchase orders can only be generated from a sourcing summary approved by an Administrator.');
      }

      const r = sm.comparison;
      const groups = {};
      let skippedUnresolved = 0;
      r.lines.forEach((l) => {
        const sel = l.candidates.find((c) => c.offer_id === l.selected_offer_id);
        if (!sel) { skippedUnresolved++; return; }
        const key = sel.supplier_id || sel.supplier_name;
        if (!groups[key]) groups[key] = { supplier_id: sel.supplier_id, supplier_name: sel.supplier_name, currency: sel.currency || r.currency, lines: [] };
        groups[key].lines.push({
          line_id: 'pol-' + l.line_id,
          bom_line_id: l.line_id,
          part_id: l.part_id,
          exact_id: l.exact_id,
          description: l.description,
          quantity: l.quantity,
          unit_price_minor: sel.price_minor,
          line_total_minor: sel.price_minor * l.quantity,
          offer_id: sel.offer_id,
          source_reference: sel.source_reference,
          received_qty: 0,
        });
      });

      const active = (s.purchase_orders || []).filter((p) => p.summary_id === sm.id && p.status !== 'CANCELLED');
      const created = [];
      const skippedSuppliers = [];
      s.counters = s.counters || {};
      const year = new Date().getFullYear();
      const sup = (id) => (s.suppliers || []).find((x) => x.id === id) || {};

      Object.values(groups).forEach((g) => {
        if (active.some((p) => (p.supplier_id || p.supplier_name) === (g.supplier_id || g.supplier_name))) {
          skippedSuppliers.push(g.supplier_name);
          return;
        }
        s.counters.po = (s.counters.po || 0) + 1;
        const now = new Date().toISOString();
        const po = {
          id: nextId(s, 'po'),
          po_number: 'PO-' + year + '-' + String(s.counters.po).padStart(4, '0'),
          summary_id: sm.id,
          summary_title: sm.title,
          snapshot_token: sm.save_token,
          owner_id: sm.owner_id,
          created_by: u.name,
          created_at: now,
          updated_at: now,
          supplier_id: g.supplier_id,
          supplier_name: g.supplier_name,
          supplier_location: sup(g.supplier_id).location || '',
          supplier_contact: sup(g.supplier_id).contact || '',
          currency: g.currency || 'PHP',
          status: 'DRAFT',
          expected_date: opts.expected_date || null,
          payment_terms: opts.payment_terms || '30 days upon delivery',
          delivery_address: opts.delivery_address || (s.company_settings && s.company_settings.location) || '',
          notes: opts.notes || '',
          courier: '',
          tracking_ref: '',
          lines: g.lines,
          subtotal_minor: g.lines.reduce((a, l) => a + l.line_total_minor, 0),
          revision: 1,
          history: [],
        };
        pushPOHistory(po, u, 'DRAFT', 'CREATED', 'Generated from approved sourcing summary "' + sm.title + '" (' + g.lines.length + ' line(s)).');
        po.revision = 1;
        s.purchase_orders.push(po);
        created.push(po);
      });

      save(s);
      created.forEach(syncPurchaseOrder);
      if (created.length) {
        logAudit('PO_CREATED', `Summary #${sm.id}`, `Generated ${created.length} draft purchase order(s): ${created.map((p) => p.po_number + ' → ' + p.supplier_name).join(', ')}`, u);
      }
      return { created: JSON.parse(JSON.stringify(created)), skipped_suppliers: skippedSuppliers, skipped_unresolved: skippedUnresolved };
    }),

    /**
     * Creates a standalone DRAFT purchase order directly from selected supplier + catalog lines.
     */
    createDirectPurchaseOrder: (payload = {}) => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      const sup = (s.suppliers || []).find((x) => x.id === payload.supplier_id);
      if (!sup) throw fail(422, 'INVALID_INPUT', 'Please select an accredited supplier.');
      const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
      if (!rawLines.length) throw fail(422, 'INVALID_INPUT', 'Add at least one component line to the purchase order.');

      const builtLines = [];
      rawLines.forEach((ln, idx) => {
        const part = (s.parts || []).find((p) => p.id === ln.part_id);
        if (!part) throw fail(422, 'INVALID_INPUT', `Line ${idx + 1}: Select a valid catalog component.`);
        const qty = Number(ln.quantity);
        if (!Number.isInteger(qty) || qty < 1) throw fail(422, 'INVALID_INPUT', `Line ${idx + 1} (${part.exact_id}): Quantity must be a whole number ≥ 1.`);

        // Resolve price from explicit input or supplier's active catalog offer
        let unitPriceMinor = ln.unit_price_minor != null ? Number(ln.unit_price_minor) : null;
        const supOffer = (s.offers || []).find((o) => o.part_id === part.id && o.supplier_id === sup.id && o.active && o.price_minor != null);
        if (unitPriceMinor == null || isNaN(unitPriceMinor) || unitPriceMinor <= 0) {
          if (supOffer) unitPriceMinor = supOffer.price_minor;
        }
        if (!unitPriceMinor || unitPriceMinor <= 0) {
          throw fail(422, 'INVALID_INPUT', `Line ${idx + 1} (${part.exact_id}): Enter a valid unit price or choose a supplier with an active quote.`);
        }

        builtLines.push({
          line_id: 'pol-' + Date.now() + '-' + (idx + 1),
          bom_line_id: 'direct-' + (idx + 1),
          part_id: part.id,
          exact_id: part.exact_id,
          description: part.description,
          quantity: qty,
          unit_price_minor: Math.round(unitPriceMinor),
          line_total_minor: Math.round(unitPriceMinor) * qty,
          offer_id: supOffer ? supOffer.id : null,
          source_reference: supOffer ? supOffer.source_reference : 'Direct PO Entry',
          received_qty: 0,
          receipts: []
        });
      });

      s.counters = s.counters || {};
      s.counters.po = (s.counters.po || 80) + 1;
      const year = new Date().getFullYear();
      const now = new Date().toISOString();
      const jobTitle = (payload.summary_title || '').trim() || 'Direct Component Purchase Order';
      const po = {
        id: nextId(s, 'po'),
        po_number: 'PO-' + year + '-' + String(s.counters.po).padStart(4, '0'),
        summary_id: payload.summary_id || ('direct-' + Date.now()),
        summary_title: jobTitle,
        snapshot_token: 'tok-direct-' + Date.now().toString(36),
        owner_id: u.id,
        created_by: u.name,
        created_at: now,
        updated_at: now,
        supplier_id: sup.id,
        supplier_name: sup.name,
        supplier_location: sup.location || '',
        supplier_contact: sup.contact || '',
        currency: (s.company_settings && s.company_settings.currency_code) || 'PHP',
        status: 'DRAFT',
        expected_date: payload.expected_date || null,
        payment_terms: (payload.payment_terms || '').trim() || '30 days upon delivery',
        delivery_address: (payload.delivery_address || '').trim() || (s.company_settings && s.company_settings.location) || '',
        notes: (payload.notes || '').trim(),
        courier: (payload.courier || '').trim(),
        tracking_ref: (payload.tracking_ref || '').trim(),
        lines: builtLines,
        subtotal_minor: builtLines.reduce((a, l) => a + l.line_total_minor, 0),
        revision: 1,
        history: []
      };
      pushPOHistory(po, u, 'DRAFT', 'CREATED', `Created purchase order for "${jobTitle}" (${builtLines.length} line(s)).`);
      po.revision = 1;
      s.purchase_orders.push(po);
      save(s);
      syncPurchaseOrder(po);
      logAudit('PO_CREATED', po.po_number, `Created direct purchase order ${po.po_number} for ${sup.name} (₱${(po.subtotal_minor / 100).toFixed(2)})`, u);
      return JSON.parse(JSON.stringify(po));
    }),

    updatePurchaseOrderDetails: (id, revision, fields = {}) => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      const po = getPO(s, u, id);
      if (revision != null && po.revision !== revision) throw fail(409, 'STALE_REVISION', 'This purchase order was changed by someone else. Reload and try again.');
      if (['CLOSED', 'CANCELLED'].includes(po.status)) throw fail(409, 'LOCKED', 'Closed or cancelled purchase orders cannot be edited.');

      const fe = {};
      if (fields.expected_date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.expected_date)) fe.expected_date = 'Use a valid date (YYYY-MM-DD).';
      if (Object.keys(fe).length) throw fail(422, 'INVALID_INPUT', 'Please correct the highlighted fields.', fe);

      // Commercial terms are frozen once the PO is issued to the supplier
      const draftOnly = ['payment_terms', 'delivery_address', 'notes'];
      const always = ['expected_date', 'courier', 'tracking_ref'];
      const changed = [];
      always.concat(po.status === 'DRAFT' ? draftOnly : []).forEach((k) => {
        if (fields[k] === undefined) return;
        const v = String(fields[k] || '').trim();
        if ((po[k] || '') !== v) { po[k] = v || (k === 'expected_date' ? null : ''); changed.push(k.replace('_', ' ')); }
      });
      if (!changed.length) return JSON.parse(JSON.stringify(po));
      pushPOHistory(po, u, po.status, 'DETAILS_UPDATED', 'Updated ' + changed.join(', ') + (po.tracking_ref ? ' · Tracking: ' + (po.courier ? po.courier + ' ' : '') + po.tracking_ref : ''));
      save(s);
      syncPurchaseOrder(po);
      logAudit('PO_UPDATED', po.po_number, 'Updated ' + changed.join(', '), u);
      return JSON.parse(JSON.stringify(po));
    }),

    setPurchaseOrderStatus: (id, revision, nextStatus, note) => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      const po = getPO(s, u, id);
      if (revision != null && po.revision !== revision) throw fail(409, 'STALE_REVISION', 'This purchase order was changed by someone else. Reload and try again.');
      const allowed = PO_TRANSITIONS[po.status] || [];
      if (!allowed.includes(nextStatus)) throw fail(409, 'INVALID_TRANSITION', `Cannot move a ${po.status} purchase order to ${nextStatus}.`);

      // Maker-checker: only administrators release (issue) and close purchase orders
      if ((nextStatus === 'ISSUED' || nextStatus === 'CLOSED') && !isAdminRole(u)) {
        throw fail(403, 'FORBIDDEN', 'Only an Administrator can ' + (nextStatus === 'ISSUED' ? 'issue a purchase order to the supplier.' : 'close a purchase order.'));
      }
      if (nextStatus === 'CANCELLED') {
        if (poTotals(po).received > 0) throw fail(409, 'HAS_RECEIPTS', 'Parts were already received against this PO; it cannot be cancelled.');
        if (!isAdminRole(u) && !(po.status === 'DRAFT' && po.owner_id === u.id)) {
          throw fail(403, 'FORBIDDEN', 'Only an Administrator can cancel an issued purchase order.');
        }
        if (!(note || '').trim()) throw fail(422, 'INVALID_INPUT', 'A cancellation reason is required.', { note: 'Please give a reason.' });
      }

      const prev = po.status;
      po.status = nextStatus;
      if (nextStatus === 'ISSUED') { po.issued_at = new Date().toISOString(); po.issued_by = u.name; }
      pushPOHistory(po, u, nextStatus, 'STATUS_CHANGE', note || (prev + ' → ' + nextStatus));
      save(s);
      syncPurchaseOrder(po);
      logAudit('PO_STATUS', po.po_number, `${prev} → ${nextStatus}${note ? ' (' + note + ')' : ''}`, u);
      return JSON.parse(JSON.stringify(po));
    }),

    /**
     * Records a goods receipt and/or RTV damaged goods rejection.
     * receipts = { [line_id]: qtyGoodReceivedNow }
     * rejects  = { [line_id]: qtyDamagedRejectedNow }
     * Good items increment AMGC internal warehouse stock; rejected items log an RTV claim
     * and remain outstanding until replacement arrives.
     */
    receivePurchaseOrderItems: (id, revision, receipts = {}, note, rejects = {}) => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      const po = getPO(s, u, id);
      if (revision != null && po.revision !== revision) throw fail(409, 'STALE_REVISION', 'This purchase order was changed by someone else. Reload and try again.');
      if (!PO_RECEIVABLE.includes(po.status)) throw fail(409, 'NOT_RECEIVABLE', `Deliveries cannot be recorded against a ${po.status} purchase order.`);

      const fe = {};
      let anyGood = 0;
      let anyRej = 0;
      const goodParts = [];
      const rejParts = [];

      po.lines.forEach((l) => {
        const rawGood = receipts && receipts[l.line_id];
        const rawRej = rejects && rejects[l.line_id];
        const qGood = (rawGood == null || rawGood === '') ? 0 : Number(rawGood);
        const qRej = (rawRej == null || rawRej === '') ? 0 : Number(rawRej);
        const remaining = l.quantity - (l.received_qty || 0);

        if ((!Number.isInteger(qGood) || qGood < 0) || (!Number.isInteger(qRej) || qRej < 0)) {
          fe[l.line_id] = 'Enter a whole number.';
        } else if (qGood > remaining) {
          fe[l.line_id] = 'Only ' + remaining + ' outstanding.';
        } else if (qGood + qRej > remaining && qRej > 0 && qGood > 0) {
          fe[l.line_id] = 'Good + rejected (' + (qGood + qRej) + ') exceeds ' + remaining + ' outstanding.';
        } else {
          if (qGood > 0) { anyGood += qGood; goodParts.push(l.exact_id + ' ×' + qGood); }
          if (qRej > 0) { anyRej += qRej; rejParts.push(l.exact_id + ' ×' + qRej); }
        }
      });
      if (Object.keys(fe).length) throw fail(422, 'INVALID_INPUT', 'Please correct the received quantities.', fe);
      if (!anyGood && !anyRej) throw fail(422, 'INVALID_INPUT', 'Enter at least one received or rejected quantity.');

      const at = new Date().toISOString();
      s.warehouse_logs = Array.isArray(s.warehouse_logs) ? s.warehouse_logs : [];
      s.counters = s.counters || {};

      po.lines.forEach((l) => {
        const qGood = Number((receipts && receipts[l.line_id]) || 0);
        const qRej = Number((rejects && rejects[l.line_id]) || 0);
        if (qGood > 0) {
          l.received_qty = (l.received_qty || 0) + qGood;
          l.receipts = l.receipts || [];
          l.receipts.push({ at, qty: qGood, by: u.name, note: (note || '').trim() || null });
          if (l.received_qty >= l.quantity) {
            l.received_at = at;
            if (Array.isArray(l.rtv_claims)) {
              l.rtv_claims.forEach((c) => { if (c.status === 'OPEN') c.status = 'REPLACED'; });
            }
          }
          // Auto-increment AMGC Cainta warehouse stock
          const partObj = (s.parts || []).find((p) => p.id === l.part_id || p.exact_id === l.exact_id);
          if (partObj) {
            const prevWh = Number(partObj.warehouse_stock || 0);
            partObj.warehouse_stock = prevWh + qGood;
            s.warehouse_logs.unshift({
              id: 'wh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              at,
              part_id: partObj.id,
              exact_id: partObj.exact_id,
              delta: qGood,
              new_stock: partObj.warehouse_stock,
              reason: `PO Receipt ${po.po_number} (${po.supplier_name})`,
              by: u.name
            });
          }
        }
        if (qRej > 0) {
          l.rejected_qty = (l.rejected_qty || 0) + qRej;
          l.rtv_claims = Array.isArray(l.rtv_claims) ? l.rtv_claims : [];
          s.counters.rtv = (s.counters.rtv || 1) + 1;
          const rtvId = 'RTV-' + new Date().getFullYear() + '-' + String(s.counters.rtv).padStart(2, '0');
          l.rtv_claims.push({
            id: rtvId,
            at,
            qty: qRej,
            reason: (note || '').trim() || 'Damaged / defective on delivery — replacement requested from supplier',
            by: u.name,
            status: 'OPEN'
          });
        }
      });

      const t = poTotals(po);
      if (anyGood > 0) {
        po.status = t.outstanding === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
        if (po.status === 'RECEIVED') po.received_at = at;
      }
      const msgSegments = [];
      if (goodParts.length) msgSegments.push('Received ' + goodParts.join(', ') + ' (+added to Cainta warehouse stock)');
      if (rejParts.length) msgSegments.push('⚠️ RTV Rejected/Damaged: ' + rejParts.join(', '));
      const fullNote = msgSegments.join(' · ') + (note ? ' — ' + note : '') + ' (' + t.received + '/' + t.ordered + ' pcs accepted)';

      pushPOHistory(po, u, po.status, anyRej > 0 && !anyGood ? 'RTV_CLAIM' : 'GOODS_RECEIVED', fullNote);
      save(s);
      syncPurchaseOrder(po);
      logAudit(anyRej > 0 ? 'PO_RTV_CLAIM' : 'PO_RECEIVED', po.po_number, fullNote, u);
      return JSON.parse(JSON.stringify(po));
    }),

    /* ---------- AMGC WAREHOUSE INVENTORY & LOW-STOCK REORDER API ---------- */
    listWarehouseInventory: () => wrap(() => {
      const s = load();
      need(s, 'orders');
      const openStatuses = ['DRAFT', 'ISSUED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'];
      const openPos = (s.purchase_orders || []).filter((p) => openStatuses.includes(p.status));

      const items = (s.parts || []).filter((p) => p.active !== false).map((p) => {
        const incoming = openPos.reduce((sum, po) => {
          return sum + (po.lines || [])
            .filter((l) => l.part_id === p.id || l.exact_id === p.exact_id)
            .reduce((ls, l) => ls + Math.max(0, l.quantity - (l.received_qty || 0)), 0);
        }, 0);
        const activeOffers = (s.offers || []).filter((o) => o.part_id === p.id && o.active && o.price_minor != null);
        activeOffers.sort((a, b) => a.price_minor - b.price_minor);
        const bestOff = activeOffers[0] || null;
        const bestSup = bestOff ? (s.suppliers || []).find((sp) => sp.id === bestOff.supplier_id) : null;
        const stock = Number(p.warehouse_stock != null ? p.warehouse_stock : 0);
        const minLevel = Number(p.min_reorder_level != null ? p.min_reorder_level : 5);
        return {
          part_id: p.id,
          exact_id: p.exact_id,
          description: p.description,
          category: p.category || 'HVAC Component',
          warehouse_stock: stock,
          min_reorder_level: minLevel,
          incoming_qty: incoming,
          is_low_stock: stock <= minLevel,
          is_out_of_stock: stock === 0,
          recommended_reorder_qty: Math.max(minLevel * 2 - stock, minLevel),
          best_supplier_id: bestOff ? bestOff.supplier_id : 's1',
          best_supplier_name: bestSup ? bestSup.name : 'Everwell Parts & Equipment Corp.',
          best_price_minor: bestOff ? bestOff.price_minor : null
        };
      });

      return {
        items,
        logs: JSON.parse(JSON.stringify((s.warehouse_logs || []).slice(0, 30)))
      };
    }),

    adjustWarehouseStock: (partId, newStock, minReorderLevel, reason) => wrap(() => {
      const s = load();
      const u = need(s, 'orders');
      const p = (s.parts || []).find((x) => x.id === partId || x.exact_id === partId);
      if (!p) throw fail(404, 'NOT_FOUND', 'Component not found.');
      const nextStock = Number(newStock);
      const nextMin = minReorderLevel != null ? Number(minReorderLevel) : Number(p.min_reorder_level || 5);
      if (!Number.isInteger(nextStock) || nextStock < 0) throw fail(422, 'INVALID_INPUT', 'Warehouse stock must be a whole number ≥ 0.');
      if (!Number.isInteger(nextMin) || nextMin < 0) throw fail(422, 'INVALID_INPUT', 'Minimum reorder level must be a whole number ≥ 0.');

      const delta = nextStock - Number(p.warehouse_stock || 0);
      p.warehouse_stock = nextStock;
      p.min_reorder_level = nextMin;
      s.warehouse_logs = Array.isArray(s.warehouse_logs) ? s.warehouse_logs : [];
      s.warehouse_logs.unshift({
        id: 'wh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        at: new Date().toISOString(),
        part_id: p.id,
        exact_id: p.exact_id,
        delta,
        new_stock: nextStock,
        reason: (reason || '').trim() || (delta < 0 ? 'Issued to field technician / jobsite' : 'Warehouse physical inventory adjustment'),
        by: u.name
      });
      save(s);
      logAudit('WAREHOUSE_ADJUST', p.exact_id, `Adjusted warehouse stock by ${delta >= 0 ? '+' + delta : delta} → ${nextStock} pcs (Reorder threshold: ${nextMin})`, u);
      return JSON.parse(JSON.stringify(p));
    }),

    /* ---------- SUPPLIER PERFORMANCE & SPEND ANALYTICS API ---------- */
    getProcurementAnalytics: () => wrap(() => {
      const s = load();
      need(s, 'orders');
      const today = todayStr();
      const maxAge = (s.policy && s.policy.max_age_days) || 14;
      const livePos = (s.purchase_orders || []).filter((p) => p.status !== 'CANCELLED');
      const totalSpendMinor = livePos.reduce((a, p) => a + (p.subtotal_minor || 0), 0);

      // Compute realized procurement savings across PO lines (highest active quote for part vs ordered unit price)
      let totalSavingsMinor = 0;
      livePos.forEach((po) => {
        (po.lines || []).forEach((ln) => {
          const partOffers = (s.offers || []).filter((o) => o.part_id === ln.part_id && o.active && o.price_minor != null);
          if (partOffers.length > 1) {
            const highest = Math.max(...partOffers.map((o) => o.price_minor));
            if (highest > ln.unit_price_minor) {
              totalSavingsMinor += (highest - ln.unit_price_minor) * ln.quantity;
            }
          }
        });
      });

      const suppliers = (s.suppliers || []).map((sup) => {
        const supPos = livePos.filter((p) => p.supplier_id === sup.id || p.supplier_name === sup.name);
        const spend = supPos.reduce((a, p) => a + (p.subtotal_minor || 0), 0);
        let orderedPcs = 0, receivedPcs = 0, rejectedPcs = 0, rtvClaimsCount = 0;
        let onTimeCount = 0, evaluatedDeliveryCount = 0;

        supPos.forEach((po) => {
          if (po.expected_date && po.status !== 'DRAFT') {
            evaluatedDeliveryCount++;
            const doneDate = po.received_at ? po.received_at.slice(0, 10) : today;
            if (doneDate <= po.expected_date) onTimeCount++;
          }
          (po.lines || []).forEach((l) => {
            orderedPcs += l.quantity || 0;
            receivedPcs += l.received_qty || 0;
            rejectedPcs += l.rejected_qty || 0;
            rtvClaimsCount += Array.isArray(l.rtv_claims) ? l.rtv_claims.length : 0;
          });
        });

        const supOffers = (s.offers || []).filter((o) => o.supplier_id === sup.id && o.active);
        const freshOffers = supOffers.filter((o) => o.checked_date && daysBetween(o.checked_date, today) <= maxAge && o.price_minor != null);
        const priceDrops = supOffers.filter((o) => o.prev_price_minor != null && o.price_minor != null && o.price_minor < o.prev_price_minor).length;
        const priceHikes = supOffers.filter((o) => o.prev_price_minor != null && o.price_minor != null && o.price_minor > o.prev_price_minor).length;

        return {
          supplier_id: sup.id,
          supplier_name: sup.name,
          location: sup.location || 'Philippines',
          po_count: supPos.length,
          spend_minor: spend,
          spend_share_pct: totalSpendMinor > 0 ? Math.round((spend / totalSpendMinor) * 100) : 0,
          ordered_pcs: orderedPcs,
          received_pcs: receivedPcs,
          rejected_pcs: rejectedPcs,
          rtv_claims_count: rtvClaimsCount,
          fulfillment_rate_pct: orderedPcs > 0 ? Math.round((receivedPcs / orderedPcs) * 100) : 100,
          quality_acceptance_pct: (receivedPcs + rejectedPcs) > 0 ? Math.round((receivedPcs / (receivedPcs + rejectedPcs)) * 100) : 100,
          on_time_rate_pct: evaluatedDeliveryCount > 0 ? Math.round((onTimeCount / evaluatedDeliveryCount) * 100) : 100,
          fresh_offers_count: freshOffers.length,
          total_offers_count: supOffers.length,
          freshness_rate_pct: supOffers.length > 0 ? Math.round((freshOffers.length / supOffers.length) * 100) : 100,
          price_drops: priceDrops,
          price_hikes: priceHikes
        };
      });

      const totalRtvClaims = suppliers.reduce((a, x) => a + x.rtv_claims_count, 0);
      const lowStockCount = (s.parts || []).filter((p) => p.active !== false && Number(p.warehouse_stock || 0) <= Number(p.min_reorder_level || 5)).length;

      return {
        total_spend_minor: totalSpendMinor,
        total_savings_minor: totalSavingsMinor,
        total_po_count: livePos.length,
        total_rtv_claims: totalRtvClaims,
        low_stock_count: lowStockCount,
        suppliers
      };
    }),

    getCopilotContext: () => {
      const s = load();
      return {
        company: s.company_settings || {},
        parts: s.parts || [],
        offers: s.offers || [],
        suppliers: s.suppliers || [],
        purchase_orders: s.purchase_orders || [],
        summaries: s.summaries || []
      };
    },

    deletePurchaseOrder: (id) => wrap(async () => {
      const s = load();
      const u = need(s, 'orders');
      const po = getPO(s, u, id);
      if (po.status !== 'DRAFT') throw fail(409, 'LOCKED', 'Only draft purchase orders can be deleted. Cancel issued orders instead.');
      if (!isAdminRole(u) && po.owner_id !== u.id) throw fail(403, 'FORBIDDEN', 'You can only delete your own draft purchase orders.');
      s.purchase_orders = s.purchase_orders.filter((x) => x.id !== id);
      save(s);
      if (supabase) {
        try { await supabase.from('purchase_orders').delete().eq('id', id); } catch (e) {}
      }
      logAudit('PO_DELETED', po.po_number, 'Deleted draft purchase order for ' + po.supplier_name, u);
      return { ok: true, id };
    }),

    /* ---------- SUPABASE CLOUD SYNC & STATUS API ---------- */
    getCloudStatus: async () => {
      if (isSimulation()) {
        return { connected: false, is_simulation: true, message: 'Simulation Sandbox Mode active. Supabase Cloud synchronization is isolated to protect live enterprise data.' };
      }
      if (!supabase) {
        return { connected: false, message: 'Supabase client not loaded. Running in local storage mode.' };
      }
      try {
        const start = performance.now();
        const { count, error } = await supabase.from('catalog_offers').select('*', { count: 'exact', head: true });
        const latency = Math.round(performance.now() - start);
        if (error) {
          return { connected: false, url: SUPABASE_URL, message: 'Supabase query error: ' + error.message };
        }
        return {
          connected: true,
          url: SUPABASE_URL,
          latencyMs: latency,
          offersCount: count || 0,
          message: `Connected to Supabase PostgreSQL (${latency}ms ping)`
        };
      } catch (err) {
        return { connected: false, url: SUPABASE_URL, message: err.message };
      }
    },

    syncToCloud: async () => {
      if (!supabase) throw new Error('Supabase client unavailable.');
      const s = load();
      let offersSynced = 0;
      let listsSynced = 0;
      let summariesSynced = 0;

      // 1. Sync Offers (ensuring source and qty are provided to satisfy non-null constraints)
      try {
        const { data: cloudOffers } = await supabase.from('catalog_offers').select('id, part_id, source');
        for (const off of s.offers) {
          const prt = s.parts.find(p => p.id === off.part_id);
          const sup = s.suppliers.find(x => x.id === off.supplier_id);
          const exactPartId = prt ? prt.exact_id : off.part_id;
          const supName = sup ? sup.name : (off.source || 'Direct Accredited Supplier');

          const payload = {
            part_id: exactPartId,
            source: supName,
            price_minor: off.price_minor || 0,
            qty: off.recorded_quantity || off.qty || 0,
            checked_date: off.checked_date || new Date().toISOString().slice(0, 10),
            active: off.active !== false
          };

          const existing = (cloudOffers || []).find(co => 
            co.part_id && co.part_id.toLowerCase() === exactPartId.toLowerCase() &&
            co.source && co.source.toLowerCase() === supName.toLowerCase()
          );

          if (existing) {
            const { error: updErr } = await supabase.from('catalog_offers').update(payload).eq('id', existing.id);
            if (!updErr) offersSynced++;
          } else {
            const { error: insErr } = await supabase.from('catalog_offers').insert([payload]);
            if (!insErr) offersSynced++;
          }
        }
      } catch (offErr) {
        console.warn('Offers sync notice:', offErr);
      }

      // 2. Sync BOM Items
      try {
        const { data: cloudBoms } = await supabase.from('bom_items').select('id, part_id, name');
        for (const l of s.lists) {
          if (Array.isArray(l.lines)) {
            for (const ln of l.lines) {
              const prt = s.parts.find(p => p.id === ln.part_id);
              const exactPartId = prt ? prt.exact_id : ln.part_id;
              const bomPayload = {
                part_id: exactPartId,
                name: prt ? prt.description : exactPartId,
                qty: ln.quantity
              };

              const found = (cloudBoms || []).find(cb => cb.part_id === exactPartId && cb.name === bomPayload.name);
              if (found) {
                await supabase.from('bom_items').update(bomPayload).eq('id', found.id);
              } else {
                await supabase.from('bom_items').insert([bomPayload]);
              }
            }
          }
          listsSynced++;
        }
      } catch (bomErr) {
        console.warn('BOM items sync notice:', bomErr);
      }

      // 3. Sync Sourcing Summaries
      if (Array.isArray(s.summaries) && s.summaries.length) {
        try {
          const { data: cloudSums } = await supabase.from('sourcing_summaries').select('id');
          for (const sm of s.summaries) {
            const found = (cloudSums || []).find(cs => cs.id === sm.id);
            if (!found) {
              const sumPayload = {
                id: sm.id,
                save_token: sm.save_token,
                name: sm.title || sm.name || 'Job Sourcing Decision',
                author_name: sm.author_name,
                saved_date: sm.saved_date,
                subtotal_minor: sm.subtotal_minor,
                status: sm.status,
                total_lines: sm.total_lines,
                resolved_count: sm.resolved_count,
                unresolved_count: sm.unresolved_count,
                ai_executive_summary: sm.ai_executive_summary,
                drift_notice: sm.drift_notice || 'Original calculation snapshot.',
                lines: sm.lines || [],
                created_at: sm.created_at || new Date().toISOString()
              };
              const { error } = await supabase.from('sourcing_summaries').insert([sumPayload]);
              if (!error) summariesSynced++;
            }
          }
        } catch (sumErr) {
          console.warn('Summaries sync notice:', sumErr);
        }
      }

      // 4. Sync Company Settings (safe against missing table)
      let companySettingsSynced = false;
      if (s.company_settings) {
        try {
          const csPayload = {
            id: 1,
            business_name: s.company_settings.business_name || 'AMGC Airconditioning Services',
            business_type: s.company_settings.business_type || 'Commercial & Industrial HVAC Services',
            location: s.company_settings.location || 'V.V. Soliven Ave. II, Cainta, Rizal, Philippines',
            currency_code: s.company_settings.currency_code || 'PHP',
            currency_symbol: s.company_settings.currency_symbol || '₱',
            max_quote_age_days: s.company_settings.max_quote_age_days || 14,
            mcda_cost_weight: (s.company_settings.mcda_cost_weight || 40) / 100,
            mcda_stock_weight: (s.company_settings.mcda_stock_weight || 30) / 100,
            mcda_freshness_weight: (s.company_settings.mcda_freshness_weight || 20) / 100,
            mcda_consolidation_weight: (s.company_settings.mcda_consolidation_weight || 10) / 100,
            updated_at: new Date().toISOString()
          };
          const { error: csErr } = await supabase.from('company_settings').upsert([csPayload]);
          if (!csErr) companySettingsSynced = true;
        } catch (csEx) {
          console.warn('Company settings table sync skipped:', csEx);
        }
      }

      // 5. Sync Account Provisioning & Verified Password Reset Requests
      if (Array.isArray(s.purchase_orders) && s.purchase_orders.length) {
        s.purchase_orders.forEach(syncPurchaseOrder);
      }
      if (s.account_requests && s.account_requests.length) {
        try {
          await supabase.from('account_requests').upsert(s.account_requests, { onConflict: 'id' });
        } catch (arEx) {}
      }
      if (s.password_reset_requests && s.password_reset_requests.length) {
        try {
          await supabase.from('password_reset_requests').upsert(s.password_reset_requests, { onConflict: 'id' });
        } catch (pwrEx) {}
      }
      if (s.suppliers && s.suppliers.length) {
        try {
          await supabase.from('suppliers').upsert(s.suppliers, { onConflict: 'id' });
        } catch (supEx) {}
      }
      if (s.supplier_requests && s.supplier_requests.length) {
        try {
          await supabase.from('supplier_requests').upsert(s.supplier_requests, { onConflict: 'id' });
        } catch (srEx) {}
      }

      return {
        success: true,
        offersSynced,
        listsSynced,
        summariesSynced,
        companySettingsSynced
      };
    },

    newToken: uuid,
  };

  // Realtime Supabase Channel
  let realtimeChannel = null;
  function setupRealtime() {
    if (!supabase || typeof supabase.channel !== 'function') return;
    try {
      realtimeChannel = supabase
        .channel('public-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'catalog_offers' },
          (payload) => {
            console.log('⚡ Realtime catalog_offers event:', payload);
            window.dispatchEvent(new CustomEvent('pc:realtime-catalog', { detail: payload }));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'company_settings' },
          (payload) => {
            console.log('⚡ Realtime company_settings event:', payload);
            if (payload && payload.new) {
              const incoming = Object.assign({}, payload.new);
              if (incoming.mcda_cost_weight != null) incoming.mcda_cost_weight = normalizeWeight(incoming.mcda_cost_weight, 40);
              if (incoming.mcda_stock_weight != null) incoming.mcda_stock_weight = normalizeWeight(incoming.mcda_stock_weight, 30);
              if (incoming.mcda_freshness_weight != null) incoming.mcda_freshness_weight = normalizeWeight(incoming.mcda_freshness_weight, 20);
              if (incoming.mcda_consolidation_weight != null) incoming.mcda_consolidation_weight = normalizeWeight(incoming.mcda_consolidation_weight, 10);
              const s = load();
              s.company_settings = Object.assign({}, s.company_settings, incoming);
              save(s);
              window.dispatchEvent(new CustomEvent('pc:realtime-branding', { detail: s.company_settings }));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'audit_logs' },
          (payload) => {
            console.log('⚡ Realtime audit_logs event:', payload);
            window.dispatchEvent(new CustomEvent('pc:realtime-audit', { detail: payload }));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'account_requests' },
          (payload) => {
            window.dispatchEvent(new CustomEvent('pc:realtime-audit', { detail: payload }));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'password_reset_requests' },
          (payload) => {
            window.dispatchEvent(new CustomEvent('pc:realtime-audit', { detail: payload }));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'supplier_requests' },
          (payload) => {
            window.dispatchEvent(new CustomEvent('pc:realtime-audit', { detail: payload }));
          }
        )
        .subscribe((status) => {
          console.log('⚡ Supabase Realtime channel status:', status);
          window.__pc_realtime_status = status;
          window.dispatchEvent(new CustomEvent('pc:realtime-status', { detail: status }));
        });
    } catch (e) {
      console.warn('Realtime channel error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', setupRealtime);
    } else {
      setupRealtime();
    }
  }

  window.PC_API = api;
})();
