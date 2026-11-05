/* Original SVG illustrations (drawn for this project). No external images. */
(function () {
  function chip(body, accent) {
    body = body || '#12303A'; accent = accent || '#7CD3CF';
    let pins = '';
    for (let i = 0; i < 6; i++) {
      const p = 34 + i * 18;
      pins += '<rect x="10" y="' + p + '" width="24" height="8" rx="2" fill="' + accent + '"/><rect x="126" y="' + p + '" width="24" height="8" rx="2" fill="' + accent + '"/>'
        + '<rect x="' + p + '" y="10" width="8" height="24" rx="2" fill="' + accent + '"/><rect x="' + p + '" y="126" width="8" height="24" rx="2" fill="' + accent + '"/>';
    }
    return '<svg viewBox="0 0 160 160" role="img" aria-label="Microcontroller chip illustration">' + pins
      + '<rect x="28" y="28" width="104" height="104" rx="12" fill="' + body + '" stroke="' + accent + '" stroke-width="2"/>'
      + '<circle cx="46" cy="46" r="6" fill="none" stroke="' + accent + '" stroke-width="2"/>'
      + '<rect x="52" y="64" width="56" height="8" rx="4" fill="' + accent + '" opacity=".9"/><rect x="52" y="82" width="40" height="8" rx="4" fill="' + accent + '" opacity=".55"/><rect x="52" y="100" width="48" height="8" rx="4" fill="' + accent + '" opacity=".35"/></svg>';
  }
  function sensor() {
    return '<svg viewBox="0 0 200 130" role="img" aria-label="Ultrasonic sensor illustration"><rect x="6" y="10" width="188" height="92" rx="10" fill="#0B6E6E"/>'
      + '<circle cx="56" cy="56" r="32" fill="#D8E2E8" stroke="#0F1B2D" stroke-width="3"/><circle cx="56" cy="56" r="22" fill="#9FB2BF"/><circle cx="56" cy="56" r="8" fill="#0F1B2D"/>'
      + '<circle cx="144" cy="56" r="32" fill="#D8E2E8" stroke="#0F1B2D" stroke-width="3"/><circle cx="144" cy="56" r="22" fill="#9FB2BF"/><circle cx="144" cy="56" r="8" fill="#0F1B2D"/>'
      + '<rect x="92" y="44" width="16" height="24" rx="3" fill="#7CD3CF"/>'
      + '<rect x="68" y="102" width="8" height="22" fill="#E6C65A"/><rect x="88" y="102" width="8" height="22" fill="#E6C65A"/><rect x="104" y="102" width="8" height="22" fill="#E6C65A"/><rect x="124" y="102" width="8" height="22" fill="#E6C65A"/></svg>';
  }
  function servo() {
    return '<svg viewBox="0 0 200 130" role="img" aria-label="Servo motor illustration"><rect x="14" y="36" width="120" height="62" rx="8" fill="#0F1B2D"/><rect x="2" y="56" width="16" height="22" rx="3" fill="#0F1B2D"/><rect x="130" y="56" width="16" height="22" rx="3" fill="#0F1B2D"/>'
      + '<rect x="40" y="50" width="60" height="8" rx="4" fill="#7CD3CF" opacity=".8"/><rect x="40" y="68" width="44" height="8" rx="4" fill="#7CD3CF" opacity=".45"/>'
      + '<circle cx="134" cy="67" r="20" fill="#2B3A4F"/><circle cx="134" cy="67" r="10" fill="#7CD3CF"/><rect x="134" y="62" width="58" height="10" rx="5" fill="#EEF2F5"/><circle cx="184" cy="67" r="3" fill="#0F1B2D"/>'
      + '<path d="M14 98 C 4 110, 4 118, 22 122" fill="none" stroke="#C0522D" stroke-width="4"/><path d="M24 98 C 16 112, 18 120, 32 124" fill="none" stroke="#E6C65A" stroke-width="4"/></svg>';
  }
  function circuit() {
    const paths = ['M0 120 H200 L260 180 H520', 'M1200 80 H940 L880 140 H700', 'M0 440 H160 L220 380 H420 L470 430 H640', 'M1200 500 H980 L920 440 H760', 'M300 0 V90 L360 150 H560', 'M900 620 V540 L840 480', 'M1200 300 H1050 L1000 250 H860'];
    let base = '', pulse = '', pads = '';
    paths.forEach((d, i) => {
      base += '<path d="' + d + '" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2"/>';
      pulse += '<path class="pulse" style="animation-delay:' + (i * 0.9) + 's" d="' + d + '" fill="none" stroke="#7CD3CF" stroke-width="2.5" stroke-linecap="round"/>';
      const m = d.match(/^M(\d+) (\d+)/); pads += '<circle cx="' + m[1] + '" cy="' + m[2] + '" r="5" fill="#0B6E6E" stroke="#7CD3CF" stroke-opacity=".6" stroke-width="2"/>';
    });
    return '<svg class="hero-bg" viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + base + pulse + pads + '</svg>';
  }
  const icons = {
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 010 6.6M18 14.8c1.9.8 3.1 2.5 3.5 5.2"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/></svg>',
  };
  window.PC_ART = { chip, sensor, servo, circuit, icons };
})();
