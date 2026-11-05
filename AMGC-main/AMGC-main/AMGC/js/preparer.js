/* preparer.js - Enhanced Preparer Workspace Dashboard */
(function () {
  window.PC_PREPARER = {
    renderDashboard: function (lists, me) {
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      
      const totalLists = lists.length;
      const totalLines = lists.reduce((sum, l) => sum + (l.lines ? l.lines.length : 0), 0);
      const activeLists = lists.filter(l => !l.archived).length;

      return `
        <!-- PREPARER WORKSPACE HEADER -->
        <div class="preparer-header-wrap">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <h1 style="font-size:26px; font-weight:700; margin:0;">Preparer Workspace</h1>
              <span class="badge ok">Role: Maker / BOM Author</span>
            </div>
            <p class="sub">Manage your exact-part lists, verify supplier eligibility, and prepare sourcing decisions.</p>
          </div>
          <div style="display:flex; gap:10px;">
            <a href="#/summaries" class="btn">View Saved Summaries</a>
          </div>
        </div>

        <!-- 3 SUMMARY METRIC CARDS -->
        <div class="preparer-metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">📋</div>
            <div>
              <div class="metric-number">${totalLists}</div>
              <div class="metric-label">Total BOM Lists</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">⚡</div>
            <div>
              <div class="metric-number">${totalLines}</div>
              <div class="metric-label">Components Listed</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🔒</div>
            <div>
              <div class="metric-number">${activeLists}</div>
              <div class="metric-label">Active Comparison Drafts</div>
            </div>
          </div>
        </div>

        <!-- WORKFLOW STEPS BANNER -->
        <div class="preparer-guide-banner">
          <div class="guide-step-item">
            <span class="guide-step-badge">Step 1</span>
            <strong>Create or Edit BOM</strong>
            <p>Add exact part numbers with whole-piece quantities needed for your build.</p>
          </div>
          <div class="guide-step-arrow">→</div>
          <div class="guide-step-item">
            <span class="guide-step-badge">Step 2</span>
            <strong>Compare Offers</strong>
            <p>Check candidate supplier quotes against the 14-day freshness rule and recorded stock.</p>
          </div>
          <div class="guide-step-arrow">→</div>
          <div class="guide-step-item">
            <span class="guide-step-badge">Step 3</span>
            <strong>Freeze Sourcing Summary</strong>
            <p>Lock the selected prices and audit trail into a permanent sourcing snapshot.</p>
          </div>
        </div>

        <!-- MAIN 2-COLUMN WORKSPACE -->
        <div class="grid2" style="margin-top: 10px;">
          
          <!-- LEFT: BOM LISTS -->
          <section class="main stack" aria-label="Lists">
            <div class="row between" style="align-items:center;">
              <h2 style="font-size:18px; font-weight:700;">My Parts Lists (${totalLists})</h2>
              <span class="small" style="color:var(--mute);">Owner-scoped &bull; Private to your account</span>
            </div>

            ${lists.length ? lists.map((l) => `
              <div class="enhanced-bom-card">
                <div class="bom-card-main-info">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="font-size:16px;">${esc(l.title)}</strong>
                    ${l.archived ? '<span class="badge gray">Archived</span>' : '<span class="badge ok">Draft</span>'}
                  </div>
                  <div class="small" style="color:var(--mute); margin-top:4px;">
                    Revision <strong>${l.revision}</strong> &bull; Contains <strong>${l.lines.length}</strong> required part line(s)
                  </div>
                  
                  <!-- PREVIEW PILLS -->
                  <div class="bom-lines-preview">
                    ${l.lines.slice(0, 4).map(line => `
                      <span class="bom-part-pill">${esc(line.part_id || 'Part')} &times; ${line.quantity}</span>
                    `).join('')}
                    ${l.lines.length > 4 ? `<span class="bom-part-pill-more">+${l.lines.length - 4} more</span>` : ''}
                  </div>
                </div>

                <div class="row" style="gap:8px;">
                  <a class="btn" href="#/lists/${esc(l.id)}">Edit BOM</a>
                  <a class="btn primary" href="#/compare/${esc(l.id)}" ${l.lines.length ? '' : 'aria-disabled="true" tabindex="-1"'}>
                    Compare Offers →
                  </a>
                </div>
              </div>
            `).join('') : `
              <div class="card stack" style="text-align:center; padding:40px 20px;">
                <p class="sub">You have no parts lists created yet.</p>
                <p class="small">Use the form on the right to start your first Bill of Materials.</p>
              </div>
            `}
          </section>

          <!-- RIGHT: NEW LIST WITH PRESET SUGGESTIONS -->
          <aside class="card side stack">
            <h2 style="font-size:18px; font-weight:700;">Create New BOM</h2>
            <p class="small" style="color:var(--mute);">Start a fresh bill of materials for your component build.</p>

            <form id="newlist" class="stack" novalidate style="margin-top:6px;">
              <div>
                <label for="nl">List Title</label>
                <input id="nl" placeholder="e.g. Ultrasonic Sensor Module" required>
                <div class="err" id="nl-err" hidden></div>
              </div>

              <!-- PRESET TEMPLATE SHORTCUTS -->
              <div>
                <label class="small" style="color:var(--mute); margin-bottom:6px;">Quick Presets (Click to autofill):</label>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                  <button type="button" class="btn btn-sm" onclick="document.getElementById('nl').value='Aircon Temperature Controller';">Aircon Controller</button>
                  <button type="button" class="btn btn-sm" onclick="document.getElementById('nl').value='Microcontroller Core Module';">MCU Core Board</button>
                  <button type="button" class="btn btn-sm" onclick="document.getElementById('nl').value='5V Regulated Power Supply';">5V Power Unit</button>
                </div>
              </div>

              <button class="primary" type="submit" style="margin-top:8px;">+ Create List Draft</button>
            </form>

            <div class="alert info" style="margin-top:14px; font-size:13px; line-height:1.5;">
              <strong>Note:</strong> Lists start with 0 lines. Once created, click <em>Edit BOM</em> to choose exact part IDs and quantities.
            </div>
          </aside>

        </div>
      `;
    }
  };
})();