/* 
 * AMGC Airconditioning Services & Universal Enterprise PartsCompare
 * REAL PHILIPPINE HVAC FIXTURES & SEED DATA
 * Suppliers: Everwell Parts & Equipment Corp., C&C Airconditioning Supply, Manco Refrigeration Supply
 */
(function () {
  function dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  const o = (id, part_id, supplier_id, price_minor, qty, ago, src, active = true, prev_price_minor = null) => ({
    id,
    part_id,
    supplier_id,
    price_minor,
    prev_price_minor,
    price_history: prev_price_minor != null
      ? [
          { price_minor: prev_price_minor, date: dateOffset(-(ago || 2) - 18) },
          { price_minor, date: ago === null ? dateOffset(-1) : dateOffset(-ago) }
        ]
      : (price_minor != null ? [{ price_minor, date: ago === null ? dateOffset(-1) : dateOffset(-ago) }] : []),
    currency: 'PHP',
    price_basis: 'per_piece',
    recorded_quantity: qty,
    checked_date: ago === null ? null : dateOffset(-ago),
    source_reference: src,
    active,
    revision: 1,
    synthetic: false,
  });

  window.PC_FIXTURES = {
    company_settings: {
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
    },
    users: [
      { id: 'u1', username: 'dave_pm', alias: 'preparer', name: 'Christian Dave D. Guiyab', role: 'preparer', is_active: true, password: 'Dave#2026!', recovery_pin: '240811', security_question: 'What is your employee ID badge or favorite HVAC tool?', security_answer: 'manifold gauge' },
      { id: 'u2', username: 'pearl_dba', alias: 'maintainer', name: 'Pearl Alexa J. Catequista', role: 'maintainer', is_active: true, password: 'Pearl@2026#', recovery_pin: '350922', security_question: 'What was the name of your first elementary school?', security_answer: 'san roque elementary' },
      { id: 'u3', username: 'karen_admin', alias: 'admin', name: 'Karen Reyes', role: 'administrator', is_active: true, password: 'Karen$2026*', recovery_pin: '890415', security_question: 'What city or municipality were you born in?', security_answer: 'manila' },
    ],
    account_requests: [
      {
        id: 'req-01',
        name: 'Engr. Marco Santos',
        username: 'marco_hvac',
        role: 'preparer',
        password: 'Marco#2026!',
        recovery_pin: '517283',
        security_question: 'What city or municipality were you born in?',
        security_answer: 'pasig',
        status: 'PENDING',
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        reviewed_at: null,
        reviewed_by: null
      }
    ],
    password_reset_requests: [],
    reset_lockouts: {},
    supplier_requests: [
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
    ],
    suppliers: [
      { id: 's1', name: 'Everwell Parts & Equipment Corp.', location: 'Caloocan & Manila, Philippines', accredited: true },
      { id: 's2', name: 'C&C Airconditioning Supply', location: 'Quezon City & Rizal, Philippines', accredited: true },
      { id: 's3', name: 'Manco Refrigeration Supply', location: 'Mandaluyong & Cainta, Philippines', accredited: true },
    ],
    parts: [
      { id: 'p1', exact_id: 'CBB65-45UF-450V', description: 'Dual Run Motor Capacitor 45µF 450VAC (Round aluminum can)', unit: 'piece', active: true, category: 'Capacitors', warehouse_stock: 14, min_reorder_level: 10 },
      { id: 'p2', exact_id: 'HCC-1XU02AA', description: 'Heavy Duty Defrost Contactor 30A 1-Pole 240V Coil', unit: 'piece', active: true, category: 'Contactors', warehouse_stock: 3, min_reorder_level: 8 },
      { id: 'p3', exact_id: 'R410A-CAN-1KG', description: 'Virgin Refrigerant R410A Sealed Canister 1 kg', unit: 'piece', active: true, category: 'Refrigerants', warehouse_stock: 4, min_reorder_level: 10 },
      { id: 'p4', exact_id: 'NTC-10K-COPPER', description: 'Precision Temperature Sensor Probe NTC 10kΩ Copper Head', unit: 'piece', active: true, category: 'Sensors', warehouse_stock: 22, min_reorder_level: 10 },
      { id: 'p5', exact_id: 'QD-U11A', description: 'Universal Split-Type A/C Digital Control Board System & Remote', unit: 'piece', active: true, category: 'PCBs', warehouse_stock: 1, min_reorder_level: 4 },
      { id: 'p6', exact_id: 'RPG20B', description: 'Indoor Blower Fan Motor 20W 220V 4-Speed (Welling/Midea)', unit: 'piece', active: true, category: 'Motors', warehouse_stock: 6, min_reorder_level: 4 },
    ],
    offers: [
      // p1: CBB65-45UF-450V (Capacitor)
      o('o1', 'p1', 's1', 38000, 45, 2, 'Everwell Parts Official Wholesale Quotation #EW-2026-4491', true, 40500), // ₱380.00 (Dropped from ₱405.00)
      o('o2', 'p1', 's2', 42000, 30, 4, 'C&C Airconditioning Supply Catalog Sheet #CC-8820', true, 42000),         // ₱420.00 (Stable)
      o('o3', 'p1', 's3', 39500, 3,  1, 'Manco Refrigeration Price Bulletin #MB-1102', true, 38500),               // ₱395.00 (+₱10.00)

      // p2: HCC-1XU02AA (Contactor)
      o('o4', 'p2', 's1', 48000, 25, 3, 'Everwell Parts Official Wholesale Quotation #EW-2026-4491', true, 49500), // ₱480.00 (-₱15.00)
      o('o5', 'p2', 's2', 45000, 40, 1, 'C&C Airconditioning Supply Catalog Sheet #CC-8820', true, 47000),         // ₱450.00 (-₱20.00)
      o('o6', 'p2', 's3', 51000, 20, 28, 'Manco Refrigeration Stale Slip #MB-9941', true, 49000),                  // ₱510.00 (Stale: 28 days ago)

      // p3: R410A-CAN-1KG (Refrigerant)
      o('o7', 'p3', 's1', 75000, 60, 2, 'Everwell Parts Bulk Refrigerant List #EW-GAS-09', true, 76500),           // ₱750.00 (-₱15.00)
      o('o8', 'p3', 's2', 72000, 50, 2, 'C&C Wholesale Refrigerant Price Bulletin #CC-GAS-14', true, 74000),       // ₱720.00 (-₱20.00)
      o('o9', 'p3', 's3', 78000, 15, 5, 'Manco Retail Quotation #MB-4021', true, 75000),                           // ₱780.00 (+₱30.00)

      // p4: NTC-10K-COPPER (Sensor Probe)
      o('o10', 'p4', 's1', 14000, 80, 1, 'Everwell Parts Sensors & Thermistors #EW-SEN-301', true, 14000),         // ₱140.00
      o('o11', 'p4', 's2', 12500, 100, 2, 'C&C Sensor Price List #CC-SEN-102', true, 13500),                       // ₱125.00 (-₱10.00)
      o('o12', 'p4', 's3', 13500, 60, 3, 'Manco Refrigeration Electronic Probes #MB-SEN-44', true, 13500),         // ₱135.00

      // p5: QD-U11A (Universal Control Board)
      o('o13', 'p5', 's1', 115000, 18, 3, 'Everwell Parts Universal Boards Catalog #EW-PCB-88', true, 120000),     // ₱1,150.00 (-₱50.00)
      o('o14', 'p5', 's2', 125000, 25, 2, 'C&C Airconditioning Universal PCB #CC-PCB-99', true, 125000),           // ₱1,250.00
      o('o15', 'p5', 's3', 130000, 10, 4, 'Manco Refrigeration Control Modules #MB-PCB-15', true, 128000),         // ₱1,300.00 (+₱20.00)

      // p6: RPG20B (Indoor Fan Motor)
      o('o16', 'p6', 's1', 165000, 12, 2, 'Everwell Parts HVAC Motors Dispatch #EW-MOT-55', true, 170000),         // ₱1,650.00 (-₱50.00)
      o('o17', 'p6', 's2', 175000, 15, 3, 'C&C Blower Motors Reference #CC-MOT-41', true, 175000),                 // ₱1,750.00
      o('o18', 'p6', 's3', null,   8,  2, 'Manco Price Pending Inbound Shipment', true),                           // Unpriced test case
    ],
    lists: [
      {
        id: 'l1',
        owner_id: 'u1',
        title: 'Split-Type AC Overhaul (Job #AC-2026-088)',
        revision: 1,
        archived: false,
        lines: [
          { id: 'ln1', part_id: 'p1', quantity: 2 }, // CBB65-45UF-450V x 2
          { id: 'ln2', part_id: 'p2', quantity: 1 }, // HCC-1XU02AA x 1
          { id: 'ln3', part_id: 'p3', quantity: 2 }, // R410A-CAN-1KG x 2
          { id: 'ln4', part_id: 'p4', quantity: 3 }, // NTC-10K-COPPER x 3
          { id: 'ln5', part_id: 'p5', quantity: 1 }, // QD-U11A x 1
        ],
      },
    ],
    summaries: [],
    purchase_orders: [
      {
        id: 'po91',
        po_number: 'PO-2026-0081',
        summary_id: 'sm-job-074',
        summary_title: 'Rooftop Package AC Preventive Overhaul (Job #AC-2026-074)',
        snapshot_token: 'tok-amgc-074a',
        owner_id: 'u1',
        created_by: 'Christian Dave D. Guiyab',
        issued_by: 'Karen Reyes',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        issued_at: new Date(Date.now() - 86400000 * 2.5).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        supplier_id: 's1',
        supplier_name: 'Everwell Parts & Equipment Corp.',
        supplier_location: 'Caloocan & Manila, Philippines',
        supplier_contact: '+63 (02) 8361-4491',
        currency: 'PHP',
        status: 'PARTIALLY_RECEIVED',
        expected_date: dateOffset(2),
        payment_terms: '30 days upon delivery',
        delivery_address: 'V.V. Soliven Ave. II, Cainta, Rizal, Philippines',
        notes: 'Deliver to AMGC Cainta warehouse bay 2. Include BIR VAT sales invoice.',
        courier: 'Everwell Delivery Van #4',
        tracking_ref: 'DR-EW-2026-8841',
        subtotal_minor: 432000,
        revision: 4,
        lines: [
          {
            line_id: 'pol-1',
            bom_line_id: 'ln1',
            part_id: 'p1',
            exact_id: 'CBB65-45UF-450V',
            description: 'Dual Run Motor Capacitor 45µF 450VAC (Round aluminum can)',
            quantity: 4,
            unit_price_minor: 38000,
            line_total_minor: 152000,
            offer_id: 'o1',
            source_reference: 'Everwell Parts Official Wholesale Quotation #EW-2026-4491',
            received_qty: 4,
            received_at: new Date(Date.now() - 3600000 * 6).toISOString(),
            receipts: [
              { at: new Date(Date.now() - 3600000 * 6).toISOString(), qty: 4, by: 'Pearl Alexa J. Catequista' }
            ]
          },
          {
            line_id: 'pol-2',
            bom_line_id: 'ln5',
            part_id: 'p5',
            exact_id: 'QD-U11A',
            description: 'Universal Split-Type A/C Digital Control Board System & Remote',
            quantity: 1,
            unit_price_minor: 115000,
            line_total_minor: 115000,
            offer_id: 'o13',
            source_reference: 'Everwell Parts Universal Boards Catalog #EW-PCB-88',
            received_qty: 0,
            rejected_qty: 1,
            rtv_claims: [
              { id: 'RTV-2026-01', at: new Date(Date.now() - 3600000 * 6).toISOString(), qty: 1, reason: 'Cracked relay housing on arrival — returned to Everwell driver for replacement', by: 'Pearl Alexa J. Catequista', status: 'OPEN' }
            ],
            receipts: []
          },
          {
            line_id: 'pol-3',
            bom_line_id: 'ln6',
            part_id: 'p6',
            exact_id: 'RPG20B',
            description: 'Indoor Blower Fan Motor 20W 220V 4-Speed (Welling/Midea)',
            quantity: 1,
            unit_price_minor: 165000,
            line_total_minor: 165000,
            offer_id: 'o16',
            source_reference: 'Everwell Parts HVAC Motors Dispatch #EW-MOT-55',
            received_qty: 0,
            receipts: []
          }
        ],
        history: [
          { at: new Date(Date.now() - 86400000 * 3).toISOString(), by: 'Christian Dave D. Guiyab', role: 'preparer', status: 'DRAFT', event: 'CREATED', note: 'Generated from approved sourcing summary "Rooftop Package AC Preventive Overhaul (Job #AC-2026-074)" (3 lines).' },
          { at: new Date(Date.now() - 86400000 * 2.5).toISOString(), by: 'Karen Reyes', role: 'administrator', status: 'ISSUED', event: 'STATUS_CHANGE', note: 'PO sent to Everwell Parts purchasing desk via email & Viber.' },
          { at: new Date(Date.now() - 86400000 * 1.5).toISOString(), by: 'Pearl Alexa J. Catequista', role: 'maintainer', status: 'CONFIRMED', event: 'STATUS_CHANGE', note: 'Supplier confirmed stock availability; split dispatch scheduled.' },
          { at: new Date(Date.now() - 3600000 * 6).toISOString(), by: 'Pearl Alexa J. Catequista', role: 'maintainer', status: 'PARTIALLY_RECEIVED', event: 'GOODS_RECEIVED', note: 'Received CBB65-45UF-450V ×4 — Initial batch inspected at Cainta warehouse (4/6 pcs total)' }
        ]
      },
      {
        id: 'po92',
        po_number: 'PO-2026-0082',
        summary_id: 'sm-job-074',
        summary_title: 'Rooftop Package AC Preventive Overhaul (Job #AC-2026-074)',
        snapshot_token: 'tok-amgc-074a',
        owner_id: 'u1',
        created_by: 'Christian Dave D. Guiyab',
        issued_by: 'Karen Reyes',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        issued_at: new Date(Date.now() - 86400000 * 1.8).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        supplier_id: 's2',
        supplier_name: 'C&C Airconditioning Supply',
        supplier_location: 'Quezon City & Rizal, Philippines',
        supplier_contact: '+63 (02) 8912-8820',
        currency: 'PHP',
        status: 'IN_TRANSIT',
        expected_date: dateOffset(1),
        payment_terms: '15 days upon delivery',
        delivery_address: 'V.V. Soliven Ave. II, Cainta, Rizal, Philippines',
        notes: 'Handle refrigerant canisters upright. Deliver to Technician Christian Dave Guiyab.',
        courier: 'Lalamove L300 Fleet',
        tracking_ref: 'LLM-PH-904218',
        subtotal_minor: 259000,
        revision: 3,
        lines: [
          {
            line_id: 'pol-4',
            bom_line_id: 'ln2',
            part_id: 'p2',
            exact_id: 'HCC-1XU02AA',
            description: 'Heavy Duty Defrost Contactor 30A 1-Pole 240V Coil',
            quantity: 2,
            unit_price_minor: 45000,
            line_total_minor: 90000,
            offer_id: 'o5',
            source_reference: 'C&C Airconditioning Supply Catalog Sheet #CC-8820',
            received_qty: 0,
            receipts: []
          },
          {
            line_id: 'pol-5',
            bom_line_id: 'ln3',
            part_id: 'p3',
            exact_id: 'R410A-CAN-1KG',
            description: 'Virgin Refrigerant R410A Sealed Canister 1 kg',
            quantity: 2,
            unit_price_minor: 72000,
            line_total_minor: 144000,
            offer_id: 'o8',
            source_reference: 'C&C Wholesale Refrigerant Price Bulletin #CC-GAS-14',
            received_qty: 0,
            receipts: []
          },
          {
            line_id: 'pol-6',
            bom_line_id: 'ln4',
            part_id: 'p4',
            exact_id: 'NTC-10K-COPPER',
            description: 'Precision Temperature Sensor Probe NTC 10kΩ Copper Head',
            quantity: 2,
            unit_price_minor: 12500,
            line_total_minor: 25000,
            offer_id: 'o11',
            source_reference: 'C&C Sensor Price List #CC-SEN-102',
            received_qty: 0,
            receipts: []
          }
        ],
        history: [
          { at: new Date(Date.now() - 86400000 * 2).toISOString(), by: 'Christian Dave D. Guiyab', role: 'preparer', status: 'DRAFT', event: 'CREATED', note: 'Generated from approved sourcing summary "Rooftop Package AC Preventive Overhaul (Job #AC-2026-074)" (3 lines).' },
          { at: new Date(Date.now() - 86400000 * 1.8).toISOString(), by: 'Karen Reyes', role: 'administrator', status: 'ISSUED', event: 'STATUS_CHANGE', note: 'Approved and dispatched to C&C Airconditioning Supply.' },
          { at: new Date(Date.now() - 3600000 * 3).toISOString(), by: 'Pearl Alexa J. Catequista', role: 'maintainer', status: 'IN_TRANSIT', event: 'STATUS_CHANGE', note: 'Shipment dispatched by supplier · Tracking: LLM-PH-904218' }
        ]
      }
    ],
    policy: {
      version: 'POL-AMGC-01',
      max_age_days: 14,
      currency: 'PHP',
      synthetic: false,
    },
    counters: { id: 100, policy: 1, po: 82 },
  };
})();