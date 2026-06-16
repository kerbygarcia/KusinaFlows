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
    // 📦 1. Fetch active inventory metrics & chart data
    const inventoryResponse = await fetch(`${API_BASE_URL}/inventory`);
    if (!inventoryResponse.ok) throw new Error(`Server status: ${inventoryResponse.status}`);
    rawInventory = await inventoryResponse.json();

    // 📊 Render active components
    renderSummaryCards();
    renderTopStockedChart();

    // 📜 2. Fetch independent true transactional logs for the activity feed
    await fetchRecentActivityLogs();

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
// RECENT ACTIVITY AUDIT STREAM (UPDATED FOR /ALL-HISTORY)
// ============================================================================
async function fetchRecentActivityLogs() {
  if (!activityTable) return;
  activityTable.innerHTML = "";

  try {
    // 🎯 Target the actual history ledger endpoint
    const response = await fetch(`${API_BASE_URL}/inventory/all-history`);
    if (!response.ok) throw new Error(`History status: ${response.status}`);
    
    const historyData = await response.json();

    if (historyData.length === 0) {
      activityTable.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">No recent transactions logged yet.</td></tr>`;
      return;
    }

    // Grab the top 5 most recent records
    const recentLogs = historyData.slice(0, 5);

    recentLogs.forEach(log => {
      const tr = document.createElement("tr");
      
      // Parse timestamp string safely
      let formattedDateTime = "N/A";
      const ts = log.dateTime || log.DateTime || log.timeStamp || log.TimeStamp;
      if (ts) {
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
        } else {
          formattedDateTime = ts;
        }
      }

      // Action color styling filters
      const currentAction = log.action || "Fresh Stock";
      let typeStyle = "background: #e3fafc; color: #0c8599;"; // Edit/Other
      
      if (currentAction.toLowerCase().includes("in") || currentAction.toLowerCase().includes("add")) {
        typeStyle = "background: #d4edda; color: #28a745;"; // Stock-In / Add
      } else if (currentAction.toLowerCase().includes("out")) {
        typeStyle = "background: #ffe0e3; color: #ff4757;"; // Stock-Out
      }

      // Map safely to the key shapes coming out of your backend history endpoint
      const performer = log.performedBy || "System Auto";
      const approver = log.approvedBy || "N/A";
      const itemName = log.itemName || "Unknown";
      const quantity = log.quantity ?? 0;

      tr.innerHTML = `
        <td>${formattedDateTime}</td>
        <td><strong>${itemName}</strong></td>
        <td><span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-block; ${typeStyle}">${currentAction}</span></td>
        <td><strong>${quantity}</strong></td>
        <td>${performer.split(' (')[0]}</td>
        <td>${approver.split(' (')[0]}</td>
      `;
      activityTable.appendChild(tr);
    });

  } catch (error) {
    console.error("Failed to render true dashboard activity feed:", error);
    activityTable.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#ff4757; font-weight:bold;">⚠️ Error loading recent activity.</td></tr>`;
  }
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

// Lifecycle Bootstrapper
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}