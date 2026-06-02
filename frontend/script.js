/* Write manager for all access, employee for stock-in and stock-out only */

const currentUserRole = "manager";

let inventory = [];
let stockHistory = [];
let stockRequests = [];

let editingItemId = null;
let currentStockAction = "";

/* Dom elements */

const inventoryTableBody =
  document.getElementById("inventoryTableBody");

const totalItems =
  document.getElementById("totalItems");

const lowStockCount =
  document.getElementById("lowStockCount");

const inventoryValue =
  document.getElementById("inventoryValue");

const itemModal =
  document.getElementById("itemModal");

const stockModal =
  document.getElementById("stockModal");

const itemForm =
  document.getElementById("itemForm");

const stockForm =
  document.getElementById("stockForm");

const stockItemSelect =
  document.getElementById("stockItemSelect");

const searchInput =
  document.getElementById("searchInput");

const modalTitle =
  document.getElementById("modalTitle");

/* User roles */

function applyUserRole(){

  if(currentUserRole === "employee"){

    document
      .querySelectorAll(".manager-only")
      .forEach(element => {

        element.classList.add("hidden");

      });

  }

}

applyUserRole();

/* Inventory Value */

function calculateInventoryValue(){

  let total = 0;

  inventory.forEach(item => {

    item.batches.forEach(batch => {

      total += batch.quantity * item.price;

    });

  });

  return total;

}

/* Format Price */

function formatPrice(value){

  return value.toLocaleString(
    "en-PH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );

}

/* Total Quantity */

function getTotalQuantity(item){

  return item.batches.reduce((sum, batch) => {

    return sum + batch.quantity;

  }, 0);

}

/* UTD Status */

function getUTDStatus(item){

  const totalQuantity =
    getTotalQuantity(item);

  if(totalQuantity <= 5){

    return {
      text: "Running Out",
      className: "running-out"
    };

  }

  return {
    text: "Safe",
    className: "safe"
  };

}

/* Add Item Modal */

document
  .getElementById("addItemBtn")
  .addEventListener("click", () => {

    editingItemId = null;

    modalTitle.textContent =
      "Add Inventory Item";

    itemForm.reset();

    itemModal.classList.remove("hidden");

  });

/* Close Item Modal */

document
  .getElementById("closeModal")
  .addEventListener("click", () => {

    itemModal.classList.add("hidden");

  });

/* Save Item */

itemForm.addEventListener("submit", (e) => {

  e.preventDefault();

  const name =
    document.getElementById("itemName")
      .value.trim();

  const quantity = parseInt(
    document.getElementById("itemQuantity")
      .value
  );

  const category =
    document.getElementById("itemCategory")
      .value.trim();

  const price = parseFloat(
    document.getElementById("itemPrice")
      .value
  );

  const utd =
    document.getElementById("itemUTD")
      .value;

  if(
    !name ||
    !category ||
    quantity < 0 ||
    price < 0
  ){

    alert("Please enter valid information.");

    return;

  }

  if(editingItemId === null){

    inventory.push({

      id: Date.now(),

      name,
      category,
      price,

      expanded: false,

      batches: [
        {
          batchId: Date.now(),
          quantity,
          utd
        }
      ]

    });

    stockHistory.push(
      `Added item: ${name}`
    );

  }

  else{

    const item =
      inventory.find(
        item => item.id === editingItemId
      );

    item.name = name;
    item.category = category;
    item.price = price;

    item.batches[0].quantity = quantity;
    item.batches[0].utd = utd;

  }

  renderInventory();

  itemModal.classList.add("hidden");

});

/* Render Inventory */

function renderInventory(filteredItems = inventory){

  inventoryTableBody.innerHTML = "";

  if(filteredItems.length === 0){

    inventoryTableBody.innerHTML = `
      <tr>
        <td colspan="7">
          No inventory items found.
        </td>
      </tr>
    `;

    updateDashboard();

    return;

  }

  filteredItems.forEach(item => {

    const totalQuantity =
      getTotalQuantity(item);

    const status =
      getUTDStatus(item);

    const row =
      document.createElement("tr");

    row.innerHTML = `

      <td>

        <span
          class="expand-btn"
          onclick="toggleExpand(${item.id})"
        >

          ${item.expanded ? "▲" : "▼"}

        </span>

      </td>

      <td>${item.name}</td>

      <td>₱${formatPrice(item.price)}</td>

      <td>${totalQuantity}</td>

      <td>${item.category}</td>

      <td>

        <span class="${status.className}">
          ${status.text}
        </span>

      </td>

      <td>

        ${currentUserRole === "manager" ? `

          <button
            class="action-btn"
            onclick="editItem(${item.id})"
          >
            Edit
          </button>

          <button
            class="action-btn delete-btn"
            onclick="deleteItem(${item.id})"
          >
            Delete
          </button>

        ` : ""}

      </td>

    `;

    inventoryTableBody.appendChild(row);

    /* Batch Rows */

    if(item.expanded){

      const batchRow =
        document.createElement("tr");

      batchRow.classList.add("batch-row");

      batchRow.innerHTML = `

        <td colspan="7">

          <div class="batch-container">

            <table class="batch-table">

              <thead>

                <tr>

                  <th>Batch Quantity</th>
                  <th>Use-Thru-Date</th>

                </tr>

              </thead>

              <tbody>

                ${item.batches.map(batch => `

                  <tr>

                    <td>${batch.quantity}</td>

                    <td>${batch.utd}</td>

                  </tr>

                `).join("")}

              </tbody>

            </table>

          </div>

        </td>

      `;

      inventoryTableBody.appendChild(batchRow);

    }

  });

  updateDashboard();

  populateStockDropdown();

}

/* Toggle Expand */

function toggleExpand(id){

  const item =
    inventory.find(
      item => item.id === id
    );

  item.expanded = !item.expanded;

  renderInventory();

}

/* Dashboard */

function updateDashboard(){

  totalItems.textContent =
    inventory.length;

  lowStockCount.textContent =
    inventory.filter(item =>
      getTotalQuantity(item) <= 5
    ).length;

  inventoryValue.textContent =
    `₱${formatPrice(
      calculateInventoryValue()
    )}`;

}

/* Edit Item */

function editItem(id){

  editingItemId = id;

  const item =
    inventory.find(
      item => item.id === id
    );

  modalTitle.textContent =
    "Edit Inventory Item";

  document.getElementById("itemName")
    .value = item.name;

  document.getElementById("itemQuantity")
    .value = item.batches[0].quantity;

  document.getElementById("itemCategory")
    .value = item.category;

  document.getElementById("itemPrice")
    .value = item.price;

  document.getElementById("itemUTD")
    .value = item.batches[0].utd;

  itemModal.classList.remove("hidden");

}

/* Delete Item */

function deleteItem(id){

  const confirmed =
    confirm("Delete this item?");

  if(!confirmed) return;

  const deletedItem =
    inventory.find(
      item => item.id === id
    );

  inventory =
    inventory.filter(
      item => item.id !== id
    );

  stockHistory.push(
    `Deleted item: ${deletedItem.name}`
  );

  renderInventory();

}

/* Search */

searchInput.addEventListener("keyup", () => {

  const keyword =
    searchInput.value.toLowerCase();

  const filteredItems =
    inventory.filter(item => {

      return (
        item.name.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword)
      );

    });

  renderInventory(filteredItems);

});

