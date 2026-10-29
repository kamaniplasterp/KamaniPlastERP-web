import { showAlert } from '../context/CustomAlertContext';

/**
 * Utility to generate and print professional industrial Bag Stickers / Labels (Change 7)
 * Layout: Serial No. | Weight (KG) | Item Name | Form | Color | Batch No. | Barcode representation
 */

export function generateBagStickerHtml(bag) {
  const stdWt = Number(bag.standardWeightKg || 50).toFixed(1);
  const actWt = Number(bag.actualWeightKg || bag.standardWeightKg || 50).toFixed(1);
  const bagNo = bag.bagNumber || '0000';
  const quality = bag.quality || 'STANDARD POLYMER';
  const form = bag.form || 'HANK';
  const color = bag.color || 'NATURAL';
  const size = bag.size || '3×3';
  const coils = bag.coilCount || 10;
  const batchNo = bag.batchNumber || bag.batch || bag.lotNo || bag.lotBatch || bag.lotGroup || (bag.inwardSlipNo ? `LOT-${bag.inwardSlipNo}` : 'N/A');
  const location = bag.location || 'KPI Factory Main';
  const dateStr = bag.date || new Date().toISOString().split('T')[0];
  const barcodeNumber = `KP-${String(bagNo).padStart(6, '0')}`;

  return `
    <div class="sticker-card">
      <div class="sticker-header">
        <div class="company-name">KAMANI PLASTIC INDUSTRIES</div>
        <div class="company-sub">Dhoraji, Rajkot | GIDC Phase-II | Q.C. CERTIFIED</div>
      </div>

      <div class="sticker-badge-row">
        <div class="bag-number-box">
          <div class="bag-lbl">BAG SERIAL NO.</div>
          <div class="bag-val">#${bagNo}</div>
        </div>
        <div class="bag-weight-box">
          <div class="wt-lbl">ACTUAL WEIGHT</div>
          <div class="wt-val">${actWt} <span class="wt-unit">KG</span></div>
          <div class="std-note">Std: ${stdWt} KG</div>
        </div>
      </div>

      <div class="sticker-grid">
        <div class="grid-item">
          <span class="lbl">QUALITY / GRADE</span>
          <span class="val">${quality}</span>
        </div>
        <div class="grid-item">
          <span class="lbl">FORM / TYPE</span>
          <span class="val">${form}</span>
        </div>
        <div class="grid-item">
          <span class="lbl">SIZE / SPEC</span>
          <span class="val">${size}</span>
        </div>
        <div class="grid-item">
          <span class="lbl">COLOR</span>
          <span class="val">${color}</span>
        </div>
        <div class="grid-item">
          <span class="lbl">COIL COUNT</span>
          <span class="val">${coils} Coils</span>
        </div>
        <div class="grid-item">
          <span class="lbl">BATCH / LOT NO.</span>
          <span class="val">${batchNo}</span>
        </div>
      </div>

      <div class="barcode-section">
        <div class="barcode-bars">
          <!-- Stylized CSS industrial barcode representation -->
          <div class="bar b3"></div><div class="bar b1"></div><div class="bar b2"></div><div class="bar b4"></div>
          <div class="bar b1"></div><div class="bar b3"></div><div class="bar b2"></div><div class="bar b1"></div>
          <div class="bar b4"></div><div class="bar b2"></div><div class="bar b1"></div><div class="bar b3"></div>
          <div class="bar b2"></div><div class="bar b4"></div><div class="bar b1"></div><div class="bar b3"></div>
          <div class="bar b1"></div><div class="bar b2"></div><div class="bar b4"></div><div class="bar b3"></div>
          <div class="bar b2"></div><div class="bar b1"></div><div class="bar b3"></div><div class="bar b2"></div>
          <div class="bar b4"></div><div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div>
          <div class="bar b1"></div><div class="bar b4"></div><div class="bar b2"></div><div class="bar b3"></div>
        </div>
        <div class="barcode-text">* ${barcodeNumber} *</div>
      </div>

      <div class="sticker-footer">
        <span>LOC: ${location}</span>
        <span>DATE: ${dateStr}</span>
        <span>AUTH: CHECKED</span>
      </div>
    </div>
  `;
}

