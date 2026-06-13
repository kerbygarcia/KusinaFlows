// ============================================================================
// CONFIGURATION & LIVE BACKEND CORRELATION
// ============================================================================
// Pointing to your active KusinaFlows local development server
const API_BASE_URL = "http://localhost:5244/api"; 

let rawInventory = [];
let stockHistory = [];

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
    // 1. Fetch data from your live server endpoints
    const inventoryResponse = await fetch(`${API_BASE_URL}/inventory`);
    
    // Fallback stub endpoint if you have a separate history endpoint, 
    // otherwise we extract historical transaction flags safely.
    let historyResponse;
    try {
      historyResponse = await fetch(`${API_BASE_URL}/inventory/history`);
    } catch(e) {
      console.warn("History endpoint unavailable, defaulting to empty logging.");
    }

    if (!inventoryResponse.ok) throw new Error(`Server status: ${inventoryResponse.status}`);
    
    rawInventory = await inventoryResponse.json();
    stockHistory = historyResponse && historyResponse.ok ? await historyResponse.json() : [];

    // 2. Execute computational visualization pipelines
    renderSummaryCards();
    renderActivityTable();
    renderTopStockedChart();

  } catch (error) {
    console.error("Dashboard calculation engine crash:", error);
    // Display visual system warning card if communication fails
    if (totalProductsEl) totalProductsEl.textContent = "⚠️";
    if (topItemEl) topItemEl.textContent = "Server Offline";
  }
}

// ============================================================================
// MATH & ANALYTICAL CARD METRICS ENGINE
// ============================================================================
function renderSummaryCards() {
  // Aggregate item names into a map to count unique catalog items accurately
  const uniqueItemsMap = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let inStockCount = 0;

  // Group raw backend batches by item name to compute active operational quantities
  rawInventory.forEach(row => {
    // Determine structural batch usability state based on your engine's logic
    const expiryDate = new Date(row.utDyear, row.utDmonth - 1, row.utDday);
    expiryDate.setHours(0, 0, 0, 0);
    const isAvailable = (expiryDate - today >= 0) && row.quantity > 0;

    if (!uniqueItemsMap[row.itemName]) {
      uniqueItemsMap[row.itemName] = { totalQty: 0, price: row.price };
    }
    
    if (isAvailable) {
      uniqueItemsMap[row.itemName].totalQty += row.quantity;
    }
  });

  const productsList = Object.keys(uniqueItemsMap);
  let totalProducts = productsList.length;
  
  let highestQty = -1;
  let highestStockItemName = "-";

  productsList.forEach(name => {
    const qty = uniqueItemsMap[name].totalQty;

    // Calculate item stock status groupings
    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= 5) {
      lowStockCount++;
    } else {
      inStockCount++;
    }

    // Determine highest stocked tracking configuration
    if (qty > highestQty && qty > 0) {
      highestQty = qty;
      highestStockItemName = `${name} (${qty})`;
    }
  });

  // Assign text values safely to DOM elements if they exist in your UI template
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

  // Take top 5 most recent records
  const recentLogs = stockHistory.slice(0, 5);

  if (recentLogs.length === 0) {
    activityTable.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">No recent transactions logged yet.</td></tr>`;
    return;
  }

  recentLogs.forEach(log => {
    const tr = document.createElement("tr");
    
    // 1. Process and format your C# backend TimeStamp safely
    let formattedDateTime = "N/A";
    if (log.timeStamp) {
      const dateObj = new Date(log.timeStamp);
      // Formats nicely to local style, e.g., "06/13/2026, 2:52 PM"
      formattedDateTime = dateObj.toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    }

    // 2. Normalize CSS style classes dynamically based on the log.action string
    let typeClass = "";
    const currentAction = log.action || "";

    if (currentAction === "Stock-In") typeClass = "in-stock";
    if (currentAction === "Stock-Out") typeClass = "expired"; 
    if (currentAction === "Add Item") typeClass = "low-stock";

    // 3. Render matching properties directly to the UI row container
    tr.innerHTML = `
      <td>${formattedDateTime}</td>
      <td><strong>${log.itemName || "Unknown"}</strong></td>
      <td><span class="${typeClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-block;">${currentAction}</span></td>
      <td>${log.quantity ?? 0}</td>
      <td>${log.user || "System"}</td>
      <td>${log.approvedBy || "N/A"}</td>
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

  // Parse server records into flat display groups
  rawInventory.forEach(row => {
    const expiryDate = new Date(row.utDyear, row.utDmonth - 1, row.utDday);
    expiryDate.setHours(0, 0, 0, 0);
    const isAvailable = (expiryDate - today >= 0) && row.quantity > 0;

    if (!uniqueItemsMap[row.itemName]) {
      uniqueItemsMap[row.itemName] = 0;
    }
    if (isAvailable) {
      uniqueItemsMap[row.itemName] += row.quantity;
    }
  });

  // Sort groups descending by calculated volume amounts
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

// Fire data compute pipeline automatically when DOM loads safely
document.addEventListener("DOMContentLoaded", initDashboard);