import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { addVendor, addBuyer } from './directory.api';
import { addRawMaterial, addFinishedGood } from './inventory.api';
import { createJobWork } from './jobwork.api';
import { createSalesOrder, createDispatch } from './sales.api';

const DEFAULT_VENDORS = [
  {
    name: 'Shree Plastic Works',
    location: 'Shapar-Veraval GIDC, Rajkot',
    phone: '+91 98250 12345',
    gst: '24AAAAA0000A1Z5',
    processBadge: 'Twisting & Braiding',
    rate: 18,
    pendingKg: 15400
  },
  {
    name: 'Maruti Monofilament Processors',
    location: 'Metoda GIDC, Rajkot',
    phone: '+91 98251 67890',
    gst: '24BBBBB1111B1Z6',
    processBadge: 'Extrusion & Drawing',
    rate: 22,
    pendingKg: 8200
  },
  {
    name: 'Radhe Rope Synthetics',
    location: 'Aji GIDC, Rajkot',
    phone: '+91 98252 54321',
    gst: '24CCCCC2222C1Z7',
    processBadge: 'Rope Winding & Packing',
    rate: 15,
    pendingKg: 4500
  }
];

const DEFAULT_BUYERS = [
  {
    name: 'ABC Marine Traders',
    location: 'Veraval Port, Gujarat',
    phone: '+91 98790 99887',
    gst: '24DDDDD3333D1Z8',
    category: 'Marine & Fishing Supplies',
    creditLimit: '₹50,000,000',
    outstandingAmount: '₹12,45,000',
    totalOrders: 42
  },
  {
    name: 'Gujarat Agro Corp',
    location: 'Anand, Gujarat',
    phone: '+91 98791 44556',
    gst: '24EEEEE4444E1Z9',
    category: 'Agricultural Hardware',
    creditLimit: '₹25,000,000',
    outstandingAmount: '₹4,80,000',
    totalOrders: 18
  },
  {
    name: 'Apex Shipping Supplies',
    location: 'Mundra Port, Kutch',
    phone: '+91 98792 11223',
    gst: '24FFFFF5555F1ZA',
    category: 'Shipping & Logistics',
    creditLimit: '₹75,000,000',
    outstandingAmount: '₹18,90,000',
    totalOrders: 29
  }
];

const DEFAULT_RAW_MATERIALS = [
  {
    code: 'RM-PP-GRAN-01',
    name: 'PP Granules (RIL H030SG)',
    brand: 'Reliance Polymers',
    grade: 'H030SG Raffia Grade',
    desc: 'High tenacity polypropylene virgin granules for monofilament yarn',
    availFactory: 25150,
    atJobWork: 15400,
    rate: 112,
    location: 'Factory Main Silo'
  },
  {
    code: 'RM-HDPE-GRAN-02',
    name: 'HDPE Granules (IOCL F5400)',
    brand: 'Indian Oil',
    grade: 'F5400 Film & Rope Grade',
    desc: 'High density polyethylene granules for heavy-duty ropes',
    availFactory: 12400,
    atJobWork: 8200,
    rate: 128,
    location: 'Warehouse Silo B'
  },
  {
    code: 'RM-MASTERBATCH-YL',
    name: 'Yellow Color Masterbatch (MB-YL-99)',
    brand: 'Clariant',
    grade: 'UV Stabilized Yellow',
    desc: 'UV-resistant yellow color concentrate for outdoor fishing ropes',
    availFactory: 1850,
    atJobWork: 450,
    rate: 340,
    location: 'Chemical Room 1'
  }
];

const DEFAULT_FINISHED_GOODS = [
  {
    code: 'FG-DAN-6MM-YL',
    name: 'PP Danline Rope 6mm (Yellow)',
    category: 'Danline Rope',
    desc: '3-Strand Hawser Laid Yellow PP Danline Rope - 220m Coil',
    stockQty: 4015,
    reservedQty: 500,
    rate: 2450,
    location: 'Finished Goods Bay 3'
  },
  {
    code: 'FG-MONO-12MM-BL',
    name: 'HDPE Monofilament Rope 12mm (Blue)',
    category: 'Monofilament Rope',
    desc: 'High tenacity marine grade blue HDPE rope - 110m Coil',
    stockQty: 1850,
    reservedQty: 250,
    rate: 5800,
    location: 'Finished Goods Bay 1'
  },
  {
    code: 'FG-BALING-TW-02',
    name: 'PP Baling Twine (White)',
    category: 'Twine',
    desc: 'Heavy duty agricultural baling twine spool 5 KG',
    stockQty: 3200,
    reservedQty: 400,
    rate: 890,
    location: 'Finished Goods Bay 4'
  }
];

export async function seedInitialData() {
  if (!db) return;

  try {
    const rawSnap = await getDocs(collection(db, 'rawMaterials'));
    if (!rawSnap.empty) {
      console.log('Database already seeded, skipping automatic seed.');
      return;
    }

    console.log('Seeding initial master data to Firestore...');

    // Seed Vendors & Buyers
    const vendorIds = [];
    for (const v of DEFAULT_VENDORS) {
      const id = await addVendor(v);
      vendorIds.push(id);
    }

    const buyerIds = [];
    for (const b of DEFAULT_BUYERS) {
      const id = await addBuyer(b);
      buyerIds.push(id);
    }

    // Seed Raw Materials & Finished Goods
    const rmIds = [];
    for (const rm of DEFAULT_RAW_MATERIALS) {
      const id = await addRawMaterial(rm);
      rmIds.push(id);
    }

    const fgIds = [];
    for (const fg of DEFAULT_FINISHED_GOODS) {
      const id = await addFinishedGood(fg);
      fgIds.push(id);
    }

    // Seed initial Job Work
    await createJobWork({
      jwNo: 'JW-2026-0088',
      chNo: 'CH-JW-2026-0088',
      date: '2026-08-20',
      vendor: 'Shree Plastic Works',
      vendorId: vendorIds[0],
      rawMat: 'PP Granules (RIL H030SG)',
      rawMaterialId: rmIds[0],
      sentQtyKg: 5000,
      expectedFg: '4,800 KG (6mm Danline)',
      remarks: 'Initial sample job work order'
    });

    // Seed initial Sales Order
    const soId = await createSalesOrder({
      orderNo: 'SO-2026-00888',
      poRef: 'PO: ABC-PORT-88',
      date: '2026-08-22',
      customer: 'ABC Marine Traders',
      customerId: buyerIds[0],
      itemSummary: 'PP Danline Rope 6mm (Yellow)',
      fgSkuId: fgIds[0],
      orderedQtyCoils: 300,
      orderValue: '₹7,35,000'
    });

    // Seed initial Dispatch
    await createDispatch({
      dispatchNo: 'DSP-2026-00088',
      date: '2026-08-24',
      customer: 'ABC Marine Traders',
      orderRef: 'Ref: SO-2026-00888',
      soId: soId,
      fgSkuId: fgIds[0],
      dispatchedQtyCoils: 100,
      totalOrderedCoils: 300,
      currentDispatchedCoils: 0,
      challanNo: 'DC-2026-0088',
      taxInvoice: 'INV-2026-0088',
      value: '₹2,45,000',
      vehicle: 'GJ-03-BW-1234',
      transporter: 'Shree Saurashtra Roadlines'
    });

    console.log('Successfully seeded initial master data!');
  } catch (error) {
    console.error('Error seeding initial data:', error);
  }
}
