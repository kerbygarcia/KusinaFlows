// ============================================================================
// CONFIGURATION & LIVE BACKEND CORRELATION
// ============================================================================
const API_BASE_URL = "http://localhost:5244/api"; 

let rawInventory = [];

// DOM Elements - KPI Summary Cards
const totalProductsEl = document.getElementById("totalProducts");
const lowStockEl = document.getElementById("lowStock");
const outOfStockEl = document.getElementById("outOfStock");
const inStockEl = document.getElementById("inStock");
const topItemEl = document.getElementById("topItem");

// DOM Elements - Interactive Components
const activityTable = document.getElementById("activityTable");
const topStockedChart = document.getElementById("topStockedChart");

// ============================================================================
// INITIALIZATION & LIVE DATA PIPELINE FETCHERS
// ============================================================================
async function initDashboard() {
  try {
    const inventoryResponse = await fetch(`${API_BASE_URL}/inventory`);
    if (!inventoryResponse.ok) throw new Error(`Server status: ${inventoryResponse.status}`);
    
    rawInventory = await inventoryResponse.json();

    renderSummaryCards();
    renderActivityTable();
    renderTopStockedChart();

  } catch (error) {
    console.error("Dashboard calculation engine crash:", error);
    if (totalProductsEl) totalProductsEl.textContent = "⚠️";
    if (topItemEl) topItemEl.textContent = "Server Offline";
  }
}

// ============================================================================
// MATH & ANALYTICAL CARD METRICS ENGINE
// ============================================================================
function renderSummaryCards() {
  const uniqueItemsMap = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let inStockCount = 0;

  rawInventory.forEach(row => {
    // Handling potential camelCase vs PascalCase from serialization
    const utdY = row.utDyear ?? row.utdYear ?? row.UTDyear;
    const utdM = row.utDmonth ?? row.utdMonth ?? row.UTDmonth;
    const utdD = row.utDday ?? row.utdDay ?? row.UTDday;
    const qty = row.quantity ?? row.Quantity ?? 0;
    const price = row.price ?? row.Price ?? 0;
    const name = row.itemName ?? row.ItemName ?? "Unknown";

    if (!utdY || !utdM || !utdD) return;

    const expiryDate = new Date(utdY, utdM - 1, utdD);
    expiryDate.setHours(0, 0, 0, 0);
    const isAvailable = (expiryDate - today >= 0) && qty > 0;

    if (!uniqueItemsMap[name]) {
      uniqueItemsMap[name] = { totalQty: 0, price: price };
    }
    
    if (isAvailable) {
      uniqueItemsMap[name].totalQty += qty;
    }
  });

  const productsList = Object.keys(uniqueItemsMap);
  let totalProducts = productsList.length;
  
  let highestQty = -1;
  let highestStockItemName = "-";

  productsList.forEach(name => {
    const qty = uniqueItemsMap[name].totalQty;

    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= 5) {
      lowStockCount++;
    } else {
      inStockCount++;
    }

    if (qty > highestQty && qty > 0) {
      highestQty = qty;
      highestStockItemName = `${name} (${qty})`;
    }
  });

  if (totalProductsEl) totalProductsEl.textContent = totalProducts;
  if (lowStockEl) lowStockEl.textContent = lowStockCount;
  if (outOfStockEl) outOfStockEl.textContent = outOfStockCount;
  if (inStockEl) inStockEl.textContent = inStockCount;
  if (topItemEl) topItemEl.textContent = highestStockItemName;
}

