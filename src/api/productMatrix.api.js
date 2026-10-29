import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  getDocs,
  serverTimestamp,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { logAuditEvent } from './audit.api';

export const DEFAULT_PRODUCT_ATTRIBUTES = {
  qualities: ['VIP', 'EVEREST', 'ANCHOR', 'DOUBLE', 'ORION', 'STAR', 'LOTUS', 'SUPER', 'GOLDY'],
  forms: ['Hanks', 'Packet', 'Cone', 'Small Hanks', 'Coils', 'Spools'],
  colors: ['Bright Yellow', 'Fluorescent Orange', 'Ocean Blue', 'Emerald Green', 'Milky White', 'Jet Black'],
  sizes: ['3x3', '4x3', '1.5', '2', '4', '6', '7.5'],
  lengths: ['100 Mtr', '200 Mtr', '300 Mtr', '500 Mtr', 'Standard'],
  tracerLines: ['No Tracer Line', 'Single Red Line', 'Double Blue Line', 'Green Tracer', 'Black Tracer'],
  meterMarkings: ['Meter Marking', 'Non-Meter Marking']
};

/**
 * Subscribe to product attributes
 */
export function subscribeProductAttributes(callback) {
  if (!db) {
    callback(DEFAULT_PRODUCT_ATTRIBUTES);
    return () => {};
  }

  const docRef = doc(db, 'settings', 'productAttributes');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback({
        qualities: Array.isArray(data.qualities) ? data.qualities : DEFAULT_PRODUCT_ATTRIBUTES.qualities,
        forms: Array.isArray(data.forms) ? data.forms : DEFAULT_PRODUCT_ATTRIBUTES.forms,
        colors: Array.isArray(data.colors) ? data.colors : DEFAULT_PRODUCT_ATTRIBUTES.colors,
        sizes: Array.isArray(data.sizes) ? data.sizes : DEFAULT_PRODUCT_ATTRIBUTES.sizes,
        lengths: Array.isArray(data.lengths) ? data.lengths : DEFAULT_PRODUCT_ATTRIBUTES.lengths,
        tracerLines: Array.isArray(data.tracerLines) ? data.tracerLines : DEFAULT_PRODUCT_ATTRIBUTES.tracerLines,
        meterMarkings: Array.isArray(data.meterMarkings) ? data.meterMarkings : DEFAULT_PRODUCT_ATTRIBUTES.meterMarkings
      });
    } else {
      callback(DEFAULT_PRODUCT_ATTRIBUTES);
    }
  }, (err) => {
    console.error('Error fetching product attributes:', err);
    callback(DEFAULT_PRODUCT_ATTRIBUTES);
  });
}

/**
 * Update product attributes
 */
export async function updateProductAttributes(attributes) {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, 'settings', 'productAttributes');
  await setDoc(docRef, {
    ...attributes,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logAuditEvent({
    category: 'MASTER_DATA',
    action: 'PRODUCT_ATTRIBUTES_UPDATED',
    summary: 'Updated Product Matrix Master Attributes (Qualities, Colors, Sizes, Forms)',
    targetId: 'productAttributes',
    details: { attributes }
  });
}

/**
 * Helper to generate SKU code from combination
 */
export function generateSkuCode(quality, form, color, size, length, tracerLine, meterMarking) {
  const qCode = (quality || 'GEN').slice(0, 4).toUpperCase();
  const fCode = (form || 'HNK').slice(0, 3).toUpperCase();
  const cCode = (color || 'CLR').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const sCode = (size || 'STD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const lCode = length && length !== 'Standard' ? `-${length.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}` : '';
  const tCode = tracerLine && tracerLine !== 'No Tracer Line' ? `-${tracerLine.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}` : '';
  const mCode = meterMarking && meterMarking === 'Meter Marking' ? '-MM' : '';
  return `FG-${qCode}-${fCode}-${cCode}-${sCode}${lCode}${tCode}${mCode}`;
}

/**
 * Generate Cartesian Matrix of SKUs
 */
export function generateMatrixCombinations(
  selectedQualities,
  selectedForms,
  selectedColors,
  selectedSizes,
  baseRate = 220,
  bagWeight = 50.0,
  selectedLengths = ['Standard'],
  selectedTracers = ['No Tracer Line'],
  selectedMeterMarkings = ['Non-Meter Marking']
) {
  const combinations = [];
  const lengths = selectedLengths?.length ? selectedLengths : ['Standard'];
  const tracers = selectedTracers?.length ? selectedTracers : ['No Tracer Line'];
  const meterMarkings = selectedMeterMarkings?.length ? selectedMeterMarkings : ['Non-Meter Marking'];

  for (const q of selectedQualities) {
    for (const f of selectedForms) {
      for (const c of selectedColors) {
        for (const s of selectedSizes) {
          for (const l of lengths) {
            for (const t of tracers) {
              for (const m of meterMarkings) {
                const skuCode = generateSkuCode(q, f, c, s, l, t, m);
                const extraDesc = [
                  l !== 'Standard' ? l : '',
                  t !== 'No Tracer Line' ? t : '',
                  m !== 'Non-Meter Marking' ? m : ''
                ].filter(Boolean).join(' • ');
                const name = `${q} ${f} - ${s} (${c})${extraDesc ? ' [' + extraDesc + ']' : ''}`;
                combinations.push({
                  id: skuCode,
                  skuCode,
                  name,
                  quality: q,
                  form: f,
                  color: c,
                  size: s,
                  length: l,
                  tracerLine: t,
                  meterMarking: m,
                  category: 'Danline & Fishing Twine',
                  standardBagWeightKg: Number(bagWeight) || 50.0,
                  ratePerKg: Number(baseRate) || 220,
                  stockQty: 0
                });
              }
            }
          }
        }
      }
    }
  }

  return combinations;
}

/**
 * Sync / Bulk Insert generated SKUs into finishedGoods collection using batched commits
 */
export async function syncMatrixToFinishedGoods(skuList, maxLimit = 1500) {
  if (!db) throw new Error('Firestore not initialized');

  const listToSync = skuList.slice(0, maxLimit);
  const CHUNK_SIZE = 400;
  let addedCount = 0;

  await logAuditEvent({
    category: 'MASTER_DATA',
    action: 'PRODUCT_MATRIX_SYNCED',
    summary: `Synced ${listToSync.length} generated matrix SKUs to Finished Goods Catalog`,
    targetId: 'finishedGoods',
    details: { count: listToSync.length }
  });

  for (let i = 0; i < listToSync.length; i += CHUNK_SIZE) {
    const chunk = listToSync.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const sku of chunk) {
      const docRef = doc(db, 'finishedGoods', sku.skuCode);
      batch.set(docRef, {
        code: sku.skuCode,
        name: sku.name,
        category: sku.category || 'Danline Twine',
        quality: sku.quality,
        form: sku.form,
        diaColor: `${sku.size} • ${sku.color}`,
        size: sku.size,
        length: sku.length || 'Standard',
        tracerLine: sku.tracerLine || 'None',
        meterMarking: sku.meterMarking || 'Non-Meter Marking',
        rate: sku.ratePerKg,
        standardBagWeightKg: sku.standardBagWeightKg,
        stockQty: 0,
        reservedQty: 0,
        freeStockQty: 0,
        reorderLevel: 50,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
    addedCount += chunk.length;
  }
  return addedCount;
}
