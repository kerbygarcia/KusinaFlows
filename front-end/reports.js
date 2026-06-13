// Load data from localStorage
let inventory = JSON.parse(localStorage.getItem("inventory")) || [];
let stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];
let activeReportType = null; // Track which report is active: 'inventory' | 'movement' | 'finance'

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

// Update report summary cards
function updateReportSummary() {
  const totalItemsEl = document.getElementById("totalItemsReport");
  const totalValueEl = document.getElementById("totalValueReport");
  const lowStockEl = document.getElementById("lowStockReport");

  if (totalItemsEl) totalItemsEl.textContent = inventory.length;
  if (totalValueEl) totalValueEl.textContent = "₱" + formatPrice(calculateTotalValue());
  if (lowStockEl) lowStockEl.textContent = getLowStockCount();
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

// DOM elements
const reportContainer = document.getElementById("reportTableContainer");
const reportScreenTitle = document.getElementById("reportScreenTitle");
const printReportTitle = document.getElementById("printReportTitle");
const printReportSubtitle = document.getElementById("printReportSubtitle");
const tableHead = document.getElementById("reportTableHead");
const tableBody = document.getElementById("reportTableBody");

// Date Filter Helpers
function getTransactionDate(act) {
  if (act.timestamp) return new Date(act.timestamp);
  
  // Parse legacy date string "M/D/YYYY" or "MM/DD/YYYY"
  const parts = act.date.split("/");
  if (parts.length === 3) {
    let month = parseInt(parts[0], 10);
    let day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    
    // Swap if month is > 12 (likely DD/MM/YYYY)
    if (month > 12) {
      const temp = month;
      month = day;
      day = temp;
    }
    return new Date(year, month - 1, day);
  }
  
  const d = new Date(act.date);
  return isNaN(d.getTime()) ? new Date() : d;
}

function isDateInSelectedPeriod(txDate) {
  const period = document.getElementById("reportPeriodSelect").value;
  const now = new Date();
  
  // Strip time components for accurate date comparisons
  const txTime = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  if (period === "all") {
    return true;
  }
  
  if (period === "weekly") {
    // Current week: Last 7 days inclusive of today
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
    return txTime >= sevenDaysAgo && txTime <= todayStart + 24 * 60 * 60 * 1000;
  }
  
  if (period === "monthly") {
    // Current Calendar Month
    return txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
  }
  
  if (period === "annually") {
    // Current Calendar Year
    return txDate.getFullYear() === now.getFullYear();
  }
  
  if (period === "custom") {
    const startInput = document.getElementById("startDateInput").value;
    const endInput = document.getElementById("endDateInput").value;
    if (!startInput || !endInput) return true; // Fallback to all if unfilled
    
    const startDate = new Date(startInput);
    const endDate = new Date(endInput);
    
    const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    
    return txTime >= startTime && txTime <= endTime;
  }
  
  return true;
}

function getFilterSubtitle() {
  const period = document.getElementById("reportPeriodSelect").value;
  const now = new Date();
  const timestampStr = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
  
  if (period === "all") {
    return `${timestampStr} - Showing All Time Logs`;
  }
  if (period === "weekly") {
    return `${timestampStr} - Filtered for This Week (Last 7 Days)`;
  }
  if (period === "monthly") {
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    return `${timestampStr} - Filtered for ${monthName}`;
  }
  if (period === "annually") {
    return `${timestampStr} - Filtered for Year ${now.getFullYear()}`;
  }
  if (period === "custom") {
    const startInput = document.getElementById("startDateInput").value;
    const endInput = document.getElementById("endDateInput").value;
    if (!startInput || !endInput) return `${timestampStr} - Custom Range (Dates Not Selected)`;
    return `${timestampStr} - Filtered from ${startInput} to ${endInput}`;
  }
  return timestampStr;
}

// Show report wrapper
function showReportSection(title, subtitle) {
  if (!reportContainer) return;
  reportContainer.classList.remove("hidden");
  
  if (reportScreenTitle) reportScreenTitle.textContent = title;
  if (printReportTitle) printReportTitle.textContent = title;
  if (printReportSubtitle) printReportSubtitle.textContent = subtitle;
}

// 1. Current Inventory Level Report (filtered by items with activity/creation within the period)
function generateInventoryReport() {
  activeReportType = "inventory";
  const subtitle = getFilterSubtitle();
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

  // Filter inventory items that have movement in the active period (or all if all selected)
  const period = document.getElementById("reportPeriodSelect").value;
  let filteredInventory = inventory;
  
  if (period !== "all") {
    // Find item names that had activity in stockHistory in this period
    const activeItemNames = new Set(
      stockHistory
        .filter(act => isDateInSelectedPeriod(getTransactionDate(act)))
        .map(act => act.item)
    );
    filteredInventory = inventory.filter(item => activeItemNames.has(item.name));
  }

  if (filteredInventory.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777;">No active items found for the selected period.</td></tr>`;
    return;
  }

  let grandTotalQty = 0;
  let grandTotalValue = 0;

  filteredInventory.forEach(item => {
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
  activeReportType = "movement";
  const subtitle = getFilterSubtitle();
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

  // Filter stockHistory by date
  const filteredHistory = stockHistory.filter(act => isDateInSelectedPeriod(getTransactionDate(act)));

  if (filteredHistory.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">No stock movement recorded in this period.</td></tr>`;
    return;
  }

  // Helper to resolve staff name and role in real-time
  function resolveStaffDisplay(nameOrUsername, defaultRole) {
    if (!nameOrUsername || nameOrUsername === "-") return "-";
    const staffList = JSON.parse(localStorage.getItem("staffList")) || [];
    const staff = staffList.find(s => 
      s.username.toLowerCase() === nameOrUsername.toLowerCase() || 
      s.fullName.toLowerCase() === nameOrUsername.toLowerCase()
    );
    if (staff) {
      return `${staff.fullName} (${staff.role})`;
    }
    return `${nameOrUsername} (${defaultRole})`;
  }

  filteredHistory.forEach(act => {
    const row = document.createElement("tr");

    let typeClass = "";
    if (act.type === "Stock-In") {
      typeClass = "in-stock";
    } else if (act.type === "Stock-Out") {
      typeClass = "low-stock";
    } else {
      typeClass = "near-expiry"; // Orange for Item Added
    }

    const performerDisplay = resolveStaffDisplay(act.user, act.user === "Alice" ? "Employee" : "Owner");
    const approverDisplay = resolveStaffDisplay(act.approvedBy, "Manager");

    row.innerHTML = `
      <td>${act.date} <span style="font-size: 11px; color: #888; margin-left: 5px;">${act.time}</span></td>
      <td><strong>${act.item}</strong></td>
      <td class="${typeClass}">${act.type}</td>
      <td>${act.qty}</td>
      <td>${performerDisplay}</td>
      <td>${approverDisplay}</td>
    `;
    tableBody.appendChild(row);
  });
}

// 3. Expense/Financial Report
function generateFinanceReport() {
  activeReportType = "finance";
  const subtitle = getFilterSubtitle();
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

  // Filter for transactions representing expenses (Adding new item or Stocking-In) that fall in the date filter
  const expenseTransactions = stockHistory.filter(act => 
    (act.type === "Item Added" || act.type === "Stock-In") &&
    isDateInSelectedPeriod(getTransactionDate(act))
  );

  if (expenseTransactions.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777;">No purchase transactions recorded in this period.</td></tr>`;
    return;
  }

  let totalExpenses = 0;

  expenseTransactions.forEach(act => {
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

// Regenerate Active Report based on updated filter inputs
function regenerateActiveReport() {
  if (!activeReportType) return;
  if (activeReportType === "inventory") {
    generateInventoryReport();
  } else if (activeReportType === "movement") {
    generateMovementReport();
  } else if (activeReportType === "finance") {
    generateFinanceReport();
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  updateReportSummary();

  const btnInventory = document.getElementById("btnInventoryReport");
  const btnMovement = document.getElementById("btnMovementReport");
  const btnFinance = document.getElementById("btnFinanceReport");
  const btnPrint = document.getElementById("btnPrintReport");
  const periodSelect = document.getElementById("reportPeriodSelect");
  const customInputs = document.getElementById("customDateRangeInputs");
  const startDateInput = document.getElementById("startDateInput");
  const endDateInput = document.getElementById("endDateInput");

  if (btnInventory) btnInventory.addEventListener("click", generateInventoryReport);
  if (btnMovement) btnMovement.addEventListener("click", generateMovementReport);
  if (btnFinance) btnFinance.addEventListener("click", generateFinanceReport);
  
  if (btnPrint) {
    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }

  // Toggle custom dates view and trigger refresh on change
  if (periodSelect) {
    periodSelect.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        customInputs.classList.remove("hidden");
      } else {
        customInputs.classList.add("hidden");
        // Clear custom inputs when switching away
        if (startDateInput) startDateInput.value = "";
        if (endDateInput) endDateInput.value = "";
        regenerateActiveReport();
      }
    });
  }

  if (startDateInput) {
    startDateInput.addEventListener("change", regenerateActiveReport);
  }
  if (endDateInput) {
    endDateInput.addEventListener("change", regenerateActiveReport);
  }
});

// Refresh listeners
function refreshReports() {
  inventory = JSON.parse(localStorage.getItem("inventory")) || [];
  stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];
  updateReportSummary();
  regenerateActiveReport();
}

window.addEventListener("focus", refreshReports);
window.addEventListener("storage", refreshReports);
