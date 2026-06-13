// load inventory from localStorage
let inventory = JSON.parse(localStorage.getItem("inventory")) || [];
let stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];


let editingItemId = null;
let currentStockAction = "";
let currentView = inventory;

// user approval helper
function setupApprovalInputs() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || { name: "Chef Kiko", role: "Owner" };
  const itemSection = document.getElementById("itemApprovalSection");
  const itemApprover = document.getElementById("itemApprover");
  const stockSection = document.getElementById("stockApprovalSection");
  const stockApprover = document.getElementById("stockApprover");

  if (currentUser.role === "Employee") {
    // Populate dropdown with active Owners/Admins
    const staffList = JSON.parse(localStorage.getItem("staffList")) || [];
    const activeManagers = staffList.filter(s => s.status === "Active" && (s.role === "Owner" || s.role === "Admin"));
    const optionsHtml = activeManagers.length === 0 
      ? `<option value="">No managers available</option>` 
      : activeManagers.map(m => `<option value="${m.fullName}">${m.fullName} (${m.role})</option>`).join("");

    if (itemSection) itemSection.classList.remove("hidden");
    if (itemApprover) {
      itemApprover.required = true;
      itemApprover.innerHTML = optionsHtml;
    }
    if (stockSection) stockSection.classList.remove("hidden");
    if (stockApprover) {
      stockApprover.required = true;
      stockApprover.innerHTML = optionsHtml;
    }
  } else {
    if (itemSection) itemSection.classList.add("hidden");
    if (itemApprover) {
      itemApprover.required = false;
      itemApprover.innerHTML = "";
    }
    if (stockSection) stockSection.classList.add("hidden");
    if (stockApprover) {
      stockApprover.required = false;
      stockApprover.innerHTML = "";
    }
  }
}
let isLowStockView = false;


// elements
const inventoryTableBody = document.getElementById("inventoryTableBody");


const itemModal = document.getElementById("itemModal");
const stockModal = document.getElementById("stockModal");


const itemForm = document.getElementById("itemForm");
const stockForm = document.getElementById("stockForm");


const stockItemSelect = document.getElementById("stockItemSelect");
const searchInput = document.getElementById("searchInput");


const modalTitle = document.getElementById("modalTitle");
const stockModalTitle = document.getElementById("stockModalTitle");


// save to storage
function saveData() {
  localStorage.setItem("inventory", JSON.stringify(inventory));
}


// total quantity from batches
function getTotalQuantity(item) {
  return (item.batches || []).reduce((sum, b) => sum + b.quantity, 0);
}


// format price
function formatPrice(value) {
  return Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}


// stock status
function getStatus(item) {
  const qty = getTotalQuantity(item);


  if (qty <= 0) return { text: "Out of Stock", class: "expired" };
  if (qty <= 5) return { text: "Low Stock", class: "low-stock" };
  return { text: "In Stock", class: "in-stock" };
}


// low stock indicator button
function updateLowStockButton() {
  const btn = document.getElementById("lowStockBtn");
  const hasCritical = inventory.some(i => getTotalQuantity(i) <= 5);


  btn.style.background = hasCritical ? "#ff4757" : "";
}


