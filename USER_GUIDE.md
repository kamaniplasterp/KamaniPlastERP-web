# Kamani Plastic Industries ERP — Quick User Guide 🏭

A simple, step-by-step guide for factory supervisors, store managers, and billing clerks.

---

## 🧭 Navigation at a Glance

On the left sidebar, you have 5 main screens:
1. **Dashboard**: Daily overview of stock, pending orders, and alerts.
2. **Inventory & Stock**: All Raw Materials (Granules/Yarn) and Finished Goods (Ropes/Coils).
3. **Job Work Hub**: Everything related to outside processors (sending, receiving, statements).
4. **Sales & Orders**: Customer sales orders, reserving stock, and dispatch delivery challans.
5. **Directory & Masters**: Vendor details, job work rates, and setup tables.

---

## 📦 1. Raw Material Arrives at Factory (Truck Inward)

**When**: A supplier delivers PP Granules, Yarn, or Masterbatch.

1. Go to **Inventory & Stock** → click **`+ Inward Material (GRN)`** (green button).
2. Fill in:
   - **Date**, **Supplier Name**, **Challan No.** (supplier's invoice/challan number).
   - Select **Item Name** & **Grade** (e.g., `PP Granules` ^ `H110FU`).
   - Enter **Gross Weight** (total scale weight including bags).
   - Enter **Article Type** (e.g., `HDPE Bag`) and **Article Weight** (bag weight to deduct).
3. The system automatically calculates **Net Weight**.
4. Click **Record Inward Slip**. Your factory stock immediately increases.

---

## 🏭 2. Sending Material to Factory Machines (Extrusion Plant)

**When**: The factory floor needs raw material to make yarn or ropes.

1. Go to **Inventory & Stock** → click **`+ Issue to Factory`** (purple button).
2. Fill in:
   - **Item Name**, **Gross Weight**, and bag tare weight.
   - Enter who is issuing it (e.g., `SURESHBHAI`).
3. Click **Issue to Factory Floor**.
4. The raw material is instantly deducted from your available warehouse stock.

---

## 🚚 3. Sending Material to Outside Processors (Job Work Outward)

**When**: You send yarn/granules to outside vendors for twisting, braiding, or packing.

1. Go to **Job Work Hub** → click **`+ Issue Outward Challan`**.
2. Fill in:
   - **Party Name** (Vendor), **Item Name**, and **Process Name**.
   - **Gross Weight** and **Article Weight** (Tare weight of Bora/bags).
   - System calculates **Net Weight**.
   - Select **B. Loss %** (Burning/handling loss allowed, e.g., 2%). The system calculates final net returnable weight.
   - Enter **Vehicle Number** and **Issued By**.
3. Click **Generate Outward Challan**.
4. Click **Print Challan** to print statutory GST **Rule 55 Delivery Challans** (Original, Duplicate, Triplicate).

---

## 📥 4. Receiving Finished Goods Back from Processor (Job Work Inward)

**When**: The outside vendor returns the processed coils/ropes.

1. Go to **Job Work Hub** → locate the vendor or challan → click **`Receive Inward`** (green icon).
2. Fill in:
   - **Date** and **Party Name**.
   - Scale **Gross Weight** and **No. of Bora**.
   - Add packaging tare weights (up to 4 article rows like Theli, Bora, Paper tubes).
   - System automatically calculates **Net Weight** and compares it against what was originally sent.
3. Click **Confirm Inward Receipt**.
4. The vendor's pending balance is reduced, and your finished goods stock is automatically updated.

---

## 🛒 5. Customer Sales & Dispatch

**When**: A customer places an order and you load the delivery truck.

### Step A: Enter the Order
1. Go to **Sales & Orders** → click **`+ New Sales Order`**.
2. Select **Customer Name**, choose the **Product SKU**, enter **Quantity (Coils)** and **Rate**.
3. Click **Save Order**.

### Step B: Reserve Stock & Dispatch
1. Open the order from the list.
2. Click **Reserve Stock** (this holds the stock so no one else sells it).
3. When the truck arrives, click **Create Dispatch**.
4. Check the loaded quantity and click **Confirm Dispatch**.
5. Click **Print Delivery Challan** or **Print Tax Invoice** for the driver.

---

## 🧾 6. Checking Vendor Statements & Extra Cutting

**When**: Checking how much material or money is owed to a job worker at month-end.

1. Go to **Job Work Hub** → click the **`Job Worker Statement & Ledger`** tab.
2. Select the **Party Name**.
3. The screen instantly displays:
   - **Opening Balance** (KG and ₹ Value)
   - **Material Sent** vs **Material Received**
   - **Bora & Packaging Account** (bags sent vs bags returned)
   - **Extra Cutting / Deductions** (lumps, fluff, or trimmings entered under the `Extra Cutting` tab)
   - **Final Balance Weight & Net Payable Amount**
4. Click **Export CSV** if you need an Excel copy.

---

## 🖨️ 7. Quick Printing Guide

- **GST Rule 55 Delivery Challan**: Job Work Hub → click printer icon on any challan.
- **Inward Receipt Slip**: Click printer icon on any Inward entry.
- **Sales Delivery Challan & Tax Invoice**: Sales & Orders → open order → click Print.
- **Stock & Challan Reports**: Click **Export CSV** at the top right of any table.

---

### 💡 Daily Golden Rules for Staff
1. **Always deduct tare weight**: Enter Gross scale weight and bag weight so Net Weight is 100% accurate.
2. **Never dispatch without reserving**: Always hit **Reserve Stock** on orders before loading vehicles.
3. **Record inward on the same day**: Do not let trucks leave the gate without recording GRN or Inward Slips.
