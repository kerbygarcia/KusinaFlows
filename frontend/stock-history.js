// load stock history
let stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];

// Render stock history
function renderHistory() {
  const tableBody = document.getElementById("historyTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (stockHistory.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">No stock activities recorded yet.</td></tr>`;
    return;
  }

  stockHistory.forEach(act => {
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

    tableBody.appendChild(row);
  });
}

// Refresh listeners
function refreshHistory() {
  stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];
  renderHistory();
}

window.addEventListener("focus", refreshHistory);
window.addEventListener("storage", refreshHistory);

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  renderHistory();
});
