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

export const DEFAULT_PRODUCT_ATTRIBUTES = {
  qualities: ['VIP', 'EVEREST', 'ANCHOR', 'DOUBLE', 'ORION', 'STAR', 'LOTUS', 'SUPER', 'GOLDY'],
  forms: ['Hanks', 'Packet', 'Cone', 'Small Hanks', 'Coils', 'Spools'],
  colors: ['Bright Yellow', 'Fluorescent Orange', 'Ocean Blue', 'Emerald Green', 'Milky White', 'Jet Black'],
  sizes: ['3x3', '4x3', '1.5', '2', '4', '6', '7.5'],
  lengths: ['100 Mtr', '200 Mtr', '300 Mtr', '500 Mtr', 'Standard'],
  tracerLines: ['No Tracer Line', 'Single Red Line', 'Double Blue Line', 'Green Tracer', 'Black Tracer']
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
        qualities: data.qualities?.length ? data.qualities : DEFAULT_PRODUCT_ATTRIBUTES.qualities,
        forms: data.forms?.length ? data.forms : DEFAULT_PRODUCT_ATTRIBUTES.forms,
        colors: data.colors?.length ? data.colors : DEFAULT_PRODUCT_ATTRIBUTES.colors,
        sizes: data.sizes?.length ? data.sizes : DEFAULT_PRODUCT_ATTRIBUTES.sizes,
        lengths: data.lengths?.length ? data.lengths : DEFAULT_PRODUCT_ATTRIBUTES.lengths,
        tracerLines: data.tracerLines?.length ? data.tracerLines : DEFAULT_PRODUCT_ATTRIBUTES.tracerLines
      });
    } else {
      // Initialize with default
      setDoc(docRef, {
        ...DEFAULT_PRODUCT_ATTRIBUTES,
        createdAt: serverTimestamp()
      }).catch(err => console.warn('Could not seed product attributes:', err));
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
}

/**
 * Helper to generate SKU code from combination
 */
export function generateSkuCode(quality, form, color, size, length, tracerLine) {
  const qCode = (quality || 'GEN').slice(0, 4).toUpperCase();
  const fCode = (form || 'HNK').slice(0, 3).toUpperCase();
  const cCode = (color || 'CLR').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const sCode = (size || 'STD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const lCode = length && length !== 'Standard' ? `-${length.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}` : '';
  const tCode = tracerLine && tracerLine !== 'No Tracer Line' ? `-${tracerLine.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}` : '';
  return `FG-${qCode}-${fCode}-${cCode}-${sCode}${lCode}${tCode}`;
}

/**
 * Generate Cartesian Matrix of SKUs
 */
export function generateMatrixCombinations(selectedQualities, selectedForms, selectedColors, selectedSizes, baseRate = 220, bagWeight = 50.0, selectedLengths = ['Standard'], selectedTracers = ['No Tracer Line']) {
  const combinations = [];
  const lengths = selectedLengths?.length ? selectedLengths : ['Standard'];
  const tracers = selectedTracers?.length ? selectedTracers : ['No Tracer Line'];

  for (const q of selectedQualities) {
    for (const f of selectedForms) {
      for (const c of selectedColors) {
        for (const s of selectedSizes) {
          for (const l of lengths) {
            for (const t of tracers) {
              const skuCode = generateSkuCode(q, f, c, s, l, t);
              const extraDesc = [l !== 'Standard' ? l : '', t !== 'No Tracer Line' ? t : ''].filter(Boolean).join(' • ');
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
