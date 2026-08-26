import React from 'react';
import { Sparkles, X, Play, RotateCcw, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import '../styles/WorkflowSimulatorModal.css';

export default function WorkflowSimulatorModal({ isOpen, onClose }) {
  const {
    currentStep,
    activeStepTarget,
    completedSteps,
    lastActionLog,
    executeStep,
    runFullLifecycle,
    resetState
  } = useWorkflow();

  if (!isOpen) return null;

  const steps = [
    {
      num: 1,
      title: 'Step 1: Create Raw Material',
      desc: 'Create PP Granules (Demo Lot) with 2,000 KG opening stock in factory.'
    },
    {
      num: 2,
      title: 'Step 2: Create Job Work',
      desc: 'Send 2,000 KG PP Granules to Shree Plastic Works (Expected output: 1,920 KG).'
    },
    {
      num: 3,
      title: 'Step 3: Verify Inventory Update',
      desc: 'Factory available stock reduces by 2,000 KG, "Material at Job Work" increases by 2,000 KG.'
    },
    {
      num: 4,
      title: 'Step 4: Receive Partial Quantity',
      desc: 'Receive 1,200 KG. Job Work status becomes Partially Received (Pending: 800 KG).'
    },
    {
      num: 5,
      title: 'Step 5: Receive Remaining Quantity',
      desc: 'Receive balance remaining. Job Work status becomes Completed / Fully Received.'
    },
    {
      num: 6,
      title: 'Step 6: Create Finished Goods',
      desc: 'Add 500 Coils of PP Danline Rope 6mm into Finished Goods Inventory.'
    },
    {
      num: 7,
      title: 'Step 7: Create Sales Order',
      desc: 'Create Customer Sales Order for ABC Marine Traders (500 Coils of 6mm Danline).'
    },
    {
      num: 8,
      title: 'Step 8: Reserve Stock',
      desc: 'Reserve 500 Coils of finished goods stock against the customer order.'
    },
    {
      num: 9,
      title: 'Step 9: Create Dispatch #1 (300 Coils)',
      desc: 'Dispatch 300 coils. Sales Order becomes Partially Dispatched. Finished Goods decreases by 300.'
    },
    {
      num: 10,
      title: 'Step 10: Create Dispatch #2 (200 Coils)',
      desc: 'Dispatch remaining 200 coils. Sales Order becomes Completed. Finished Goods decreases by 200.'
    }
  ];

  return (
    <div className="wf-modal-overlay" onClick={onClose}>
      <div className="wf-modal-content" onClick={e => e.stopPropagation()}>
        {/* Dark Navy Header */}
        <div className="wf-modal-header">
          <div className="wf-header-left">
            <div className="wf-header-icon-box">
              <Sparkles size={20} className="text-amber" />
            </div>
            <div>
              <h2 className="wf-modal-title">10-Step Interactive Workflow Simulator</h2>
              <p className="wf-modal-sub">
                Witness the complete connected manufacturing lifecycle: Raw Material → Job Work → Partial Receipt → Finished Goods → Sales Order → Partial Dispatch → Complete!
              </p>
            </div>
          </div>
          <button className="wf-modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Steps Body */}
        <div className="wf-modal-body">
          {/* Live Action Banner */}
          {lastActionLog && (
            <div className="wf-action-banner">
              <CheckCircle2 size={16} className="text-green-icon" />
              <span>{lastActionLog}</span>
            </div>
          )}

          <div className="wf-steps-list">
            {steps.map(step => {
              const isActive = activeStepTarget === step.num;
              const isDone = completedSteps.includes(step.num);
              return (
                <div
                  key={step.num}
                  className={`wf-step-card ${isActive ? 'card-active' : ''} ${isDone ? 'card-done' : ''}`}
                >
                  <div className={`wf-step-num-badge ${isDone ? 'badge-green' : isActive ? 'badge-amber' : 'badge-grey'}`}>
                    {isDone ? '✓' : step.num}
                  </div>

                  <div className="wf-step-info">
                    <h3 className="wf-step-title">{step.title}</h3>
                    <p className="wf-step-desc">{step.desc}</p>
                  </div>

                  <div className="wf-step-actions">
                    <button
                      className={`wf-btn-execute ${isActive ? 'btn-amber' : isDone ? 'btn-done' : 'btn-dark'}`}
                      onClick={() => executeStep(step.num)}
                    >
                      <Play size={13} fill="currentColor" /> {isDone ? 'Re-execute' : 'Execute Step'}
                    </button>
                    <ArrowRight size={16} className="wf-step-arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="wf-modal-footer">
          <button className="wf-reset-btn" onClick={resetState}>
            <RotateCcw size={14} /> Reset State to Initial Demo
          </button>

          <div className="wf-footer-right">
            <button className="wf-btn-run-full" onClick={runFullLifecycle}>
              Run Full 10-Step Lifecycle
            </button>
            <button className="wf-btn-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
