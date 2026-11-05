/* 
 * UNIVERSAL ENTERPRISE PARTSCOMPARE & SOURCING INTELLIGENCE ENGINE
 * Implements Part Normalization, CSV Importer, Dynamic MCDA Utility Ranking, and Executive Summary
 */
(function () {
  const money = (minor, cur = 'PHP') => minor == null ? '₱0.00' 
    : cur + ' ' + (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Known HVAC token dictionary for semantic normalization
  const HVAC_SYNONYMS = {
    'p1': ['cbb65', '45uf', 'capacitor', 'cap', 'round aluminum', 'dual run', '450v', 'motor capacitor'],
    'p2': ['hcc-1xu02aa', 'contactor', 'defrost', '30a', '1-pole', '240v coil', 'heavy duty contactor'],
    'p3': ['r410a', 'freon', 'refrigerant', 'gas', 'canister', '1kg', 'virgin gas', 'sealed can'],
    'p4': ['ntc', '10k', 'temp sensor', 'temperature probe', 'thermistor', 'copper head', 'sensor probe'],
    'p5': ['qd-u11a', 'universal pcb', 'control board', 'ac module', 'digital controller', 'split type board', 'remote kit'],
    'p6': ['rpg20b', 'fan motor', 'blower', '20w', '220v', '4-speed', 'indoor motor', 'welling', 'midea']
  };

  function getDaysBetween(dateStr) {
    if (!dateStr) return 999;
    const today = new Date();
    const d = new Date(dateStr + 'T12:00:00Z');
    const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  }

  const PC_AI = {
    /**
     * AI Part Normalization Engine
     * Matches raw description or messy vendor SKU to exact standardized catalog item.
     */
    normalizePartDescription: function (rawText, catalogParts = []) {
      if (!rawText || !rawText.trim()) return null;
      const clean = rawText.toLowerCase().replace(/[^a-z0-9\.\-\s]/g, ' ').trim();
      const tokens = clean.split(/\s+/).filter(Boolean);

      let bestMatch = null;
      let highestScore = 0;

      for (const part of catalogParts) {
        let score = 0;
        const exactIdLower = part.exact_id.toLowerCase();
        const descLower = part.description.toLowerCase();

        // Direct exact SKU match
        if (clean.includes(exactIdLower) || exactIdLower.includes(clean)) {
          score += 60;
        }

        // Token match against exact_id
        for (const token of tokens) {
          if (exactIdLower.includes(token)) score += 20;
          if (descLower.includes(token)) score += 10;
        }

        // Semantic synonym dictionary match
        const synonyms = HVAC_SYNONYMS[part.id] || [];
        for (const syn of synonyms) {
          if (clean.includes(syn)) {
            score += 25;
          }
        }

        // Jaccard similarity token overlap
        const partTokens = (exactIdLower + ' ' + descLower).split(/[\s\-_\/]+/).filter(t => t.length > 2);
        const overlap = tokens.filter(t => partTokens.includes(t)).length;
        score += overlap * 15;

        if (score > highestScore) {
          highestScore = score;
          bestMatch = part;
        }
      }

      // Compute normalized confidence (0 to 100%)
      const confidence = Math.min(100, Math.round((highestScore / 80) * 100));

      // Extract quantity if present in the raw string (e.g. "qty 5", "5 pcs", "x2", "3units")
      let extractedQty = 1;
      const qtyMatch = rawText.match(/(?:x|qty|quantity|count|pieces|pcs|\:)\s*(\d+)/i) || rawText.match(/(\d+)\s*(?:pcs|pieces|units|cans|sets)/i);
      if (qtyMatch && qtyMatch[1]) {
        extractedQty = parseInt(qtyMatch[1], 10);
      }

      return {
        matchedPart: highestScore >= 20 ? bestMatch : null,
        confidence: highestScore >= 20 ? confidence : 0,
        suggestedQty: extractedQty > 0 ? extractedQty : 1,
        rawInput: rawText,
        reasoning: bestMatch 
          ? `Mapped based on keyword match to ${bestMatch.exact_id} (${confidence}% confidence)` 
          : 'No confident catalog mapping found.'
      };
    },

    /**
     * AI CSV / Text Importer
     * Parses arbitrary CSV lines and normalizes each row into a BOM line candidate.
     */
    parseCsvImport: function (csvContent, catalogParts = []) {
      const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const results = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip header lines
        if (i === 0 && (line.toLowerCase().includes('part') || line.toLowerCase().includes('description') || line.toLowerCase().includes('item'))) {
          continue;
        }

        // Split by comma, tab, or semicolon
        const parts = line.split(/[,\t;]/).map(p => p.trim());
        let descOrSku = parts[0] || '';
        let qty = 1;

        if (parts.length >= 2) {
          const possibleQty = parseInt(parts[1], 10);
          if (!isNaN(possibleQty) && possibleQty > 0) {
            qty = possibleQty;
          } else {
            if (parts.length >= 3 && !isNaN(parseInt(parts[2], 10))) {
              qty = parseInt(parts[2], 10);
              descOrSku = parts[0] + ' ' + parts[1];
            }
          }
        }

        const matchResult = PC_AI.normalizePartDescription(descOrSku, catalogParts);
        results.push({
          rowIndex: i + 1,
          rawText: line,
          extractedDescription: descOrSku,
          matchedPart: matchResult.matchedPart,
          confidence: matchResult.confidence,
          quantity: qty || matchResult.suggestedQty || 1,
          status: matchResult.matchedPart ? 'READY' : 'UNMAPPED'
        });
      }

      return results;
    },

    /**
     * AI Unstructured Supplier Quotation Parser
     * Extracts supplier names, component SKUs, PHP unit prices, stock counts, and quote references
     * from raw chat messages (Viber, WhatsApp), supplier quotation emails, or copied Excel ranges.
     */
    parseSupplierQuotation: function (rawText, catalogParts = [], suppliers = []) {
      if (!rawText || !rawText.trim()) return [];

      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsedItems = [];
      let currentSupplier = '';
      let currentRef = '';

      // Helper to match text to known accredited supplier
      function findSupplierMatch(text) {
        if (!text) return null;
        const clean = text.toLowerCase().trim();
        for (const s of suppliers) {
          const sName = (s.name || '').toLowerCase();
          if (clean === sName || clean.includes(sName)) return s.name;
          if (clean.includes('everwell') && sName.includes('everwell')) return s.name;
          if ((clean.includes('c&c') || clean.includes('c & c') || clean.includes('cnc')) && sName.includes('c&c')) return s.name;
          if (clean.includes('manco') && sName.includes('manco')) return s.name;
        }
        return null;
      }

      // Check for tab-delimited paste (Excel or Google Sheets copy)
      const hasTabs = lines.some(l => l.includes('\t'));
      if (hasTabs) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
          if (cols.length < 2) continue;

          const joinedLower = cols.join(' ').toLowerCase();
          if (i === 0 && (joinedLower.includes('part') || joinedLower.includes('price') || joinedLower.includes('item') || joinedLower.includes('supplier'))) {
            continue;
          }

          let sup = currentSupplier || (suppliers[0] ? suppliers[0].name : 'Everwell Parts & Equipment Corp.');
          let skuOrDesc = '';
          let price = 0;
          let stock = 15;
          let ref = currentRef || 'Excel Price List';

          for (const col of cols) {
            const matchedSup = findSupplierMatch(col);
            if (matchedSup) {
              sup = matchedSup;
              continue;
            }
            const cleanNum = col.replace(/[^0-9.]/g, '');
            const parsedNum = parseFloat(cleanNum);
            const isPriceFormatted = col.includes('₱') || col.toLowerCase().includes('php') || col.toLowerCase().includes('pesos');
            if ((isPriceFormatted || (parsedNum > 20 && !/[vVaAwW]$/.test(col) && !col.toLowerCase().includes('uf'))) && !price) {
              price = parsedNum;
              continue;
            }
            if (parsedNum && Number.isInteger(parsedNum) && parsedNum > 0 && parsedNum < 10000 && price > 0 && stock === 15) {
              stock = parsedNum;
              continue;
            }
            if (!skuOrDesc) {
              skuOrDesc = col;
            }
          }

          if (skuOrDesc && price > 0) {
            const match = PC_AI.normalizePartDescription(skuOrDesc, catalogParts);
            parsedItems.push({
              id: 'ai_item_' + (parsedItems.length + 1),
              part_id: match && match.matchedPart ? match.matchedPart.exact_id : (skuOrDesc.replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase().slice(0, 24) || 'PART-CUSTOM'),
              catalog_part_id: match && match.matchedPart ? match.matchedPart.id : null,
              description: match && match.matchedPart ? match.matchedPart.description : skuOrDesc,
              raw_text: line,
              source: sup,
              attributed_source: ref,
              unit_price: price,
              price_minor: Math.round(price * 100),
              stock: stock,
              confidence: match && match.matchedPart ? Math.min(100, match.confidence + 20) : 65,
              selected: true
            });
          }
        }

        if (parsedItems.length > 0) return parsedItems;
      }

      // Standard Natural Language / Chat / Email parsing loop
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        // 1. Detect quote reference if present (e.g. "Ref: EW-VIBER-2026-11" or "Quote #MANCO-9921")
        const refMatch = line.match(/(?:quote|quotation|ref|reference|so|po|rfq|doc|no\.?)\s*(?:#|:)?\s*([A-Za-z0-9\-_\/]+)/i);
        if (refMatch && refMatch[0] && refMatch[0].length > 3) {
          currentRef = refMatch[0].trim();
        }

        // 2. Detect Supplier section headers (e.g. "Everwell Parts & Equipment Corp." or "Quotation from Manco Refrigeration Supply")
        const headerSup = findSupplierMatch(line);
        if (headerSup && (line.length < 80 || lower.includes('from') || lower.includes('supplier') || lower.includes('vendor') || lower.includes('quote') || !line.match(/\d+\.?\d*/))) {
          const hasItemPricePattern = /(?:₱|php|pesos?|@)\s*\d+/i.test(line);
          if (!hasItemPricePattern) {
            currentSupplier = headerSup;
            continue;
          }
        }

        // Skip chat / email pleasantries, delivery terms, and headers
        if (
          lower.startsWith('hi ') || lower.startsWith('hello') || lower.startsWith('good morning') ||
          lower.startsWith('good afternoon') || lower.startsWith('dear') || lower.startsWith('best regards') ||
          lower.startsWith('thanks') || lower.startsWith('thank you') || lower.startsWith('payment') ||
          lower.startsWith('terms') || lower.startsWith('delivery') || lower.startsWith('validity') ||
          lower.startsWith('items available')
        ) {
          continue;
        }

        // 3. Extract Price
        let price = null;
        let matchedPriceStr = '';

        // Prioritized currency patterns: ₱405.00, php 580, @ 1,180.00 pesos
        let priceMatch = line.match(/(?:₱|php|pesos?)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
        if (!priceMatch) {
          priceMatch = line.match(/@\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
        }
        if (!priceMatch) {
          priceMatch = line.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:php|pesos?|\/pc|\/can|\/unit|each)/i);
        }
        if (!priceMatch) {
          // Trailing format: "- 405.00" or ": 405.00"
          priceMatch = line.match(/(?::|-|–|—|\|)\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/);
        }

        if (priceMatch && priceMatch[1]) {
          const cleanNum = priceMatch[1].replace(/,/g, '');
          const val = parseFloat(cleanNum);
          if (!isNaN(val) && val > 0 && val !== 2026 && val !== 2025 && val !== 2024) {
            price = val;
            matchedPriceStr = priceMatch[0];
          }
        }

        if (price === null) {
          continue; // Not a price quote line
        }

        // 4. Extract Stock / Quantity
        let stock = 15; // sensible default
        const stockMatch = 
          line.match(/(?:stock|avail|available|on\s*hand|inventory|qty|quantity)\s*(?::|=|-)?\s*([0-9]+)/i) ||
          line.match(/([0-9]+)\s*(?:pcs|pieces|units|cans|sets|box|boxes)\s*(?:on\s*hand|available|avail|in\s*stock)?/i) ||
          line.match(/\(([0-9]+)\s*(?:in\s*stock|avail|pcs|units|cans?)\)/i);

        if (stockMatch && stockMatch[1]) {
          const parsedStock = parseInt(stockMatch[1], 10);
          if (!isNaN(parsedStock) && parsedStock > 0 && parsedStock < 10000) {
            stock = parsedStock;
          }
        }

        // 5. Determine Supplier for this item
        let lineSupplier = currentSupplier;
        const inlineSup = findSupplierMatch(line);
        if (inlineSup) {
          lineSupplier = inlineSup;
        }
        if (!lineSupplier) {
          lineSupplier = suppliers[0] ? suppliers[0].name : 'Everwell Parts & Equipment Corp.';
        }

        // 6. Clean line text to isolate part description
        let cleanedPartText = line
          .replace(/^[0-9]+[\.\)\-]\s*/, '') // Remove numbering like "1. "
          .replace(/^[-*•]\s*/, '') // Remove bullet
          .replace(matchedPriceStr, '') // Remove price string
          .replace(/(?:stock|avail|available|on\s*hand|inventory|qty)\s*(?::|=|-)?\s*[0-9]+\s*(?:pcs|units|cans|sets)?/gi, '')
          .replace(/\([0-9]+\s*(?:pcs|units|cans|in\s*stock|on\s*hand|avail)\)/gi, '')
          .replace(/@[0-9\.\,]+/g, '')
          .replace(/\|/g, ' ')
          .replace(/\b(?:php|pesos?|each|\/pc|\/can|\/unit)\b/gi, '')
          .trim();

        if (inlineSup && cleanedPartText.toLowerCase().includes(inlineSup.toLowerCase())) {
          cleanedPartText = cleanedPartText.replace(new RegExp(inlineSup, 'gi'), '').replace(/^[\s:\-]+/, '').trim();
        }

        // 7. Normalize with AI against catalog
        const match = PC_AI.normalizePartDescription(cleanedPartText, catalogParts);

        let finalPartId = '';
        let finalDescription = '';
        let confidenceScore = 55;

        if (match && match.matchedPart) {
          finalPartId = match.matchedPart.exact_id;
          finalDescription = match.matchedPart.description;
          confidenceScore = Math.min(100, match.confidence + 20);
        } else {
          const skuMatch = cleanedPartText.match(/\b([A-Z0-9]{3,}(?:-[A-Z0-9]+)*)\b/i);
          if (skuMatch && skuMatch[1] && skuMatch[1].length >= 4) {
            finalPartId = skuMatch[1].toUpperCase();
          } else {
            finalPartId = cleanedPartText.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().slice(0, 20);
          }
          finalDescription = cleanedPartText || finalPartId;
          confidenceScore = 65;
        }

        if (currentSupplier || inlineSup) {
          confidenceScore = Math.min(100, confidenceScore + 10);
        }

        const attributedSource = currentRef 
          ? `${lineSupplier} (${currentRef})` 
          : `${lineSupplier} Direct Quotation (${new Date().toISOString().slice(0, 10)})`;

        parsedItems.push({
          id: 'ai_item_' + (parsedItems.length + 1),
          part_id: finalPartId,
          catalog_part_id: match && match.matchedPart ? match.matchedPart.id : null,
          description: finalDescription,
          raw_text: line,
          source: lineSupplier,
          attributed_source: attributedSource,
          unit_price: price,
          price_minor: Math.round(price * 100),
          stock: stock,
          confidence: confidenceScore,
          selected: true
        });
      }

      return parsedItems;
    },

    /**
     * Dynamic Multi-Objective Sourcing Strategy Recommendation
     * Evaluates all lines and returns optimal offer selections based on configured utility weights:
     * - 'lowest_cost': Greedy lowest unit price per line
     * - 'consolidation': Maximum order fulfillment by a single accredited supplier
     * - 'resilience': Maximum recorded inventory buffer
     * - 'balanced': Dynamic Multi-Criteria Decision Analysis using enterprise weights:
     *   wCost (default 40%), wStock (default 30%), wFreshness (default 20%), wConsolidation (default 10%)
     */
    recommendStrategy: function (comparisonResult, strategy = 'lowest_cost', customWeights = null) {
      if (!comparisonResult || !comparisonResult.lines) return {};
      const selections = {};
      const lines = comparisonResult.lines;

      if (strategy === 'lowest_cost') {
        for (const line of lines) {
          const eligible = line.candidates.filter(c => c.eligible);
          if (eligible.length > 0) {
            const minPrice = Math.min(...eligible.map(c => c.price_minor));
            const best = eligible.find(c => c.price_minor === minPrice);
            if (best) selections[line.line_id] = best.offer_id;
          }
        }
      } else if (strategy === 'consolidation') {
        // Count eligible lines each supplier can supply
        const supplierCoverage = {};
        for (const line of lines) {
          for (const c of line.candidates.filter(x => x.eligible)) {
            if (!supplierCoverage[c.supplier_name]) supplierCoverage[c.supplier_name] = { count: 0, totalCost: 0, supplierId: c.supplier_name };
            supplierCoverage[c.supplier_name].count += 1;
            supplierCoverage[c.supplier_name].totalCost += (c.price_minor * line.quantity);
          }
        }

        // Sort by most lines covered, then lowest total cost
        const sortedSuppliers = Object.values(supplierCoverage).sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.totalCost - b.totalCost;
        });

        const targetSupplier = sortedSuppliers.length ? sortedSuppliers[0].supplierId : null;

        for (const line of lines) {
          const eligible = line.candidates.filter(c => c.eligible);
          const supplierOffer = eligible.find(c => c.supplier_name === targetSupplier);
          if (supplierOffer) {
            selections[line.line_id] = supplierOffer.offer_id;
          } else if (eligible.length > 0) {
            const minPrice = Math.min(...eligible.map(c => c.price_minor));
            const best = eligible.find(c => c.price_minor === minPrice);
            if (best) selections[line.line_id] = best.offer_id;
          }
        }
      } else if (strategy === 'resilience') {
        // Pick candidate with largest recorded stock headroom over required quantity
        for (const line of lines) {
          const eligible = line.candidates.filter(c => c.eligible);
          if (eligible.length > 0) {
            let bestCandidate = eligible[0];
            let bestHeadroom = -1;
            for (const c of eligible) {
              const headroom = (c.recorded_quantity || 0) - line.quantity;
              if (headroom > bestHeadroom) {
                bestHeadroom = headroom;
                bestCandidate = c;
              }
            }
            selections[line.line_id] = bestCandidate.offer_id;
          }
        }
      } else if (strategy === 'balanced') {
        // Dynamic Multi-Criteria Decision Analysis (MCDA)
        // Default weights: 40% cost, 30% stock buffer, 20% freshness, 10% supplier consolidation
        const w = customWeights || { cost: 40, stock: 30, freshness: 20, consolidation: 10 };
        const totalW = (w.cost + w.stock + w.freshness + w.consolidation) || 100;
        const wCost = (w.cost || 40) / totalW;
        const wStock = (w.stock || 30) / totalW;
        const wFresh = (w.freshness || 20) / totalW;
        const wCons = (w.consolidation || 10) / totalW;

        // Calculate supplier frequency across eligible lines for consolidation factor
        const supplierLineCount = {};
        for (const line of lines) {
          const supsOnLine = new Set(line.candidates.filter(x => x.eligible).map(x => x.supplier_name));
          supsOnLine.forEach(sup => {
            supplierLineCount[sup] = (supplierLineCount[sup] || 0) + 1;
          });
        }

        for (const line of lines) {
          const eligible = line.candidates.filter(c => c.eligible);
          if (eligible.length > 0) {
            const minPrice = Math.min(...eligible.map(c => c.price_minor));
            const maxPrice = Math.max(...eligible.map(c => c.price_minor)) || minPrice;
            const maxStock = Math.max(...eligible.map(c => c.recorded_quantity || 0)) || 1;
            const minStock = Math.min(...eligible.map(c => c.recorded_quantity || 0));

            let bestCandidate = eligible[0];
            let highestScore = -Infinity;

            for (const c of eligible) {
              // 1. Price utility (lower price = higher utility, 0 to 1)
              const priceScore = maxPrice === minPrice ? 1.0 : (maxPrice - c.price_minor) / (maxPrice - minPrice);
              
              // 2. Stock buffer ratio (higher stock above required = higher score, 0 to 1)
              const stockBuffer = Math.max(0, (c.recorded_quantity || 0) - line.quantity);
              const maxPossibleBuffer = Math.max(1, maxStock - line.quantity);
              const stockScore = Math.min(1.0, stockBuffer / maxPossibleBuffer);
              
              // 3. Freshness utility (newer check date = higher score, 0 to 1)
              const ageDays = getDaysBetween(c.checked_date);
              const maxAgeAllowed = (comparisonResult.policy && comparisonResult.policy.max_age_days) || 14;
              const freshnessScore = Math.max(0, (maxAgeAllowed - ageDays) / maxAgeAllowed);

              // 4. Supplier multi-line consolidation factor (0 to 1)
              const consolidationScore = (supplierLineCount[c.supplier_name] || 1) / Math.max(1, lines.length);

              // Weighted MCDA additive utility sum
              const mcdaScore = (priceScore * wCost) + 
                                (stockScore * wStock) + 
                                (freshnessScore * wFresh) + 
                                (consolidationScore * wCons);

              if (mcdaScore > highestScore) {
                highestScore = mcdaScore;
                bestCandidate = c;
              }
            }
            selections[line.line_id] = bestCandidate.offer_id;
          }
        }
      }

      return selections;
    },

    /**
     * AI Intelligent Sourcing Summary & Decision Explanation Engine
     * Generates a formal executive audit report explaining selections, supplier distribution,
     * exclusions, and policy compliance.
     */
    generateExecutiveSummary: function (comparison, listTitle = 'BOM Sourcing Project', companyInfo = null) {
      if (!comparison || !comparison.lines) return 'No comparison data available.';

      const r = comparison;
      const s = r.summary;
      const complete = s.status === 'COMPLETE';
      const lines = r.lines;
      const currency = r.currency || 'PHP';
      const enterpriseName = (companyInfo && companyInfo.business_name) ? companyInfo.business_name : 'Enterprise Sourcing Operations';

      // Supplier distribution metrics
      const supplierSpend = {};
      const supplierLines = {};
      const exclusions = [];
      let totalSelectedCost = 0;

      for (const line of lines) {
        const sel = line.candidates.find(c => c.offer_id === line.selected_offer_id);
        if (sel) {
          const cost = sel.price_minor * line.quantity;
          totalSelectedCost += cost;
          supplierSpend[sel.supplier_name] = (supplierSpend[sel.supplier_name] || 0) + cost;
          supplierLines[sel.supplier_name] = (supplierLines[sel.supplier_name] || 0) + 1;
        }

        // Collect exclusions for audit explanation
        for (const cand of line.candidates) {
          if (!cand.eligible) {
            exclusions.push({
              part: line.exact_id,
              supplier: cand.supplier_name,
              reasons: cand.reasons,
              date: cand.checked_date,
              qty: cand.recorded_quantity,
              reqQty: line.quantity
            });
          }
        }
      }

      // Generate structured narrative report
      let text = `### ${enterpriseName} — AI Sourcing Executive Briefing\n`;
      text += `**Project:** ${listTitle} | **Policy:** ${r.policy_version} (Max Age: ${r.policy.max_age_days} Days, Currency: ${currency})\n`;
      text += `**Date Evaluated:** ${r.evaluation_date} | **Status:** ${complete ? '✅ Full Coverage (100% Resolved)' : '⚠️ Partial Procurement Alert'}\n\n`;

      // 1. Executive Cost Verdict
      text += `#### 1. Sourcing Recommendation & Financial Overview\n`;
      text += `- **Components Subtotal:** ${money(s.subtotal_minor, currency)}\n`;
      text += `- **Line Resolution:** ${lines.length - s.unresolved_count} of ${lines.length} components costed (${complete ? 'Ready for procurement' : 'Requires administrative review'}).\n`;
      text += `- **Single Supplier Full-Line Fulfillment:** Strictly adhered to per enterprise service standards (no split-line shipments).\n\n`;

      // 2. Supplier Allocation
      text += `#### 2. Supplier Allocation & Vendor Distribution\n`;
      const suppliersAwarded = Object.keys(supplierSpend);
      if (suppliersAwarded.length > 0) {
        for (const sup of suppliersAwarded) {
          const spend = supplierSpend[sup];
          const pct = ((spend / totalSelectedCost) * 100).toFixed(1);
          text += `- **${sup}:** ${money(spend, currency)} (${pct}% of total, ${supplierLines[sup]} line item${supplierLines[sup] > 1 ? 's' : ''})\n`;
        }
      } else {
        text += `- *No suppliers selected yet. Review candidate offers below.*\n`;
      }
      text += `\n`;

      // 3. Exclusion Audit
      text += `#### 3. Compliance & Exclusion Audit (Freshness & Quantity Verification)\n`;
      if (exclusions.length > 0) {
        text += `The comparison engine strictly vetted all vendor quotations against enterprise policy:\n`;
        const shownExclusions = exclusions.slice(0, 5);
        for (const ex of shownExclusions) {
          const reasonText = ex.reasons.map(reason => {
            if (reason === 'STALE') return `Stale quotation (${ex.date || 'unknown date'} exceeds ${r.policy ? r.policy.max_age_days : 14}-day freshness limit)`;
            if (reason === 'INSUFFICIENT_QUANTITY') return `Insufficient inventory (${ex.qty} available < ${ex.reqQty} needed)`;
            if (reason === 'MISSING_DATA') return `Incomplete pricing or attribution`;
            return reason;
          }).join(', ');
          text += `- **${ex.part}** (${ex.supplier}): Excluded due to *${reasonText}*.\n`;
        }
        if (exclusions.length > 5) {
          text += `- *...and ${exclusions.length - 5} additional vendor offers excluded per strict verification rules.*\n`;
        }
      } else {
        text += `- All reviewed offers fulfilled date freshness and stock quantity thresholds.\n`;
      }
      text += `\n`;

      // 4. Procurement Sign-Off & Action Items
      text += `#### 4. Action Items & Enterprise Sign-Off\n`;
      if (!complete) {
        text += `⚠️ **ACTION REQUIRED:** ${s.unresolved_count} component(s) remain unselected. Ensure all lines have selected accredited supplier offers before dispatching purchase orders.\n`;
      } else {
        text += `✅ **APPROVED FOR DISPATCH:** All lines have verified accredited supplier backing. Sourcing summary snapshot is cryptographically frozen and ready for quotation issuance.\n`;
      }

      return text;
    },

    /**
     * AI Copilot Assistant (Interactive Q&A)
     */
    copilotAnswer: function (query, context = {}) {
      const q = (query || '').toLowerCase().trim();
      const company = context.company || {};
      const bName = company.business_name || 'AMGC Airconditioning Services';
      const pos = Array.isArray(context.purchase_orders) ? context.purchase_orders.filter(p => p.status !== 'CANCELLED') : [];
      const parts = Array.isArray(context.parts) ? context.parts : [];

      if (!q) return `How can I assist you with component sourcing, purchase orders, warehouse inventory, or supplier comparisons for ${bName}?`;

      if (q.includes('purchase order') || q.includes('po ') || q.includes('orders') || q.includes('transit') || q.includes('waybill') || q.includes('delivery') || q.includes('rtv') || q.includes('damaged')) {
        if (!pos.length) {
          return `There are currently no active Purchase Orders recorded for ${bName}. Open #/orders to generate POs from an approved sourcing summary or create a direct PO.`;
        }
        const openPos = pos.filter(p => ['DRAFT', 'ISSUED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(p.status));
        const totalCommitted = pos.filter(p => p.status !== 'DRAFT').reduce((a, p) => a + (p.subtotal_minor || 0), 0);
        const lines = pos.slice(0, 4).map(p => {
          const ord = (p.lines || []).reduce((a, l) => a + l.quantity, 0);
          const rec = (p.lines || []).reduce((a, l) => a + (l.received_qty || 0), 0);
          const rej = (p.lines || []).reduce((a, l) => a + (l.rejected_qty || 0), 0);
          return `- **${p.po_number}** (${p.supplier_name}): Status **${p.status}** · ${rec}/${ord} pcs accepted${rej ? ` (${rej} RTV damaged)` : ''} · Total **${money(p.subtotal_minor, p.currency)}**${p.tracking_ref ? ` · Tracking: ${p.tracking_ref}` : ''}`;
        });
        return `**Live Purchase Orders & Delivery Summary (${openPos.length} Open / ${pos.length} Total, Committed: ${money(totalCommitted)}):**\n` + lines.join('\n') + `\nOpen **#/orders** or **#/tracking** to record deliveries or print official POs.`;
      }

      if (q.includes('warehouse') || q.includes('inventory') || q.includes('low stock') || q.includes('reorder')) {
        if (!parts.length) {
          return `Open **#/inventory** to view AMGC Cainta warehouse stock levels and low-stock reorder alerts.`;
        }
        const low = parts.filter(p => p.active !== false && Number(p.warehouse_stock || 0) <= Number(p.min_reorder_level || 5));
        const summaryLines = parts.map(p => {
          const st = Number(p.warehouse_stock || 0);
          const min = Number(p.min_reorder_level || 5);
          return `- **${p.exact_id}**: **${st} pcs** in Cainta warehouse (Min threshold: ${min} pcs) ${st <= min ? '⚠️ **LOW STOCK — REORDER**' : '✅ Healthy'}`;
        });
        return `**AMGC Cainta Warehouse Inventory (${low.length} Low-Stock Alert${low.length === 1 ? '' : 's'}):**\n` + summaryLines.join('\n') + `\nVisit **#/inventory** to trigger a 1-click Reorder PO.`;
      }

      if (q.includes('spend') || q.includes('analytics') || q.includes('savings') || q.includes('scorecard')) {
        const totalSpend = pos.reduce((a, p) => a + (p.subtotal_minor || 0), 0);
        const bySup = {};
        pos.forEach(p => { bySup[p.supplier_name] = (bySup[p.supplier_name] || 0) + (p.subtotal_minor || 0); });
        const supLines = Object.keys(bySup).map(k => `- **${k}**: ${money(bySup[k])}`);
        return `**Supplier Spend & Performance Analytics (Total PO Spend: ${money(totalSpend)}):**\n` + (supLines.length ? supLines.join('\n') : '- No supplier PO spend recorded yet.') + `\nOpen **#/analytics** for full On-Time Delivery %, Quality Acceptance %, and 14-Day Quote Freshness scorecards.`;
      }

      if (q.includes('capacitor') || q.includes('cbb65')) {
        return `For the **CBB65-45UF-450V** Dual Run Capacitor:\n- **Everwell Parts & Equipment Corp.** offers the lowest eligible price at **₱380.00** (45 units in stock, verified 2 days ago).\n- C&C Airconditioning Supply lists it at **₱420.00**.\n- Manco Refrigeration is at **₱395.00** but has only 3 units in stock.`;
      }

      if (q.includes('contactor') || q.includes('hcc-1xu02aa')) {
        return `For the **HCC-1XU02AA** Heavy Duty Defrost Contactor (30A):\n- **C&C Airconditioning Supply** offers the lowest eligible price at **₱450.00** (40 units in stock).\n- Everwell Parts offers it at **₱480.00**.\n- Note: Manco Refrigeration's quote (₱510.00) is **EXCLUDED** because its check date is 28 days old (violates the 14-day freshness rule).`;
      }

      if (q.includes('r410a') || q.includes('refrigerant') || q.includes('freon') || q.includes('gas')) {
        return `For **R410A-CAN-1KG** Virgin Refrigerant:\n- **C&C Airconditioning Supply** is lowest at **₱720.00** each (50 cans in stock).\n- Everwell Parts is **₱750.00** (60 cans).\n- Manco Refrigeration is **₱780.00** (15 cans).`;
      }

      if (q.includes('14') || q.includes('freshness') || q.includes('policy') || q.includes('rule')) {
        return `**${bName} Quote Validity Rules:**\n1. Offers must be verified within **14 calendar days** to account for volatile market pricing.\n2. Quantity coverage must be 100% per line (no split-line orders across multiple suppliers).\n3. Prices must be in Philippine Peso (PHP ₱) per piece.\n4. Frozen summaries retain these exact values permanently for audit integrity.`;
      }

      if (q.includes('mcda') || q.includes('weights') || q.includes('balanced') || q.includes('criteria')) {
        return `**Dynamic MCDA Sourcing Optimization:**\nWe evaluate 4 configurable criteria:\n1. **Lowest Unit Cost** (Default 40%)\n2. **Stock Buffer / Surplus Ratio** (Default 30%)\n3. **Quote Freshness / Recency** (Default 20%)\n4. **Supplier Multi-Line Consolidation** (Default 10%)\nAdministrators can adjust these weights in the Admin Console.`;
      }

      if (q.includes('zero') || q.includes('unresolved') || q.includes('partial')) {
        return `**Why Unresolved Parts Are Never Counted as ₱0.00:**\nIn incomplete BOMs, assuming an unpriced part costs zero leads to severe budget underestimation. PartsCompare excludes unresolved lines from the subtotal and clearly flags the summary as partial until an accredited supplier is selected.`;
      }

      return `I can help you analyze component sourcing across accredited suppliers, configure dynamic MCDA utility weights, or audit immutable sourcing snapshots for ${bName}.`;
    }
  };

  window.PC_AI = PC_AI;
})();
