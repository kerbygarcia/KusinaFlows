// load stock history
let stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];
let inventory = JSON.parse(localStorage.getItem("inventory")) || [];

// Populate items filter dropdown
function populateItemFilter() {
  const select = document.getElementById("itemFilterSelect");
  if (!select) return;

  // Get unique item names from both inventory and stockHistory
  const items = new Set();
  inventory.forEach(i => items.add(i.name));
  stockHistory.forEach(h => items.add(h.item));

  // Sort and append
  const sortedItems = Array.from(items).sort();
  sortedItems.forEach(itemName => {
    const opt = document.createElement("option");
    opt.value = itemName;
    opt.textContent = itemName;
    select.appendChild(opt);
  });
}

// Render stock history
function renderHistory() {
  const tableBody = document.getElementById("historyTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  const filterSelect = document.getElementById("itemFilterSelect");
  const selectedItem = filterSelect ? filterSelect.value : "all";

  // Filter history
  const filteredHistory = selectedItem === "all" 
    ? stockHistory 
    : stockHistory.filter(h => h.item === selectedItem);

  // Toggle clear button
  const clearBtn = document.getElementById("btnClearFilter");
  if (clearBtn) {
    clearBtn.style.display = selectedItem === "all" ? "none" : "inline-block";
  }

  if (filteredHistory.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">No stock activities recorded for ${selectedItem === "all" ? "any items" : selectedItem}.</td></tr>`;
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

    // Color code transaction types: Stock-In (green), Stock-Out (red), Item Added (orange)
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

// Check URL query parameters
function checkQueryParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const filterItem = urlParams.get("item");
  if (filterItem) {
    const filterSelect = document.getElementById("itemFilterSelect");
    if (filterSelect) {
      // Add option dynamically if it doesn't exist in the list
      let exists = false;
      for (let i = 0; i < filterSelect.options.length; i++) {
        if (filterSelect.options[i].value === filterItem) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = filterItem;
        opt.textContent = filterItem;
        filterSelect.appendChild(opt);
      }
      filterSelect.value = filterItem;
    }
  }
}

// Refresh listeners
function refreshHistory() {
  stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];
  inventory = JSON.parse(localStorage.getItem("inventory")) || [];
  renderHistory();
}

window.addEventListener("focus", refreshHistory);
window.addEventListener("storage", refreshHistory);

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  populateItemFilter();
  checkQueryParams();
  renderHistory();

  const filterSelect = document.getElementById("itemFilterSelect");
  if (filterSelect) {
    filterSelect.addEventListener("change", renderHistory);
  }

  const clearBtn = document.getElementById("btnClearFilter");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (filterSelect) {
        filterSelect.value = "all";
        renderHistory();
      }
    });
  }
});