/**
 * Print single bag sticker
 */
export function printSingleBagSticker(bag) {
  if (!bag) return;
  printMultipleBagStickers([bag]);
}

/**
 * Print multiple bag stickers (batch)
 */
export function printMultipleBagStickers(bagsArray) {
  if (!bagsArray || bagsArray.length === 0) {
    showAlert('No bags selected for sticker printing.', { type: 'warning', title: 'Selection Notice' });
    return;
  }

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    showAlert('Pop-up blocked. Please allow pop-ups for KamaniPlast ERP to print stickers.', { type: 'warning', title: 'Pop-up Blocked' });
    return;
  }

  const stickersHtml = bagsArray.map(b => generateBagStickerHtml(b)).join('\n');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>KamaniPlast - Bag Stickers (${bagsArray.length})</title>
        <style>
          @page {
            size: 100mm 75mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
          }
          .sticker-card {
            width: 95mm;
            height: 72mm;
            border: 2px solid #0f172a;
            border-radius: 6px;
            padding: 8px 10px;
            margin: 0 auto 15px auto;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justifyContent: space-between;
            background: #ffffff;
          }
          .sticker-card:last-child {
            page-break-after: auto;
          }
          .sticker-header {
            text-align: center;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 4px;
          }
          .company-name {
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 0.05em;
            color: #0f172a;
          }
          .company-sub {
            font-size: 7.5px;
            font-weight: 600;
            color: #475569;
            margin-top: 1px;
          }
          .sticker-badge-row {
            display: flex;
            justifyContent: space-between;
            align-items: center;
            margin: 6px 0;
            gap: 8px;
          }
          .bag-number-box {
            background: #0f172a;
            color: #ffffff;
            padding: 4px 10px;
            border-radius: 4px;
            flex: 1;
          }
          .bag-lbl {
            font-size: 7px;
            font-weight: 700;
            color: #94a3b8;
            letter-spacing: 0.04em;
          }
          .bag-val {
            font-size: 18px;
            font-weight: 900;
            line-height: 1.1;
          }
          .bag-weight-box {
            border: 2px solid #0f172a;
            padding: 3px 10px;
            border-radius: 4px;
            text-align: right;
            flex: 1;
          }
          .wt-lbl {
            font-size: 7px;
            font-weight: 700;
            color: #64748b;
          }
          .wt-val {
            font-size: 17px;
            font-weight: 900;
            color: #16a34a;
            line-height: 1.1;
          }
          .wt-unit {
            font-size: 10px;
            font-weight: 700;
            color: #0f172a;
          }
          .std-note {
            font-size: 7px;
            color: #64748b;
            font-weight: 600;
          }
          .sticker-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3px 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 8px;
          }
          .grid-item {
            display: flex;
            flex-direction: column;
          }
          .lbl {
            font-size: 6.5px;
            font-weight: 700;
            color: #64748b;
          }
          .val {
            font-size: 8.5px;
            font-weight: 800;
            color: #0f172a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .barcode-section {
            text-align: center;
            margin: 4px 0 2px 0;
          }
          .barcode-bars {
            height: 22px;
            display: flex;
            align-items: stretch;
            justify-content: center;
            gap: 1.5px;
          }
          .bar {
            background: #0f172a;
          }
          .b1 { width: 1.5px; }
          .b2 { width: 3px; }
          .b3 { width: 4.5px; }
          .b4 { width: 6px; }
          .barcode-text {
            font-family: monospace;
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.15em;
            margin-top: 1px;
            color: #334155;
          }
          .sticker-footer {
            display: flex;
            justifyContent: space-between;
            font-size: 6.5px;
            font-weight: 700;
            color: #64748b;
            border-top: 1px dashed #cbd5e1;
            padding-top: 3px;
          }
          @media screen {
            body {
              background: #f1f5f9;
              padding: 20px;
            }
            .sticker-card {
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              margin-bottom: 20px;
            }
          }
        </style>
      </head>
      <body>
        ${stickersHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}
