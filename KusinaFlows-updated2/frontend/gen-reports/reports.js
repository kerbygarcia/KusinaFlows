// ============================================================================
// CONFIGURATION & STATE
// ============================================================================
const API_BASE_URL = "http://localhost:5244/api";

let allInventory = [];
let currentReportType = ""; // "INVENTORY" | "MOVEMENT" | "FINANCE"

// ============================================================================
// INITIALIZATION
// ============================================================================
async function initReports() {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    allInventory = await res.json();
    renderSummaryCards();
  } catch (err) {
    console.error("Failed to load report data:", err);
    document.getElementById("totalItemsReport").textContent = "⚠️";
    document.getElementById("totalValueReport").textContent = "⚠️";
    document.getElementById("lowStockReport").textContent = "⚠️";
  }
}

// ============================================================================
// SUMMARY CARDS
// ============================================================================
function renderSummaryCards() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const uniqueItems = {};
  let totalValue = 0;

  allInventory.forEach(row => {
    const name = row.itemName ?? row.ItemName ?? "Unknown";
    const qty = row.quantity ?? row.Quantity ?? 0;
    const price = row.price ?? row.Price ?? 0;
    const utdY = row.utDyear ?? row.utdYear ?? row.UTDyear;
    const utdM = row.utDmonth ?? row.utdMonth ?? row.UTDmonth;
    const utdD = row.utDday ?? row.utdDay ?? row.UTDday;

    if (!utdY || !utdM || !utdD) return;

    const expiry = new Date(utdY, utdM - 1, utdD);
    expiry.setHours(0, 0, 0, 0);
    const isAvailable = expiry >= today && qty > 0;

    if (!uniqueItems[name]) uniqueItems[name] = { totalQty: 0, price };
    if (isAvailable) {
      uniqueItems[name].totalQty += qty;
      totalValue += qty * price;
    }
  });

  const productNames = Object.keys(uniqueItems);
  const totalItems = productNames.length;
  const lowStockCount = productNames.filter(n => {
    const q = uniqueItems[n].totalQty;
    return q > 0 && q <= 5;
  }).length;

  document.getElementById("totalItemsReport").textContent = totalItems;
  document.getElementById("totalValueReport").textContent =
    `₱${totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  document.getElementById("lowStockReport").textContent = lowStockCount;
}

// ============================================================================
// DATE HELPERS
// ============================================================================
function parseDateRange() {
  const startVal = document.getElementById("reportStartDate").value;
  const endVal = document.getElementById("reportEndDate").value;

  if (!startVal || !endVal) {
    alert("Please select both a start and end date.");
    return null;
  }

  const start = new Date(startVal);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endVal);
  end.setHours(23, 59, 59, 999);

  if (start > end) {
    alert("Start date must be before or equal to end date.");
    return null;
  }

  return { start, end, startVal, endVal };
}

function formatDateForDisplay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function parseTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(String(ts).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function formatTimestamp(ts) {
  const d = parseTimestamp(ts);
  if (!d) return "N/A";
  return d.toLocaleString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  });
}

// ============================================================================
// REPORT BUTTON HANDLERS — Show filter panel per report type
// ============================================================================
document.getElementById("btnInventoryReport").addEventListener("click", () => {
  currentReportType = "INVENTORY";
  showFilterPanel("Current Inventory Level Report");
});

document.getElementById("btnMovementReport").addEventListener("click", () => {
  currentReportType = "MOVEMENT";
  showFilterPanel("Stock Movement Report");
});

document.getElementById("btnFinanceReport").addEventListener("click", () => {
  currentReportType = "FINANCE";
  showFilterPanel("Expense / Financial Report");
});

function showFilterPanel(title) {
  document.getElementById("filterPanelTitle").textContent = `${title} — Select Date Range`;
  document.getElementById("reportFilterPanel").classList.remove("hidden");
  document.getElementById("reportTableContainer").classList.add("hidden");

  // Default range: first day of current month → today
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  document.getElementById("reportStartDate").value = firstDay.toISOString().split("T")[0];
  document.getElementById("reportEndDate").value = now.toISOString().split("T")[0];
}

document.getElementById("btnGenerateReport").addEventListener("click", () => {
  const range = parseDateRange();
  if (!range) return;

  if (currentReportType === "INVENTORY") generateInventoryReport(range);
  else if (currentReportType === "MOVEMENT") generateMovementReport(range);
  else if (currentReportType === "FINANCE") generateFinancialReport(range);
});

// ============================================================================
// REPORT: CURRENT INVENTORY LEVEL
// ============================================================================
function generateInventoryReport(range) {
  const { start, end, startVal, endVal } = range;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect unique items that have at least one batch with a timestamp in range
  const itemMap = {};

  allInventory.forEach(row => {
    const ts = row.timeStamp ?? row.TimeStamp;
    const rowDate = parseTimestamp(ts);
    if (!rowDate || rowDate < start || rowDate > end) return;

    const name = row.itemName ?? row.ItemName ?? "Unknown";
    const qty = row.quantity ?? row.Quantity ?? 0;
    const price = row.price ?? row.Price ?? 0;
    const category = row.category ?? row.Category ?? "N/A";
    const utdY = row.utDyear ?? row.utdYear;
    const utdM = row.utDmonth ?? row.utdMonth;
    const utdD = row.utDday ?? row.utdDay;

    const expiry = utdY && utdM && utdD ? new Date(utdY, utdM - 1, utdD) : null;
    if (expiry) expiry.setHours(0, 0, 0, 0);
    const isAvailable = expiry ? (expiry >= today && qty > 0) : false;

    if (!itemMap[name]) {
      itemMap[name] = { name, category, price, stockLevel: 0, totalValue: 0 };
    }
    if (isAvailable) {
      itemMap[name].stockLevel += qty;
      itemMap[name].totalValue += qty * price;
    }
  });

  const rows = Object.values(itemMap).sort((a, b) => a.name.localeCompare(b.name));

  const title = "Current Inventory Level Report";
  const subtitle = `Report generated on: ${formatDateForDisplay(startVal)} – ${formatDateForDisplay(endVal)}`;
  setReportHeader(title, subtitle);

  if (rows.length === 0) {
    showNoData();
    return;
  }

  const headers = ["Item Name", "Item Category", "Unit Price", "Stock Level", "Total Value"];
  const tableRows = rows.map(r => [
    `<strong>${r.name}</strong>`,
    r.category,
    `₱${r.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
    r.stockLevel,
    `₱${r.totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
  ]);
  showTable(headers, tableRows);
}

// ============================================================================
// REPORT: STOCK MOVEMENT
// ============================================================================
function generateMovementReport(range) {
  const { start, end, startVal, endVal } = range;

  const filtered = allInventory
    .filter(row => {
      const ts = row.timeStamp ?? row.TimeStamp;
      const d = parseTimestamp(ts);
      return d && d >= start && d <= end;
    })
    .sort((a, b) => {
      const ta = parseTimestamp(a.timeStamp ?? a.TimeStamp);
      const tb = parseTimestamp(b.timeStamp ?? b.TimeStamp);
      return tb - ta;
    });

  const title = "Stock Movement Report";
  const subtitle = `Report generated on: ${formatDateForDisplay(startVal)} – ${formatDateForDisplay(endVal)}`;
  setReportHeader(title, subtitle);

  if (filtered.length === 0) {
    showNoData();
    return;
  }

  const headers = [
    "Date & Time", "Item Name", "Item Category",
    "Event Type", "Quantity", "Performed By", "Approved By"
  ];

  const tableRows = filtered.map(row => {
    const ts = row.timeStamp ?? row.TimeStamp;
    const action = row.action ?? row.Action ?? row.status ?? row.Status ?? "N/A";
    const performer = row.performedBy ?? row.PerformedBy ?? "System";
    const approver = row.approvedBy ?? row.ApprovedBy ?? "N/A";
    return [
      formatTimestamp(ts),
      `<strong>${row.itemName ?? row.ItemName ?? "Unknown"}</strong>`,
      row.category ?? row.Category ?? "N/A",
      action,
      row.quantity ?? row.Quantity ?? 0,
      performer,
      approver
    ];
  });

  showTable(headers, tableRows);
}

// ============================================================================
// REPORT: EXPENSE / FINANCIAL
// ============================================================================
function generateFinancialReport(range) {
  const { start, end, startVal, endVal } = range;

  // Financial = Stock-In and Add Item transactions (incoming purchases)
  const filtered = allInventory
    .filter(row => {
      const ts = row.timeStamp ?? row.TimeStamp;
      const d = parseTimestamp(ts);
      if (!d || d < start || d > end) return false;
      const action = (row.action ?? row.Action ?? row.status ?? row.Status ?? "").toLowerCase();
      return (
        action.includes("stock-in") ||
        action.includes("add item") ||
        action.includes("fresh stock") ||
        action === ""
      );
    })
    .sort((a, b) => {
      const ta = parseTimestamp(a.timeStamp ?? a.TimeStamp);
      const tb = parseTimestamp(b.timeStamp ?? b.TimeStamp);
      return tb - ta;
    });

  const title = "Expense / Financial Report";
  const subtitle = `Report generated on: ${formatDateForDisplay(startVal)} – ${formatDateForDisplay(endVal)}`;
  setReportHeader(title, subtitle);

  if (filtered.length === 0) {
    showNoData();
    return;
  }

  const headers = [
    "Date & Time", "Item Name", "Item Category",
    "Unit Price", "Quantity Purchased", "Total Cost"
  ];

  const tableRows = filtered.map(row => {
    const ts = row.timeStamp ?? row.TimeStamp;
    const qty = row.quantity ?? row.Quantity ?? 0;
    const price = row.price ?? row.Price ?? 0;
    const totalCost = qty * price;
    return [
      formatTimestamp(ts),
      `<strong>${row.itemName ?? row.ItemName ?? "Unknown"}</strong>`,
      row.category ?? row.Category ?? "N/A",
      `₱${price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      qty,
      `₱${totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    ];
  });

  showTable(headers, tableRows);
}

// ============================================================================
// UI RENDERING HELPERS
// ============================================================================
function setReportHeader(title, subtitle) {
  document.getElementById("reportScreenTitle").textContent = title;
  document.getElementById("reportDateRangeLabel").textContent = subtitle;
  document.getElementById("reportTableContainer").classList.remove("hidden");
  document.getElementById("reportTableContainer").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showNoData() {
  document.getElementById("noDataMessage").classList.remove("hidden");
  document.getElementById("reportTable").classList.add("hidden");
  document.getElementById("reportTableHead").innerHTML = "";
  document.getElementById("reportTableBody").innerHTML = "";
}

function showTable(headers, rows) {
  document.getElementById("noDataMessage").classList.add("hidden");
  document.getElementById("reportTable").classList.remove("hidden");

  document.getElementById("reportTableHead").innerHTML =
    `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;

  document.getElementById("reportTableBody").innerHTML =
    rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
}

// ============================================================================
// PRINT
// ============================================================================
document.getElementById("btnPrintReport").addEventListener("click", () => {
  window.print();
});

// ============================================================================
// LIFECYCLE
// ============================================================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initReports);
} else {
  initReports();
}