/* Stock Dropdown */

function populateStockDropdown(){

  stockItemSelect.innerHTML = "";

  inventory.forEach(item => {

    const totalQuantity =
      getTotalQuantity(item);

    if(
      currentStockAction === "stock-out" &&
      totalQuantity <= 0
    ){
      return;
    }

    const option =
      document.createElement("option");

    option.value = item.id;

    option.textContent =
      `${item.name} (${totalQuantity})`;

    stockItemSelect.appendChild(option);

  });

}

/* Stock In */

document
  .getElementById("stockInBtn")
  .addEventListener("click", () => {

    currentStockAction = "stock-in";

    document.getElementById("stockModalTitle")
      .textContent = "Stock-In";

    document.getElementById("stockUTDLabel")
      .style.display = "block";

    document.getElementById("stockUTD")
      .style.display = "block";

    stockForm.reset();

    stockModal.classList.remove("hidden");

  });

/* Stock Out */

document
  .getElementById("stockOutBtn")
  .addEventListener("click", () => {

    currentStockAction = "stock-out";

    document.getElementById("stockModalTitle")
      .textContent = "Stock-Out";

    document.getElementById("stockUTDLabel")
      .style.display = "none";

    document.getElementById("stockUTD")
      .style.display = "none";

    stockForm.reset();

    stockModal.classList.remove("hidden");

  });

/* Close Stock Modal */

document
  .getElementById("closeStockModal")
  .addEventListener("click", () => {

    stockModal.classList.add("hidden");

  });

/* Stock Transaction */

stockForm.addEventListener("submit", (e) => {

  e.preventDefault();

  const itemId =
    Number(stockItemSelect.value);

  const quantity =
    parseInt(
      document.getElementById("stockQuantity")
        .value
    );

  const utd =
    document.getElementById("stockUTD")
      .value;

  if(quantity <= 0 || isNaN(quantity)){

    alert("Enter valid quantity.");

    return;

  }

  const item =
    inventory.find(
      item => item.id === itemId
    );

  /* STOCK-IN */

  if(currentStockAction === "stock-in"){

    item.batches.push({

      batchId: Date.now(),
      quantity,
      utd

    });

    item.batches.sort((a, b) => {

      return new Date(a.utd) - new Date(b.utd);

    });

  }

  /* STOCK-OUT */

  else{

    let remaining = quantity;

    item.batches.sort((a, b) => {

      return new Date(a.utd) - new Date(b.utd);

    });

    for(let batch of item.batches){

      if(remaining <= 0) break;

      if(batch.quantity >= remaining){

        batch.quantity -= remaining;

        remaining = 0;

      }

      else{

        remaining -= batch.quantity;

        batch.quantity = 0;

      }

    }

    item.batches =
      item.batches.filter(
        batch => batch.quantity > 0
      );

  }

  stockHistory.push(
    `${currentStockAction}: ${item.name}`
  );

  renderInventory();

  stockModal.classList.add("hidden");

});

/* Reports */

document
  .getElementById("reportsBtn")
  .addEventListener("click", () => {

    alert(
      `Total Items: ${inventory.length}

Inventory Value:
₱${formatPrice(
  calculateInventoryValue()
)}`
    );

  });

document
  .getElementById("financialBtn")
  .addEventListener("click", () => {

    alert(
      `Inventory Value:
₱${formatPrice(
  calculateInventoryValue()
)}`
    );

  });

document
  .getElementById("stockHistoryBtn")
  .addEventListener("click", () => {

    if(stockHistory.length === 0){

      alert("No stock history.");

      return;

    }

    alert(
      stockHistory.join("\n")
    );

  });

/* Log out */

document
  .getElementById("logoutBtn")
  .addEventListener("click", () => {

    alert("Logging out...");

  });

/* Initialize */

renderInventory();