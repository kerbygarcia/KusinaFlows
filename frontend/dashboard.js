// load inventory from localStorage
let inventory = JSON.parse(localStorage.getItem("inventory")) || [];

// load stock history
let stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];

// total quantity helper
function getTotalQuantity(item) {
  return (item.batches || []).reduce((sum, b) => sum + b.quantity, 0);
}

// Calculate and render dashboard metrics
function renderDashboardMetrics() {
  const totalProducts = inventory.length;

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let inStockCount = 0;
  let highestStockQty = 0;
  let highestStockItemName = "-";

  inventory.forEach(item => {
    const qty = getTotalQuantity(item);

    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= 5) {
      lowStockCount++;
    } else {
      inStockCount++;
    }

    if (qty > highestStockQty) {
      highestStockQty = qty;
      highestStockItemName = item.name;
    }
  });

  // Update DOM elements
  document.getElementById("totalProducts").textContent = totalProducts;
  document.getElementById("lowStock").textContent = lowStockCount;
  document.getElementById("outOfStock").textContent = outOfStockCount;
  document.getElementById("inStock").textContent = inStockCount;
  
  if (highestStockQty > 0) {
    document.getElementById("topItem").textContent = `${highestStockItemName} (${highestStockQty})`;
  } else {
    document.getElementById("topItem").textContent = "-";
  }
}

// Render the top stocked items bar chart
function renderTopStockedChart() {
  const chartContainer = document.getElementById("topStockedChart");
  if (!chartContainer) return;

  chartContainer.innerHTML = "";

  // Get top 5 stocked items, sorted by quantity descending
  const sortedItems = [...inventory]
    .map(item => ({
      name: item.name,
      qty: getTotalQuantity(item)
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  if (sortedItems.length === 0 || sortedItems[0].qty === 0) {
    chartContainer.innerHTML = `<p style="text-align: center; color: #777; margin-top: 30px;">No stock data available</p>`;
    return;
  }

  const maxQty = sortedItems[0].qty;

  sortedItems.forEach(item => {
    const pct = maxQty > 0 ? (item.qty / maxQty) * 100 : 0;

    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-label" title="${item.name}">${item.name}</div>
      <div class="chart-bar-container">
        <div class="chart-bar" style="width: 0%;"></div>
      </div>
      <div class="chart-value">${item.qty}</div>
    `;
    chartContainer.appendChild(row);

    // Trigger animation after append
    setTimeout(() => {
      const bar = row.querySelector(".chart-bar");
      if (bar) bar.style.width = `${pct}%`;
    }, 50);
  });
}

// Render recent stock activity
function renderRecentActivity() {
  const activityTable = document.getElementById("activityTable");
  if (!activityTable) return;

  activityTable.innerHTML = "";

  // Show only top 10 recent transactions
  const recentActivities = stockHistory.slice(0, 10);

  if (recentActivities.length === 0) {
    activityTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">No recent activity</td></tr>`;
    return;
  }

  recentActivities.forEach(act => {
    const row = document.createElement("tr");

    // Color code transaction types: Stock-In (green), Stock-Out (red), Item Added (orange)
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

    activityTable.appendChild(row);
  });
}

// Refresh whole dashboard
function refreshDashboard() {
  inventory = JSON.parse(localStorage.getItem("inventory")) || [];
  stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];

  renderDashboardMetrics();
  renderTopStockedChart();
  renderRecentActivity();
}

// Real-time listeners
window.addEventListener("focus", refreshDashboard);
window.addEventListener("storage", refreshDashboard);

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  refreshDashboard();
});