// render inventory table
function renderInventory(data = currentView) {
  currentView = data;


  inventoryTableBody.innerHTML = "";


  if (data.length === 0) {
    inventoryTableBody.innerHTML = `<tr><td colspan="7">No items found</td></tr>`;
    return;
  }


  data.forEach(item => {
    const status = getStatus(item);


    const row = document.createElement("tr");


    row.innerHTML = `
      <td>
        <span class="expand-btn" onclick="toggleExpand(${item.id})">
          ${item.expanded ? "▲" : "▼"}
        </span>
      </td>


      <td>${item.name}</td>
      <td>₱${formatPrice(item.price)}</td>
      <td>${getTotalQuantity(item)}</td>
      <td>${item.category}</td>
      <td class="${status.class}">${status.text}</td>


      <td>
        <button onclick="editItem(${item.id})">Edit</button>
        <button onclick="viewHistory('${item.name}')" style="background:#5a4d41;color:white;">History</button>
        <button onclick="deleteItem(${item.id})" style="background:red;color:white;">Delete</button>
      </td>
    `;


    inventoryTableBody.appendChild(row);


    if (item.expanded) {
      const batchRow = document.createElement("tr");


      batchRow.innerHTML = `
        <td colspan="7">
          <table class="batch-table">
            <thead>
              <tr>
                <th>Batch Quantity</th>
                <th>Use-Thru-Date</th>
              </tr>
            </thead>
            <tbody>
              ${(item.batches || []).map(b => `
                <tr>
                  <td>${b.quantity}</td>
                  <td>${b.utd}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </td>
      `;


      inventoryTableBody.appendChild(batchRow);
    }
  });


  populateDropdown();
  updateLowStockButton();
}


// expand row
window.toggleExpand = function(id) {
  const item = inventory.find(i => i.id === id);
  item.expanded = !item.expanded;
  renderInventory(currentView);
};


// open add item
document.getElementById("addItemBtn").addEventListener("click", () => {
  editingItemId = null;
  modalTitle.textContent = "Add Item";
  itemForm.reset();
  setupApprovalInputs();
  itemModal.classList.remove("hidden");
});


document.getElementById("closeModal").addEventListener("click", () => {
  itemModal.classList.add("hidden");
});


// save item (fixed batch preservation + validation)
itemForm.addEventListener("submit", e => {
  e.preventDefault();


  const name = document.getElementById("itemName").value.trim();
  const qty = parseInt(document.getElementById("itemQuantity").value);
  const category = document.getElementById("itemCategory").value.trim();
  const price = parseFloat(document.getElementById("itemPrice").value);
  const utd = document.getElementById("itemUTD").value;


  if (!name || !category || !utd) {
    alert("Please complete all required fields.");
    return;
  }


  if (qty <= 0 || isNaN(qty)) {
    alert("Quantity must be greater than 0.");
    return;
  }


  if (price <= 0 || isNaN(price)) {
    alert("Price must be greater than 0.");
    return;
  }


  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || { name: "Chef Kiko", role: "Owner" };
  const isManager = currentUser.role === "Owner" || currentUser.role === "Admin" || currentUser.role === "Manager";
  const approver = isManager ? currentUser.name : document.getElementById("itemApprover").value;
  const now = new Date();


  if (editingItemId === null) {
    inventory.push({
      id: Date.now(),
      name,
      category,
      price,
      expanded: false,
      batches: [{ quantity: qty, utd }]
    });

    // Log the Item Added activity
    stockHistory.unshift({
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      timestamp: now.getTime(),
      item: name,
      type: "Item Added",
      qty: qty,
      user: currentUser.name,
      approvedBy: approver
    });
    localStorage.setItem("stockHistory", JSON.stringify(stockHistory));
  } else {
    const item = inventory.find(i => i.id === editingItemId);
    item.name = name;
    item.category = category;
    item.price = price;


    if (!item.batches || item.batches.length === 0) {
      item.batches = [{ quantity: qty, utd }];
    } else {
      item.batches[0].quantity = qty;
      item.batches[0].utd = utd;
    }
  }


  itemModal.classList.add("hidden");
  saveData();
  renderInventory(inventory);
});


// edit / delete
window.editItem = function(id) {
  const item = inventory.find(i => i.id === id);


  editingItemId = id;
  modalTitle.textContent = "Edit Item";


  document.getElementById("itemName").value = item.name;
  document.getElementById("itemQuantity").value = getTotalQuantity(item);
  document.getElementById("itemCategory").value = item.category;
  document.getElementById("itemPrice").value = item.price;
  document.getElementById("itemUTD").value = item.batches[0].utd;


  itemModal.classList.remove("hidden");
};


window.deleteItem = function(id) {
  if (!confirm("Delete this item?")) return;


  inventory = inventory.filter(i => i.id !== id);
  saveData();
  renderInventory(inventory);
};


// stock modals
document.getElementById("stockInBtn").addEventListener("click", () => {
  currentStockAction = "in";
  stockModalTitle.textContent = "Stock-In";
  populateDropdown();
  setupApprovalInputs();
  stockModal.classList.remove("hidden");
});


document.getElementById("stockOutBtn").addEventListener("click", () => {
  currentStockAction = "out";
  stockModalTitle.textContent = "Stock-Out";
  populateDropdown();
  setupApprovalInputs();
  stockModal.classList.remove("hidden");
});


document.getElementById("closeStockModal").addEventListener("click", () => {
  stockModal.classList.add("hidden");
});


// dropdown
function populateDropdown() {
  stockItemSelect.innerHTML = "";


  if (!inventory || inventory.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No items available";
    option.disabled = true;
    stockItemSelect.appendChild(option);
    return;
  }


  inventory
    .filter(item => item && item.id != null)
    .forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} (${getTotalQuantity(item)})`;
      stockItemSelect.appendChild(option);
    });
}


// stock in/out
stockForm.addEventListener("submit", e => {
  e.preventDefault();


  const id = Number(stockItemSelect.value);
  const qty = parseInt(document.getElementById("stockQuantity").value);
  const utd = document.getElementById("stockUTD").value;


  const item = inventory.find(i => i.id === id);


  if (!item) {
    alert("Item not found");
    return;
  }


  if (qty <= 0 || isNaN(qty)) {
    alert("Quantity must be greater than 0.");
    return;
  }


  const now = new Date();


  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || { name: "Chef Kiko", role: "Owner" };
  const isManager = currentUser.role === "Owner" || currentUser.role === "Admin" || currentUser.role === "Manager";
  const approver = isManager ? currentUser.name : document.getElementById("stockApprover").value;


  if (currentStockAction === "in") {
    if (!item.batches) item.batches = [];
    item.batches.push({ quantity: qty, utd });
    item.batches.sort((a, b) => new Date(a.utd) - new Date(b.utd));


    stockHistory.unshift({
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      timestamp: now.getTime(),
      item: item.name,
      type: "Stock-In",
      qty,
      user: currentUser.name,
      approvedBy: approver
    });
  } else {
    const totalAvailable = getTotalQuantity(item);
    if (qty > totalAvailable) {
      alert(`Cannot stock-out ${qty} items. Only ${totalAvailable} items are available in stock.`);
      return;
    }


    let remaining = qty;


    item.batches.sort((a, b) => new Date(a.utd) - new Date(b.utd));


    for (let b of item.batches) {
      if (remaining <= 0) break;


      if (b.quantity > remaining) {
        b.quantity -= remaining;
        remaining = 0;
      } else {
        remaining -= b.quantity;
        b.quantity = 0;
      }
    }


    item.batches = item.batches.filter(b => b.quantity > 0);


    stockHistory.unshift({
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      timestamp: now.getTime(),
      item: item.name,
      type: "Stock-Out",
      qty,
      user: currentUser.name,
      approvedBy: approver
    });
  }


  stockModal.classList.add("hidden");
  saveData();
  localStorage.setItem("stockHistory", JSON.stringify(stockHistory));
  renderInventory(inventory);
});


// search
searchInput.addEventListener("input", e => {
  const keyword = e.target.value.toLowerCase();


  const filtered = inventory.filter(item =>
    item.name.toLowerCase().includes(keyword) ||
    item.category.toLowerCase().includes(keyword)
  );


  currentView = filtered;
  renderInventory(filtered);
});


// low stock toggle (fixed state logic)
document.getElementById("lowStockBtn").addEventListener("click", () => {
  const btn = document.getElementById("lowStockBtn");


  if (!isLowStockView) {
    currentView = inventory.filter(i => getTotalQuantity(i) <= 5);
    btn.textContent = "Show All";
    isLowStockView = true;
  } else {
    currentView = inventory;
    btn.textContent = "Low Stock Items";
    isLowStockView = false;
  }


  renderInventory(currentView);
});


window.viewHistory = function(name) {
  window.location.href = `stock-history.html?item=${encodeURIComponent(name)}`;
};

// init
function initPage() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || { name: "Chef Kiko", role: "Owner" };
  const isManager = currentUser.role === "Owner" || currentUser.role === "Admin" || currentUser.role === "Manager";
  const addItemBtn = document.getElementById("addItemBtn");
  
  if (!isManager) {
    if (addItemBtn) addItemBtn.style.display = "none";
  } else {
    if (addItemBtn) addItemBtn.style.display = "";
  }
  renderInventory();
}

initPage();

