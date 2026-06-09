// load inventory from localStorage
let inventory = JSON.parse(localStorage.getItem("inventory")) || [];


// load stock history
let stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];


let editingItemId = null;
let currentStockAction = "";
let currentView = inventory;
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


// save inventory
function saveData() {
  localStorage.setItem("inventory", JSON.stringify(inventory));
}


// save history
function saveHistory() {
  localStorage.setItem("stockHistory", JSON.stringify(stockHistory));
}


// total quantity
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


// status
function getStatus(item) {
  const qty = getTotalQuantity(item);


  if (qty <= 0) return { text: "Out of Stock", class: "expired" };
  if (qty <= 5) return { text: "Low Stock", class: "low-stock" };
  return { text: "In Stock", class: "in-stock" };
}


// low stock button
function updateLowStockButton() {
  const btn = document.getElementById("lowStockBtn");
  const hasCritical = inventory.some(i => getTotalQuantity(i) <= 5);


  btn.style.background = hasCritical ? "#ff4757" : "";
}


// render inventory
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


// expand
window.toggleExpand = function(id) {
  const item = inventory.find(i => i.id === id);
  item.expanded = !item.expanded;
  renderInventory(currentView);
};


// add item modal
document.getElementById("addItemBtn").addEventListener("click", () => {
  editingItemId = null;
  modalTitle.textContent = "Add Item";
  itemForm.reset();
  itemModal.classList.remove("hidden");
});


document.getElementById("closeModal").addEventListener("click", () => {
  itemModal.classList.add("hidden");
});


// save item
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


  if (editingItemId === null) {
    inventory.push({
      id: Date.now(),
      name,
      category,
      price,
      expanded: false,
      batches: [{ quantity: qty, utd }]
    });
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


// edit/delete
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
  stockModal.classList.remove("hidden");
});


document.getElementById("stockOutBtn").addEventListener("click", () => {
  currentStockAction = "out";
  stockModalTitle.textContent = "Stock-Out";
  populateDropdown();
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


  if (currentStockAction === "in") {
    item.batches.push({ quantity: qty, utd });


    stockHistory.unshift({
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      item: item.name,
      type: "Stock-In",
      qty
    });


  } else {
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
      item: item.name,
      type: "Stock-Out",
      qty
    });
  }


  stockModal.classList.add("hidden");


  saveData();
  saveHistory();
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


// low stock toggle
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


// REAL-TIME SYNC (FIXED)
function refreshDashboard() {
  inventory = JSON.parse(localStorage.getItem("inventory")) || [];
  stockHistory = JSON.parse(localStorage.getItem("stockHistory")) || [];


  renderInventory(inventory);
}


// real-time listeners
window.addEventListener("focus", refreshDashboard);
window.addEventListener("storage", refreshDashboard);


// init
refreshDashboard();