// ============================================================================
// RECENT ACTIVITY AUDIT STREAM
// ============================================================================
function renderActivityTable() {
  if (!activityTable) return;
  activityTable.innerHTML = "";

  if (rawInventory.length === 0) {
    activityTable.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">No recent transactions logged yet.</td></tr>`;
    return;
  }

  // Sort by the actual TimeStamp field descending (newest entries first)
  const sortedLogs = [...rawInventory].sort((a, b) => {
    const timeA = new Date(a.timeStamp || a.TimeStamp || 0);
    const timeB = new Date(b.timeStamp || b.TimeStamp || 0);
    return timeB - timeA;
  });

  const recentLogs = sortedLogs.slice(0, 5);

  recentLogs.forEach(log => {
    const tr = document.createElement("tr");
    
    // Parse the Postgres timestamp string safely
    let formattedDateTime = "N/A";
    const ts = log.timeStamp || log.TimeStamp;
    if (ts) {
      // Replaces space with 'T' to make it fully ISO compliant for JavaScript's Date parser
      const dateObj = new Date(ts.replace(" ", "T"));
      if (!isNaN(dateObj.getTime())) {
        formattedDateTime = dateObj.toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        });
      }
    }

    // Resolve structural action metadata properties
    const currentAction = log.action || log.Action || log.status || log.Status || "Fresh Stock";
    let typeClass = "in-stock";
    if (currentAction.toLowerCase().includes("out")) typeClass = "expired";
    if (currentAction.toLowerCase().includes("add")) typeClass = "low-stock";

    // Strict look-up chain matching your database columns
    const performer = log.performedBy || log.PerformedBy || "System";
    const approver = log.approvedBy || log.ApprovedBy || "N/A";
    const itemName = log.itemName || log.ItemName || "Unknown";
    const quantity = log.quantity ?? log.Quantity ?? 0;

    tr.innerHTML = `
      <td>${formattedDateTime}</td>
      <td><strong>${itemName}</strong></td>
      <td><span class="${typeClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-block;">${currentAction}</span></td>
      <td>${quantity}</td>
      <td>${performer}</td>
      <td>${approver}</td>
    `;
    activityTable.appendChild(tr);
  });
}

// ============================================================================
// DYNAMIC BAR CHART VISUALIZATION (PURE CSS/JS)
// ============================================================================
function renderTopStockedChart() {
  if (!topStockedChart) return;
  topStockedChart.innerHTML = "";

  const uniqueItemsMap = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  rawInventory.forEach(row => {
    const utdY = row.utDyear ?? row.utdYear ?? row.UTDyear;
    const utdM = row.utDmonth ?? row.utdMonth ?? row.UTDmonth;
    const utdD = row.utDday ?? row.utdDay ?? row.UTDday;
    const qty = row.quantity ?? row.Quantity ?? 0;
    const name = row.itemName ?? row.ItemName ?? "Unknown";

    if (!utdY || !utdM || !utdD) return;

    const expiryDate = new Date(utdY, utdM - 1, utdD);
    expiryDate.setHours(0, 0, 0, 0);
    const isAvailable = (expiryDate - today >= 0) && qty > 0;

    if (!uniqueItemsMap[name]) {
      uniqueItemsMap[name] = 0;
    }
    if (isAvailable) {
      uniqueItemsMap[name] += qty;
    }
  });

  const topItems = Object.keys(uniqueItemsMap)
    .map(name => ({ name: name, qty: uniqueItemsMap[name] }))
    .filter(item => item.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  if (topItems.length === 0) {
    topStockedChart.innerHTML = `<p style="text-align:center; color:#888; padding:20px;">No stocked items available to visualize.</p>`;
    return;
  }

  const maxQty = Math.max(...topItems.map(i => i.qty));

  topItems.forEach(item => {
    const percentageWidth = (item.qty / maxQty) * 100;
    const chartRow = document.createElement("div");
    chartRow.style.margin = "15px 0";
    chartRow.style.display = "flex";
    chartRow.style.alignItems = "center";
    chartRow.style.fontSize = "13px";

    chartRow.innerHTML = `
      <div style="width: 120px; font-weight: bold; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; padding-right: 10px;">
        ${item.name}
      </div>
      <div style="flex: 1; background: #eee; border-radius: 4px; height: 20px; margin-right: 10px; overflow: hidden;">
        <div style="width: ${percentageWidth}%; background: #4a3828; height: 100%; border-radius: 4px; transition: width 0.5s ease-in-out;"></div>
      </div>
      <div style="width: 40px; font-weight: 600; text-align: right; color: #4a3828;">
        ${item.qty}
      </div>
    `;
    topStockedChart.appendChild(chartRow);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}