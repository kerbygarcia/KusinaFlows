// Load data from localStorage
let inventory = JSON.parse(localStorage.getItem("inventory")) || [];
let stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];

// Helper functions
function getTotalQuantity(item) {
  return (item.batches || []).reduce((sum, b) => sum + b.quantity, 0);
}

function calculateTotalValue() {
  let total = 0;
  inventory.forEach(item => {
    (item.batches || []).forEach(batch => {
      total += batch.quantity * (item.price || 0);
    });
  });
  return total;
}

function getLowStockCount() {
  return inventory.filter(i => getTotalQuantity(i) <= 5).length;
}

function formatPrice(value) {
  return Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Update report summary cards
function updateReportSummary() {
  const totalItemsEl = document.getElementById("totalItemsReport");
  const totalValueEl = document.getElementById("totalValueReport");
  const lowStockEl = document.getElementById("lowStockReport");

  if (totalItemsEl) totalItemsEl.textContent = inventory.length;
  if (totalValueEl) totalValueEl.textContent = "₱" + formatPrice(calculateTotalValue());
  if (lowStockEl) lowStockEl.textContent = getLowStockCount();
}

// DOM elements
const reportContainer = document.getElementById("reportTableContainer");
const reportScreenTitle = document.getElementById("reportScreenTitle");
const printReportTitle = document.getElementById("printReportTitle");
const printReportSubtitle = document.getElementById("printReportSubtitle");
const tableHead = document.getElementById("reportTableHead");
const tableBody = document.getElementById("reportTableBody");

// Show report wrapper
function showReportSection(title, subtitle) {
  if (!reportContainer) return;
  reportContainer.classList.remove("hidden");
  
  if (reportScreenTitle) reportScreenTitle.textContent = title;
  if (printReportTitle) printReportTitle.textContent = title;
  if (printReportSubtitle) printReportSubtitle.textContent = subtitle;
}

// 1. Current Inventory Level Report
function generateInventoryReport() {
  const now = new Date();
  const subtitle = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
  showReportSection("Current Inventory Level Report", subtitle);

  tableHead.innerHTML = `
    <tr>
      <th>Item Name</th>
      <th>Category</th>
      <th>Unit Price</th>
      <th>Stock Level</th>
      <th>Total Value</th>
    </tr>
  `;

  tableBody.innerHTML = "";

  if (inventory.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777;">No items in inventory.</td></tr>`;
    return;
  }

  let grandTotalQty = 0;
  let grandTotalValue = 0;

  inventory.forEach(item => {
    const qty = getTotalQuantity(item);
    const value = qty * (item.price || 0);

    grandTotalQty += qty;
    grandTotalValue += value;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td>₱${formatPrice(item.price || 0)}</td>
      <td>${qty}</td>
      <td>₱${formatPrice(value)}</td>
    `;
    tableBody.appendChild(row);
  });

  // Append Grand Total Row
  const footerRow = document.createElement("tr");
  footerRow.style.fontWeight = "bold";
  footerRow.style.background = "#f9f9f9";
  footerRow.innerHTML = `
    <td colspan="3" style="text-align: right;">Grand Total:</td>
    <td>${grandTotalQty}</td>
    <td>₱${formatPrice(grandTotalValue)}</td>
  `;
  tableBody.appendChild(footerRow);
}

// 2. Stock Movement Report
function generateMovementReport() {
  const now = new Date();
  const subtitle = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()} - Complete log of activities`;
  showReportSection("Stock Movement Report", subtitle);

  tableHead.innerHTML = `
    <tr>
      <th>Date & Time</th>
      <th>Item Name</th>
      <th>Event Type</th>
      <th>Quantity</th>
      <th>Performed By</th>
      <th>Approved By</th>
    </tr>
  `;

  tableBody.innerHTML = "";

  if (stockHistory.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">No stock movement recorded yet.</td></tr>`;
    return;
  }

  stockHistory.forEach(act => {
    const row = document.createElement("tr");

    let typeClass = "";
    if (act.type === "Stock-In") {
      typeClass = "in-stock";
    } else if (act.type === "Stock-Out") {
      typeClass = "low-stock";
    } else {
      typeClass = "near-expiry"; // Orange for Item Added
    }

    const user = act.user || "-";
    const approvedBy = act.approvedBy || "-";

    row.innerHTML = `
      <td>${act.date} <span style="font-size: 11px; color: #888; margin-left: 5px;">${act.time}</span></td>
      <td><strong>${act.item}</strong></td>
      <td class="${typeClass}">${act.type}</td>
      <td>${act.qty}</td>
      <td>${user}</td>
      <td>${approvedBy}</td>
    `;
    tableBody.appendChild(row);
  });
}

// 3. Expense/Financial Report
function generateFinanceReport() {
  const now = new Date();
  const subtitle = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()} - Expenses for purchased ingredients or items`;
  showReportSection("Expense & Financial Report", subtitle);

  tableHead.innerHTML = `
    <tr>
      <th>Date & Time</th>
      <th>Item Name</th>
      <th>Unit Price</th>
      <th>Quantity Purchased</th>
      <th>Total Cost/Expense</th>
    </tr>
  `;

  tableBody.innerHTML = "";

  // Filter for transactions representing expenses (Adding new item or Stocking-In)
  const expenseTransactions = stockHistory.filter(act => act.type === "Item Added" || act.type === "Stock-In");

  if (expenseTransactions.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777;">No purchase transactions recorded yet.</td></tr>`;
    return;
  }

  let totalExpenses = 0;

  expenseTransactions.forEach(act => {
    // Find current price of the item to compute expense
    const matchedItem = inventory.find(i => i.name === act.item);
    const price = matchedItem ? (matchedItem.price || 0) : 0;
    const cost = act.qty * price;
    totalExpenses += cost;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${act.date} <span style="font-size: 11px; color: #888; margin-left: 5px;">${act.time}</span></td>
      <td><strong>${act.item}</strong></td>
      <td>₱${formatPrice(price)}</td>
      <td>${act.qty}</td>
      <td>₱${formatPrice(cost)}</td>
    `;
    tableBody.appendChild(row);
  });

  // Append Grand Total Row
  const footerRow = document.createElement("tr");
  footerRow.style.fontWeight = "bold";
  footerRow.style.background = "#f9f9f9";
  footerRow.innerHTML = `
    <td colspan="4" style="text-align: right;">Total Purchased Expenses:</td>
    <td>₱${formatPrice(totalExpenses)}</td>
  `;
  tableBody.appendChild(footerRow);
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  updateReportSummary();

  const btnInventory = document.getElementById("btnInventoryReport");
  const btnMovement = document.getElementById("btnMovementReport");
  const btnFinance = document.getElementById("btnFinanceReport");
  const btnPrint = document.getElementById("btnPrintReport");

  if (btnInventory) btnInventory.addEventListener("click", generateInventoryReport);
  if (btnMovement) btnMovement.addEventListener("click", generateMovementReport);
  if (btnFinance) btnFinance.addEventListener("click", generateFinanceReport);
  
  if (btnPrint) {
    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }
});

// Refresh listeners
function refreshReports() {
  inventory = JSON.parse(localStorage.getItem("inventory")) || [];
  stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];
  updateReportSummary();
  
  // Re-render active report if open
  if (reportContainer && !reportContainer.classList.contains("hidden")) {
    if (printReportTitle.textContent.includes("Inventory")) {
      generateInventoryReport();
    } else if (printReportTitle.textContent.includes("Movement")) {
      generateMovementReport();
    } else if (printReportTitle.textContent.includes("Expense")) {
      generateFinanceReport();
    }
  }
}

window.addEventListener("focus", refreshReports);
window.addEventListener("storage", refreshReports);
