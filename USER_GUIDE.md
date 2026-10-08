# 🏭 Kamani Plastic Industries — Complete ERP User Guide

> **Who is this guide for?** Factory supervisors, store managers, weighbridge operators, billing clerks, and anyone at Kamani Plastic Industries who uses the computer system to run daily operations. No software engineering background is needed — this guide explains every step and field in clear, plain everyday language.

---

## 📋 Table of Contents

1. [How to Log In](#-how-to-log-in)
2. [Understanding the Main Screen (Dashboard)](#-understanding-the-main-screen-dashboard)
3. [Inventory & Stock Hub](#-inventory--stock-hub)
   - [A. Material Arrives at Factory Gate (Raw Material Inward / GRN)](#a-material-arrives-at-factory-gate-raw-material-inward--grn)
   - [B. Issuing Raw Material to Machines (Factory Floor Extrusion)](#b-issuing-raw-material-to-machines-factory-floor-extrusion)
   - [C. Reading the Raw Material Ledger & Registers](#c-reading-the-raw-material-ledger--registers)
   - [D. Finished Goods Stock (Coils & Ropes)](#d-finished-goods-stock-coils--ropes)
   - [E. Stock Movements Log (The Audit Trail)](#e-stock-movements-log-the-audit-trail)
   - [F. Batch Traceability Explorer](#f-batch-traceability-explorer)
   - [G. Stock Reconciliation (Comparing Registers vs Physical Balances)](#g-stock-reconciliation-comparing-registers-vs-physical-balances)
4. [Job Work Hub (External Processors)](#-job-work-hub-external-processors)
   - [A. Sending Material Out to a Processor (Outward Challan)](#a-sending-material-out-to-a-processor-outward-challan)
   - [B. Receiving Processed Goods Back (Inward Receipt / GRN)](#b-receiving-processed-goods-back-inward-receipt--grn)
   - [C. Extra Cutting & Scrap Deductions](#c-extra-cutting--scrap-deductions)
   - [D. Vendor Statement, Ledger & Bora Account](#d-vendor-statement-ledger--bora-account)
   - [E. Printing Job Work Delivery Challans (GST Rule 55)](#e-printing-job-work-delivery-challans-gst-rule-55)
5. [Sales & Dispatch Hub](#-sales--dispatch-hub)
   - [A. Booking a New Customer Sales Order](#a-booking-a-new-customer-sales-order)
   - [B. Checking Orders & Reserving Stock](#b-checking-orders--reserving-stock)
   - [C. Truck Loading & Generating Dispatch Challan](#c-truck-loading--generating-dispatch-challan)
   - [D. Printing Tax Invoices & Delivery Slips](#d-printing-tax-invoices--delivery-slips)
   - [E. Tracking Dispatches & Delivery History](#e-tracking-dispatches--delivery-history)
6. [Directory & Master Settings](#-directory--master-settings)
   - [A. Adding Job Work Vendors](#a-adding-job-work-vendors)
   - [B. Adding Customers (Buyers)](#b-adding-customers-buyers)
   - [C. Setting Up Job Work Rates (Process Wise)](#c-setting-up-job-work-rates-process-wise)
   - [D. Setting Standard Tare Weights (Bora, Bags, Tubes)](#d-setting-standard-tare-weights-bora-bags-tubes)
   - [E. Adding Staff & Supervisor Names](#e-adding-staff--supervisor-names)
   - [F. Updating Company Profile & GST Details](#f-updating-company-profile--gst-details)
7. [How to Export Any Report to Excel (CSV)](#-how-to-export-any-report-to-excel-csv)
8. [Status Badges & Colors Explained](#-status-badges--colors-explained)
9. [Daily Routine Checklist for Factory Staff](#-daily-routine-checklist-for-factory-staff)
10. [Troubleshooting & Common Mistake Fixes](#-troubleshooting--common-mistake-fixes)
11. [Factory Golden Rules (Do Not Break)](#-factory-golden-rules-do-not-break)

---

## 🔐 How to Log In

1. Open **Google Chrome** or **Microsoft Edge** on your desktop or office laptop.
2. Go to the ERP link provided by your factory administrator.
3. You will see the **Kamani Plastic Industries ERP Sign In** screen.
4. Type in your registered **Email Address** and **Password**.
5. Click **Sign In**.
6. The system connects to the live database in real-time. Once authenticated, your plant workspace loads immediately.

> 💡 **Tip:** Bookmark the page in your browser by pressing `Ctrl + D` on your keyboard so you can access it with one click each morning.

---

## 🧭 Understanding the Main Screen (Dashboard)

The **Dashboard** is your command center. It gives you a real-time summary of the entire factory without clicking into separate menus.

### 1. Top 4 KPI Metrics
Across the top of the dashboard, you will see four summary cards:
- **Raw Material Stock (In Factory):** Total kilograms (KG) of polymer granules, yarn, and masterbatch sitting in the factory warehouse ready for production. It also displays the rupee valuation in Lakhs.
- **With Job Workers:** Material (in KG) that has been sent outside to external processors (e.g., twisting or braiding units) and has not yet returned.
- **Finished Goods Stock:** Total units (Coils or Bundles) of finished ropes in warehouse ready for dispatch, showing how many are "Free" versus "Reserved".
- **Ready for Dispatch:** Total coils allocated to confirmed sales orders awaiting truck dispatch, with total sales value in Lakhs.

> 💡 *Quick Action:* Clicking any KPI card immediately navigates you to that specific department view!

### 2. Connected Factory Lifecycle Engine
This horizontal progress chain shows your live production pipeline across 6 stages:
1. **Raw Material:** Physical raw inventory in factory.
2. **At Job Work:** Stock undergoing external processing.
3. **In Process:** Material currently on machines.
4. **Finished Stock:** Coils packed in warehouse.
5. **Sales Pipeline:** Open buyer orders waiting for fulfillment.
6. **Dispatches:** Delivered shipments on the road.

### 3. Active Job Work Lifecycle Table
Lists recent external orders with vendor name, material sent, return quantity received so far, and delivery status (e.g., `SENT`, `PARTIAL`, `COMPLETED`, `OVERDUE`).

### 4. Interactive Visual Distribution Charts
- **Inventory Distribution (Donut Chart):** Shows the percentage balance between Factory Raw Material (Blue), Finished Goods (Green), and Material with Job Workers (Orange).
- **Finished Goods Allocation (Bar Chart):** Shows your top rope products, splitting each bar between **Free Stock** (Green) and **Reserved for Orders** (Blue).

### 5. Reorder Alerts Banner
Whenever an essential raw material or high-demand rope SKU drops below its preset safety buffer level, a bright warning banner flashes on the dashboard detailing the item code, available balance, and recommended minimum quantity.

---

## 📦 Inventory & Stock Hub

Navigate here by clicking **Inventory & Stock** in the left sidebar. This section oversees all physical inventory inside the factory boundary.

### A. Material Arrives at Factory Gate (Raw Material Inward / GRN)

**When to use:** Whenever a supplier delivery truck arrives with polymer granules, raffia yarn, masterbatch, or filler.

**What is a GRN?** A *Goods Receipt Note (GRN)* is the legal proof that raw stock was inspected, weighed, and accepted into your warehouse.

#### Step-by-Step Instructions:
1. Click the **Raw Materials (RM)** tab at the top.
2. Click the green button: **`+ Inward RM (GRN)`**.
3. A popup modal appears. Fill in the fields:
   - **Date:** Today's date (defaults automatically).
   - **GRN Series / Number:** Auto-generated voucher number (e.g., `GRN-2026-0042`).
   - **Supplier Name:** Choose or type the vendor (e.g., *Reliance Industries Limited*, *IOCL*).
   - **Challan / Invoice No.:** Type the delivery challan number printed on the paper invoice brought by the truck driver.
   - **Item Name & Grade:** Choose the material (e.g., `PP Granules` and grade `H110FU`).
   - **Gross Weight (KG):** Enter the full weight from the weighbridge slip including the bags/packaging.
   - **No. of Articles (Bags):** Number of bags counted (e.g., `100 Bags`).
   - **Article Type:** Select packaging style (e.g., `HDPE Bag`, `Bora`, `Paper Bag`).
   - **Article Tare Weight (KG):** Weight of a single empty bag (e.g., `0.120 KG` or `1.2 KG`).
   - **Received By:** Select the gatekeeper or store supervisor from the dropdown.
   - **Vehicle Number:** Truck number (e.g., `GJ-03-BW-4412`).
4. **How the System Calculates Net Weight:**
   $$\text{Tare Weight} = \text{No. of Articles} \times \text{Weight per Bag}$$
   $$\text{Net Weight} = \text{Gross Weight} - \text{Tare Weight}$$
5. Click **Record Inward Slip**.
6. The system immediately adds this net quantity to your available raw materials inventory. You can click the printer icon on the register to print the inward slip for your physical gate pass binder.

---

### B. Issuing Raw Material to Machines (Factory Floor Extrusion)

**When to use:** Whenever your plant extrusion operators take bags of polymer granules from the warehouse to load into machine hoppers.

#### Step-by-Step Instructions:
1. Under the **Raw Materials (RM)** tab, click the purple button: **`+ Issue to Factory`**.
2. Select the raw material item you are issuing (e.g., `PP Granules - Grade H110FU`).
3. Enter the scale weight:
   - **Gross Weight (KG):** Total weight of bags taken.
   - **Number of Bags & Bag Tare Weight:** System deducts packaging tare weight automatically.
   - **Machine / Plant Line:** Which extruder machine is consuming this material (e.g., *Extruder Line 1*).
   - **Issued By:** Name of the store manager releasing the stock.
4. Click **Issue to Factory Floor**.
5. The issued net weight is instantly deducted from your available factory inventory and recorded into the consumption ledger.

---

### C. Reading the Raw Material Ledger & Registers

Inside the **Raw Materials (RM)** view, four sub-buttons help you view records from different angles:

1. **📊 RM Stock Ledger:**
   - Shows each raw material SKU with its **Total Inward**, **Quantity at Outside Job Work**, **Factory Floor Consumption**, **Current Available Factory Balance**, **Unit Rate**, and total **Valuation**.
   - Items with low inventory display a red `LOW STOCK` badge.
2. **📥 Inward Register (GRN):**
   - Chronological historical log of all inward deliveries received from suppliers with truck numbers, supplier challans, tare weights, and receiving personnel.
3. **🏭 Issue to Factory Register:**
   - Historical record of all material handed over to the plant floor machines for batch manufacturing.
4. **⚖️ Stock Reconciliation (RM Comp):**
   - Automatic mathematical verification matching opening inventory + inwards - factory consumption - job work shipments = live physical balance. Any difference is flagged under the variance column.

---

### D. Finished Goods Stock (Coils & Ropes)

Click on the **Finished Goods (FG)** tab.

This tab lists every saleable rope specification (Danline Ropes, HDPE Ropes, Monofilament Twines, Coils).

#### Understanding the 3 Stock Columns:
- **Physical Stock:** Total count of finished coils physically stacked in the finished goods bay.
- **Reserved Stock:** Coils already promised to customers on confirmed sales orders. You **must not** sell or dispatch these to anyone else!
- **Free Stock:** Available coils that have not yet been promised to any buyer:
  $$\text{Free Stock} = \text{Physical Stock} - \text{Reserved Stock}$$

#### Manually Adding Production Batches:
1. When a new batch of coils is manufactured and brought into the warehouse, find the product row or click **`+ Add Finished Goods Stock`**.
2. Enter the quantity of coils, weight per coil, and production batch number.
3. Click **Save Stock**. The physical free stock updates automatically.

---

### E. Stock Movements Log (The Audit Trail)

Click the **Stock Movements Ledger** tab.

Every single time stock enters, leaves, or moves inside the company (GRN receipt, job work dispatch, production inward, factory issue, or customer dispatch), an unchangeable audit row is created.
- Filter by transaction type: `GRN Inward`, `Job Work Outward`, `Production Inward`, `Sales Dispatch`, `Adjustment`.
- Search by reference voucher, batch number, or vehicle number.

---

### F. Batch Traceability Explorer

Click the **Batch Traceability Explorer** tab.

This tool allows you to trace quality genealogy backwards and forwards:
- Enter any **Batch ID**, **Sales Order Number**, or **GRN Slip**.
- The system visually renders the full tree:
  $$\text{Supplier Raw Material (GRN)} \rightarrow \text{Outward to Job Worker} \rightarrow \text{Received Return Goods} \rightarrow \text{Finished Goods Coil} \rightarrow \text{Customer Invoice \& Dispatch}$$
- In case a customer complains about rope strength or color fading, use this screen to identify the exact batch of raw granules and vendor responsible within 10 seconds.

---

### G. Stock Reconciliation (Comparing Registers vs Physical Balances)

Navigate to **Raw Materials** $\rightarrow$ **⚖️ Stock Reconciliation**.

At the end of every week or month, the store auditor can cross-verify:
- **Calculated Balance:** What the system math says should be in the warehouse.
- **Ledger Balance:** Recorded warehouse balance.
- **Variance:** Discrepancy amount.
If variance is zero, your records match reality 100%. If variance is negative or positive, inspect missing supplier GRNs or unrecorded factory floor issues.

---

## 🔧 Job Work Hub (External Processors)

Navigate here by clicking **Job Work Hub** in the left sidebar.

This module manages all external vendors who perform processing on our material (yarn spinning, twisting, braiding, hank making, or cutting).

---

### A. Sending Material Out to a Processor (Outward Challan)

**When to use:** You are loading an external tempo or truck with raw yarn/granules to be sent to an outside party for processing.

#### Step-by-Step Instructions:
1. In the **Job Work Hub**, click **`+ Issue Outward Challan`**.
2. Complete the challan modal:
   - **Party Name:** Select the vendor (e.g., *Galaxy Enterprise*, *Ramjibhai*).
   - **Material & Grade:** Material being sent (e.g., *PP Danline Yarn 800D*).
   - **Process Type:** Type of job (e.g., *Twisting*, *Braiding*, *Hank Winding*).
   - **Gross Scale Weight (KG):** Total weight on scale.
   - **Number of Boras / Packaging:** Enter bag count.
   - **Tare Weight per Bora:** Automatically deducted based on standard packaging tare.
   - **Net Weight:** Auto-calculated.
   - **Burning Loss % (B.Loss):** Processing tolerance allowance (e.g., `2.0%`).
   - **Net Returnable Quantity:** System computes exact minimum KG the vendor must return:
     $$\text{Returnable KG} = \text{Net Weight} - \left(\text{Net Weight} \times \frac{\text{B.Loss \%}}{100}\right)$$
   - **Vehicle Number & Driver:** Enter vehicle registration for transport documentation.
   - **Processing Rate (₹/KG):** Agreed labour rate per KG (e.g., `₹17.50 / KG`).
3. Click **Generate Outward Challan**.
4. Click **Print Challan** to generate statutory **GST Rule 55 Delivery Challan** (Original for Consignee, Duplicate for Transporter, Triplicate for Factory).

> ⚠️ **Gate Rule:** The truck must never leave the factory gate without printed Rule 55 challan copies signed by the supervisor!

---

### B. Receiving Processed Goods Back (Inward Receipt / GRN)

**When to use:** The job worker delivers back the processed coils, twisted yarn, or finished ropes.

#### Step-by-Step Instructions:
1. In **Job Work Hub** $\rightarrow$ **Orders**, find the original outward challan row.
2. Click the green **`Receive Inward`** button on that row.
3. Fill in the receiving form:
   - **Inward Date:** Date received.
   - **Inward Slip No:** Auto-numbered.
   - **Gross Weight (KG):** Scale reading of incoming truck load.
   - **Packaging Tare Rows:** Add rows for empty boras, plastic cones, or theli returned to calculate true Net Weight.
   - **Accepted Net Quantity (KG):** Actual good usable product received.
   - **Rework Quantity (KG):** Goods returned with minor defects requiring vendor re-fixing.
   - **Rejection Quantity (KG):** Totally damaged unusable material charged back to vendor.
   - **Scrap Returned (KG):** Waste cuttings returned by vendor.
4. The system calculates the remaining pending balance:
   $$\text{Remaining Balance KG} = \text{Original Sent KG} - \text{Total Received KG}$$
5. If the balance reaches zero, the order status changes to `COMPLETED`. If partial, status shows `PARTIAL`.
6. Click **Confirm Inward Receipt**.
7. The received quantity automatically flows into your Finished Goods inventory!

---

### C. Extra Cutting & Scrap Deductions

**When to use:** External job workers often produce waste trimmings, fluff, or end-cuts during twisting and cutting. When this waste is deducted from their account, record it here.

#### Step-by-Step Instructions:
1. Go to **Job Work Hub** $\rightarrow$ **Extra Cutting** tab.
2. Click **`+ Add Extra Cutting`**.
3. Select the **Party Name**.
4. Enter the **Deduction Details** (e.g., *Thread trimmings / lump waste from Lot 42*).
5. Enter **Weight (KG)** and **Rate (₹/KG)**.
6. The total rupee penalty is auto-calculated:
   $$\text{Total Deduction Amount (₹)} = \text{Weight (KG)} \times \text{Rate (₹/KG)}$$
7. Click **Save Deduction**. This deduction will automatically show on the vendor's ledger statement!

---

### D. Vendor Statement, Ledger & Bora Account

Click the **Job Worker Statement & Ledger** tab.

Select any vendor and pick a financial date range. The system immediately compiles a financial & material balance sheet:
- **Material Sent vs Received:** Total KG handed over vs total KG returned.
- **Burning Loss Accounting:** Permissible loss vs actual loss.
- **Bora & Bag Balance:** Number of empty packaging bags sent out vs returned (prevents losing thousands of rupees in unreturned bags).
- **Extra Cutting Deductions:** Itemized deductions.
- **Net Processing Charges Payable:** Total processing charges owed to the vendor minus any penalties.
- Click **Export CSV** to send this sheet to accounts or WhatsApp it to the vendor.

---

### E. Printing Job Work Delivery Challans (GST Rule 55)

Click the **printer icon** on any job work challan row. The system formats a clean document with:
- Factory GSTIN, registered address, and state code.
- Consignee GSTIN and delivery address.
- HSN codes, process description, gross weight, tare deduction, and vehicle number.
- Standard legal declaration under Rule 55 for job work movement without invoice.

---

## 🛒 Sales & Dispatch Hub

Navigate here by clicking **Sales & Orders** in the left sidebar.

This module handles the commercial side: booking buyer orders, locking stock, generating dispatch challans, and printing tax invoices.

---

### A. Booking a New Customer Sales Order

**When to use:** A customer confirms an order via phone call, WhatsApp, or purchase order.

#### Step-by-Step Instructions:
1. In **Sales & Orders**, click **`+ New Sales Order`**.
2. Complete the order form:
   - **Customer Name:** Select buyer from the dropdown (e.g., *Mahavir Traders*).
   - **PO Number:** Customer's internal reference PO number.
   - **Promised Delivery Date:** Target date for shipment.
   - **Payment Terms:** Credit agreement (e.g., *30 Days Credit*, *Advance Cash*).
3. **Add Product Lines:**
   - Select the **Product SKU** (e.g., *Danline Rope 6mm Bright Yellow*).
   - Enter **Quantity (Coils)**.
   - Enter **Selling Rate (₹ per Coil)**.
   - Click *+ Add Line* if customer is ordering multiple products on the same bill.
4. **Financial Totals:**
   - Taxable subtotal is automatically calculated.
   - **GST (18%):** Calculated automatically.
   - **Freight Charges:** Enter truck freight if payable by us or pre-agreed.
   - **Grand Total Amount:** Complete order invoice value.
5. Click **Save Order**.
6. Order appears in the table with status `PENDING`.

---

### B. Checking Orders & Reserving Stock

Once an order is confirmed, you must prevent other salespeople from selling the same stock.

1. Click on the customer order row to open the **Order Details Screen**.
2. Check the **Free Stock** indicator for that product SKU.
3. If enough free coils are sitting in the warehouse, click **`Reserve Stock`**.
4. The status turns to `RESERVED`. Those coils are now locked specifically for this customer.

---

### C. Truck Loading & Generating Dispatch Challan

**When to use:** The buyer's truck is at your loading dock and factory helpers are loading coils.

#### Step-by-Step Instructions:
1. From the **Order Details Screen**, click **`Create Dispatch`** (or click **`+ Dispatch Order`** on the main sales screen).
2. Choose the Sales Order reference.
3. Enter dispatch details:
   - **Challan Date:** Today's date.
   - **Quantity Loaded (Coils):** Enter actual coils loaded onto the truck.
     > *Partial Delivery:* If the buyer ordered 500 coils but your truck only holds 300 coils, enter 300. The system will dispatch 300 and keep 200 coils as balance on the order!
   - **Vehicle Number:** Truck registration (e.g., *GJ-01-XX-9021*).
   - **Driver Name & Mobile:** Driver contact details.
   - **Freight (₹):** Transport charge.
4. Click **Confirm Dispatch**.
5. The system automatically reduces finished goods warehouse stock, releases the reserved reservation, and records the dispatch voucher.

---

### D. Printing Tax Invoices & Delivery Slips

From the dispatch record or order details:
- Click **`Print Tax Invoice`**: Generates a standard GST Tax Invoice with CGST/SGST/IGST breakdown, reverse charge declaration, banking payment details, and authorized signatory blocks.
- Click **`Print Delivery Challan`**: Generates a warehouse dispatch slip for the truck driver showing items and counts without financial rates.

---

### E. Tracking Dispatches & Delivery History

Click on the **Dispatches** tab in Sales & Orders.
- Review all truck dispatches filtered by date, customer, or status.
- When the customer receives the shipment, update status to `DELIVERED`.

---

## ⚙️ Directory & Master Settings

Navigate here by clicking **Directory & Masters** in the left sidebar.

This is the central configuration area where you setup company details, vendors, buyers, and preset standards so daily entry is fast and error-free.

---

### A. Adding Job Work Vendors
1. Go to **Directory & Masters** $\rightarrow$ **Vendors** tab.
2. Click **`+ Add Vendor`**.
3. Enter company name, phone number, city, GSTIN number, primary process (Twisting/Braiding), and standard rate per KG.
4. Click **Save Vendor**.

---

### B. Adding Customers (Buyers)
1. Go to the **Customers** tab.
2. Click **`+ Add Customer`**.
3. Enter buyer company name, contact person, phone, delivery address, GSTIN, and credit terms (e.g., *15 Days*).
4. Click **Save Customer**.

---

### C. Setting Up Job Work Rates (Process Wise)
Avoid having to remember labour rates for different parties:
1. Go to **JW Rate Master** tab.
2. Click **`+ Add Rate`**.
3. Pair the **Party Name**, **Process Type** (e.g., *Twisting*), **Material Item**, and **Rate per KG** (e.g., *₹17.50*).
4. Whenever an outward challan or inward slip is created for this party, this rate automatically pre-fills!

---

### D. Setting Standard Tare Weights (Bora, Bags, Tubes)
To ensure every scale operator deducts identical tare weights across shifts:
1. Go to the **Tare Standards** tab.
2. Review standard packaging weights:
   - **Bora (Jute/PP):** `0.200 KG`
   - **Plastic Cone:** `0.025 KG`
   - **Khali Bag:** `0.120 KG`
   - **Theli (Polythene):** `0.015 KG`
3. Edit values if your packaging supplier changes, and click **Save Tare Standards**.

---

### E. Adding Staff & Supervisor Names
1. Go to the **Personnel** tab.
2. Add the names of supervisors, gatekeepers, and storekeepers (e.g., *Suresh Patel*, *Ramesh Bhai*).
3. These names populate the "Issued By" and "Received By" dropdowns across all modals.

---

### F. Updating Company Profile & GST Details
1. Go to the **Company Profile** tab.
2. Enter your factory legal trade name, full factory address, GSTIN, PAN, and contact email.
3. This information automatically prints on headers of all Delivery Challans, GRN slips, and Tax Invoices.

---

## 📊 How to Export Any Report to Excel (CSV)

Every table across the ERP has an **Export CSV** or **Download** button in the top right corner.

1. Filter the screen to the data you need (e.g., specific vendor or date range).
2. Click the **Export CSV** button.
3. A spreadsheet file downloads to your computer.
4. Double-click the file to open it in **Microsoft Excel**, **WPS Office**, or **Google Sheets**.
5. You can now sort, print, or email the spreadsheet to your accountant or factory director.

---

## 🎨 Status Badges & Colors Explained

| Badge Color | Text | Meaning | What You Should Do |
|---|---|---|---|
| 🟢 Green | `IN STOCK` | Plenty of material in warehouse | Normal operation |
| 🟢 Green | `COMPLETED` | Order fully received or dispatched | No action required |
| 🟢 Green | `DELIVERED` | Shipment safely reached customer | Archive record |
| 🔵 Blue | `SENT` | Goods out on the road or with vendor | Monitor return due date |
| 🔵 Blue | `DISPATCHED` | Truck has left factory gate | Follow up with driver |
| 🟡 Amber | `PARTIAL` | Part of the material has returned | Expect remaining quantity |
| 🟡 Amber | `RESERVED` | Goods locked for sales order | Do not sell to other parties |
| 🟠 Orange | `PENDING` | Order created but waiting for stock | Check production progress |
| 🔴 Red | `LOW STOCK` | Inventory dropped below safety buffer | Re-order raw material immediately |
| 🔴 Red | `OUT OF STOCK` | Zero inventory remaining | Stop issuing, raise urgent purchase |
| 🔴 Red | `OVERDUE` | Vendor exceeded promised return date | Call vendor immediately |

---

## 📅 Daily Routine Checklist for Factory Staff

### 🌅 Morning Routine (08:30 AM – 09:30 AM)
- [ ] Log in and open the **Operations Dashboard**.
- [ ] Review the **Reorder Alerts** banner — inform purchasing of any raw material low warnings.
- [ ] Check the **Active Job Work** table for any items marked `OVERDUE`.
- [ ] Check **Sales Pipeline** to see which customer dispatches are scheduled for today.

### 🏭 During the Day (Operating Shifts)
- [ ] **Incoming Trucks:** Record every raw material inward (GRN) on the system before the truck leaves the gate.
- [ ] **Extruder Issues:** Record raw material issues to the factory floor as soon as bags leave the warehouse.
- [ ] **Job Work Movement:** Issue outward challans and print Rule 55 slips before vendor tempos leave the premises.
- [ ] **Job Work Receipts:** Weigh all returned coils and confirm inward receipt on the same day.
- [ ] **Customer Dispatches:** Always click "Reserve Stock", then generate the dispatch challan and print tax invoices.

### 🌆 Evening Wrap-Up (06:00 PM – 07:00 PM)
- [ ] Check the **Stock Movements Ledger** to ensure all transactions of the day are recorded.
- [ ] Confirm that no pending trucks remain unrecorded.
- [ ] Verify that physical weighbridge registers match ERP recorded weights.

---

## 🛠️ Troubleshooting & Common Mistake Fixes

### 1. "My finished goods stock is showing 0 coils, but I see coils in the warehouse!"
- **Cause:** Those coils are likely marked as **Reserved** on an open customer sales order.
- **Fix:** Open **Sales & Orders**. Check open orders for that product. If an order was cancelled or changed, open that order and delete or edit the line item to release the reserved coils back into Free Stock.

### 2. "The system calculated negative net weight on a GRN!"
- **Cause:** You may have typed gross weight in grams instead of kilograms, or entered an incorrect bag tare weight.
- **Fix:** Remember that **Gross Weight** must always be total kilograms (e.g., 5000 KG). Bag tare must be in decimals (e.g., 0.120 KG, not 120 KG).

### 3. "I cannot find a vendor or customer in the dropdown list!"
- **Cause:** The party has not yet been added to the master directory.
- **Fix:** Go to **Directory & Masters** $\rightarrow$ **Vendors** or **Customers** $\rightarrow$ click **`+ Add`**. Once saved, return to your screen; the name will appear in the dropdown.

### 4. "The printed challan has an incorrect address or spelling!"
- **Cause:** Company profile or vendor profile details are outdated.
- **Fix:** Go to **Directory & Masters** $\rightarrow$ **Company Profile** (or Vendors), update the details, and click Save. Re-click the print icon to generate the updated copy.

### 5. "A Job Work challan is stuck as SENT even though material came back!"
- **Cause:** Store staff unloaded the truck but forgot to click **Receive Inward** in the ERP.
- **Fix:** Go to **Job Work Hub** $\rightarrow$ **Orders** $\rightarrow$ find the challan $\rightarrow$ click the green **`Receive Inward`** button $\rightarrow$ submit the received weights.

---

## ⭐ Factory Golden Rules (Do Not Break)

1. **Rule of Real-Time Entry:** Never keep paper chits for tomorrow. Record every GRN, issue, and dispatch at the exact moment the weighbridge scale reading is taken.
2. **Always Deduct Tare Weights:** Never enter scale gross weight as net weight. Always enter article packaging counts so tare weight is deducted accurately.
3. **No Truck Leaves Without Rule 55 Challan:** Every vehicle carrying company material must carry an ERP-generated delivery challan. Hand-written slips cause legal issues during GST road transit inspections.
4. **Reserve Before Dispatch:** Always reserve stock against an order before warehouse loaders start loading the truck.
5. **Protect Master Data:** Never create duplicate entries for existing vendors or customers with slight spelling variations. Use the directory search before adding a new party.

---

*Document Reference: Kamani Plastic Industries ERP Operations Manual*  
*Applicable for: All Production & Store Operations*
