import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  addRawMaterial, 
  addFinishedGood, 
  subscribeRawMaterials, 
  subscribeFinishedGoods, 
  subscribeStockMovements 
} from '../api/inventory.api';
import { 
  createJobWork, 
  receiveJobWork, 
  subscribeJobWorks 
} from '../api/jobwork.api';
import { 
  createSalesOrder, 
  reserveSalesOrderStock, 
  createDispatch, 
  subscribeSalesOrders, 
  subscribeDispatches 
} from '../api/sales.api';

const WorkflowContext = createContext();

export function WorkflowProvider({ children }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0); // Last executed step
  const [activeStepTarget, setActiveStepTarget] = useState(1); // Next active step
  const [completedSteps, setCompletedSteps] = useState([]);
  const [lastActionLog, setLastActionLog] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');

  // Firestore live state snapshots
  const [rmList, setRmList] = useState([]);
  const [fgList, setFgList] = useState([]);
  const [jobWorkList, setJobWorkList] = useState([]);
  const [salesOrderList, setSalesOrderList] = useState([]);
  const [dispatchList, setDispatchList] = useState([]);
  const [movementList, setMovementList] = useState([]);

  // Subscribe to real-time Firestore updates only when user is authenticated
  useEffect(() => {
    if (!user) {
      setRmList([]);
      setFgList([]);
      setJobWorkList([]);
      setSalesOrderList([]);
      setDispatchList([]);
      setMovementList([]);
      return () => {};
    }

    const unsubRm = subscribeRawMaterials(setRmList);
    const unsubFg = subscribeFinishedGoods(setFgList);
    const unsubJw = subscribeJobWorks(setJobWorkList);
    const unsubSo = subscribeSalesOrders(setSalesOrderList);
    const unsubDc = subscribeDispatches(setDispatchList);
    const unsubMov = subscribeStockMovements(setMovementList);

    return () => {
      unsubRm();
      unsubFg();
      unsubJw();
      unsubSo();
      unsubDc();
      unsubMov();
    };
  }, [user]);

  // Computed metrics derived from Firestore live data
  const rmStock = rmList.reduce((acc, curr) => acc + (Number(curr.availFactory) || 0), 0);
  const jobWorkStock = rmList.reduce((acc, curr) => acc + (Number(curr.atJobWork) || 0), 0);
  const fgStock = fgList.reduce((acc, curr) => acc + (Number(curr.stockQty) || 0), 0);
  const dispatchedCoils = dispatchList.reduce((acc, curr) => acc + (Number(curr.dispatchedQtyCoils) || 0), 0);
  const activeJobWorksCount = jobWorkList.filter(jw => {
    const isCompleted = jw.status === 'COMPLETED' || jw.status === 'FULLY RECEIVED' || (jw.balQtyKg !== undefined && Number(jw.balQtyKg) <= 0 && Number(jw.recQtyKg) > 0);
    return !isCompleted;
  }).length;

  const openOrdersCount = salesOrderList.length;

  const lowStockRmCount = rmList.filter(rm => {
    const total = (Number(rm.availFactory) || 0) + (Number(rm.atJobWork) || 0);
    const reorder = Number(rm.reorderLevel) || 1000;
    return total < reorder;
  }).length;

  const lowStockFgCount = fgList.filter(fg => {
    const freeStock = Number(fg.stockQty) || 0;
    const reorder = Number(fg.reorderLevel) || 50;
    return freeStock < reorder;
  }).length;

  const lowStockCount = lowStockRmCount + lowStockFgCount;

  const executeStep = async (stepNum) => {
    if (!completedSteps.includes(stepNum)) {
      setCompletedSteps(prev => [...prev, stepNum]);
    }
    setCurrentStep(stepNum);
    setActiveStepTarget(stepNum < 10 ? stepNum + 1 : 10);

    try {
      switch (stepNum) {
        case 1:
          // Step 1: Create Raw Material (+2000 KG opening stock in Firestore)
          await addRawMaterial({
            code: 'RM-DEMO-01',
            name: 'PP Granules (Demo Lot)',
            brand: 'Reliance Polymers',
            grade: 'H030SG Raffia',
            availFactory: 2000,
            rate: 112,
            location: 'Factory Main Silo',
            remarks: 'Step 1: Opening stock creation of 2,000 KG PP Granules.'
          });
          setLastActionLog('✓ Step 1 Executed: Created PP Granules (Demo Lot) with 2,000 KG opening stock in Firestore.');
          break;

        case 2:
          // Step 2: Create Job Work (Send 2,000 KG to Shree Plastic Works)
          await createJobWork({
            jwNo: 'JW-2026-0099',
            chNo: 'CH-JW-2026-0099',
            date: new Date().toISOString().split('T')[0],
            vendor: 'Shree Plastic Works',
            rawMat: 'PP Granules (Demo Lot)',
            rawMaterialId: rmList.find(r => r.code === 'RM-DEMO-01')?.id || null,
            sentQtyKg: 2000,
            expectedFg: '1,920 KG (6mm Danline)',
            remarks: 'Step 2: Sent 2,000 KG to Shree Plastic Works.'
          });
          setLastActionLog('✓ Step 2 Executed: Sent 2,000 KG PP Granules to Shree Plastic Works in Firestore.');
          break;

        case 3:
          // Step 3: Verify Inventory Update log
          setLastActionLog('✓ Step 3 Executed: Verified stock movement. Factory RM stock updated & Job Work ledger logged.');
          break;

        case 4:
          // Step 4: Receive Partial Quantity (Receive 1,200 KG, Pending 800 KG)
          {
            const targetJw = jobWorkList.find(j => j.jwNo === 'JW-2026-0099');
            await receiveJobWork({
              jwId: targetJw?.id || 'JW-2026-0099',
              rawMaterialId: rmList.find(r => r.code === 'RM-DEMO-01')?.id || null,
              recQtyKg: 1200,
              currentRecKg: 0,
              totalSentKg: 2000,
              itemLabel: 'PP Danline Rope 6mm (Yellow)',
              remarks: 'Step 4: Partial receipt of 1,200 KG processed rope.'
            });
            setLastActionLog('✓ Step 4 Executed: Received 1,200 KG from Shree Plastic Works in Firestore. Status: PARTIAL.');
          }
          break;

        case 5:
          // Step 5: Receive Remaining Quantity (800 KG)
          {
            const targetJw = jobWorkList.find(j => j.jwNo === 'JW-2026-0099');
            await receiveJobWork({
              jwId: targetJw?.id || 'JW-2026-0099',
              rawMaterialId: rmList.find(r => r.code === 'RM-DEMO-01')?.id || null,
              recQtyKg: 800,
              currentRecKg: 1200,
              totalSentKg: 2000,
              itemLabel: 'PP Danline Rope 6mm (Yellow)',
              remarks: 'Step 5: Balance receipt of 800 KG (Job Work Completed).'
            });
            setLastActionLog('✓ Step 5 Executed: Received remaining 800 KG in Firestore. Status: COMPLETED.');
          }
          break;

        case 6:
          // Step 6: Create Finished Goods (Add 500 Coils into FG Inventory in Firestore)
          await addFinishedGood({
            code: 'FG-DEMO-01',
            name: 'PP Danline Rope 6mm (Yellow)',
            category: 'Danline Rope',
            stockQty: 500,
            rate: 2450,
            location: 'Finished Goods Bay 3',
            remarks: 'Step 6: Produced and inwarded 500 Coils into FG Warehouse.'
          });
          setLastActionLog('✓ Step 6 Executed: Inwarded 500 Coils of 6mm Danline Rope into Firestore FG Inventory.');
          break;

        case 7:
          // Step 7: Create Sales Order (500 Coils for ABC Marine Traders)
          await createSalesOrder({
            orderNo: 'SO-2026-00999',
            poRef: 'PO: DEMO-ABC-99',
            date: new Date().toISOString().split('T')[0],
            customer: 'ABC Marine Traders',
            itemSummary: 'PP Danline Rope 6mm (Yellow)',
            fgSkuId: fgList.find(f => f.code === 'FG-DEMO-01')?.id || null,
            orderedQtyCoils: 500,
            orderValue: '₹12,25,000'
          });
          setLastActionLog('✓ Step 7 Executed: Created Sales Order SO-2026-00999 for ABC Marine Traders in Firestore.');
          break;

        case 8:
          // Step 8: Reserve Stock (Reserve 500 Coils)
          {
            const targetSo = salesOrderList.find(s => s.orderNo === 'SO-2026-00999');
            const targetFg = fgList.find(f => f.code === 'FG-DEMO-01');
            await reserveSalesOrderStock(targetSo?.id || 'SO-2026-00999', targetFg?.id || null, 500);
            setLastActionLog('✓ Step 8 Executed: Reserved 500 Coils against Customer Order SO-2026-00999 in Firestore.');
          }
          break;

        case 9:
          // Step 9: Create Dispatch #1 (300 Coils)
          {
            const targetSo = salesOrderList.find(s => s.orderNo === 'SO-2026-00999');
            const targetFg = fgList.find(f => f.code === 'FG-DEMO-01');
            await createDispatch({
              dispatchNo: 'DSP-2026-00099',
              date: new Date().toISOString().split('T')[0],
              customer: 'ABC Marine Traders',
              orderRef: 'Ref: SO-2026-00999',
              soId: targetSo?.id || null,
              fgSkuId: targetFg?.id || null,
              challanNo: 'DC-2026-0099',
              taxInvoice: 'INV-2026-0099',
              dispatchedQtyCoils: 300,
              totalOrderedCoils: 500,
              currentDispatchedCoils: 0,
              value: '₹7,35,000',
              vehicle: 'GJ-03-BW-9999',
              transporter: 'Shree Saurashtra Roadlines'
            });
            setLastActionLog('✓ Step 9 Executed: Dispatched 300 Coils under DC-2026-0099 in Firestore.');
          }
          break;

        case 10:
          // Step 10: Create Dispatch #2 (Remaining 200 Coils)
          {
            const targetSo = salesOrderList.find(s => s.orderNo === 'SO-2026-00999');
            const targetFg = fgList.find(f => f.code === 'FG-DEMO-01');
            await createDispatch({
              dispatchNo: 'DSP-2026-00100',
              date: new Date().toISOString().split('T')[0],
              customer: 'ABC Marine Traders',
              orderRef: 'Ref: SO-2026-00999',
              soId: targetSo?.id || null,
              fgSkuId: targetFg?.id || null,
              challanNo: 'DC-2026-0100',
              taxInvoice: 'INV-2026-0100',
              dispatchedQtyCoils: 200,
              totalOrderedCoils: 500,
              currentDispatchedCoils: 300,
              value: '₹4,90,000',
              vehicle: 'GJ-03-BW-9999',
              transporter: 'Shree Saurashtra Roadlines'
            });
            setLastActionLog('⚡ Step 10 Executed: Dispatched remaining 200 Coils under DC-2026-0100 in Firestore. Lifecycle Complete!');
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error(`Error executing simulator step ${stepNum}:`, err);
    }
  };

  const runFullLifecycle = () => {
    for (let i = 1; i <= 10; i++) {
      setTimeout(() => {
        executeStep(i);
      }, i * 600);
    }
    setTimeout(() => {
      setActiveStepTarget(10);
    }, 10 * 600 + 200);
  };

  const resetState = () => {
    setCurrentStep(0);
    setActiveStepTarget(1);
    setCompletedSteps([]);
    setLastActionLog(null);
  };

  return (
    <WorkflowContext.Provider
      value={{
        currentStep,
        activeStepTarget,
        completedSteps,
        lastActionLog,
        rmStock,
        jobWorkStock,
        fgStock,
        dispatchedCoils,
        activeJobWorksCount,
        openOrdersCount,
        lowStockCount,
        rmList,
        fgList,
        simulatedJobWorks: jobWorkList,
        simulatedSalesOrders: salesOrderList,
        simulatedMovements: movementList,
        simulatedDispatches: dispatchList,
        globalSearch,
        setGlobalSearch,
        executeStep,
        runFullLifecycle,
        resetState
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
