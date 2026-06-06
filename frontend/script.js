/* Write manager for all access, employee for stock-in and stock-out only */

const currentUserRole = "manager";

let inventory = [];
let stockHistory = [];
let stockRequests = [];

let editingItemId = null;
let currentStockAction = "";

/* getting all needed html elements */

const inventoryTableBody =
  document.getElementById("inventoryTableBody");

const totalItems =
  document.getElementById("totalItems");

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

/* hides manager buttons if employee */

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

/* computes total inventory value */

function calculateInventoryValue(){

  let total = 0;

  inventory.forEach(item => {

    item.batches.forEach(batch => {

      total += batch.quantity * item.price;

    });

  });

  return total;

}

/* formats prices with commas */

function formatPrice(value){

  return value.toLocaleString(
    "en-PH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );

}

/* gets total quantity of all batches */

function getTotalQuantity(item){

  return item.batches.reduce((sum, batch) => {

    return sum + batch.quantity;

  }, 0);

}

/* checks stock status */

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

/* opens add item modal */

document
  .getElementById("addItemBtn")
  .addEventListener("click", () => {

    editingItemId = null;

    modalTitle.textContent =
      "Add Inventory Item";

    itemForm.reset();

    itemModal.classList.remove("hidden");

  });

/* closes item modal */

document
  .getElementById("closeModal")
  .addEventListener("click", () => {

    itemModal.classList.add("hidden");

  });

/* saves inventory item */

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

/* displays inventory table */

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

    /* expandable batch rows */

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

/* expands and collapses batches */

function toggleExpand(id){

  const item =
    inventory.find(
      item => item.id === id
    );

  item.expanded = !item.expanded;

  renderInventory();

}

/* updates dashboard values */

function updateDashboard(){

  totalItems.textContent =
    inventory.length;

  inventoryValue.textContent =
    `₱${formatPrice(
      calculateInventoryValue()
    )}`;

  /* changes low stock button color */

  const lowStockButton =
    document.getElementById("lowStockBtn");

  const lowStockItems =
    inventory.filter(item =>
      getTotalQuantity(item) <= 5
    );

  if(lowStockItems.length > 0){

    lowStockButton.style.background =
      "#ff4757";

  }

  else{

    lowStockButton.style.background =
      "";

  }

}

/* loads item info into edit modal */

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

/* deletes item */

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

/* search filter */

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

/* updates stock dropdown */

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

/* opens stock in modal */

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

    populateStockDropdown();

    stockModal.classList.remove("hidden");

  });

/* opens stock out modal */

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

    populateStockDropdown();

    stockModal.classList.remove("hidden");

  });

/* closes stock modal */

document
  .getElementById("closeStockModal")
  .addEventListener("click", () => {

    stockModal.classList.add("hidden");

  });

/* handles stock transactions */

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

  /* stock in */

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

  /* stock out using fifo */

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

/* low stock quick button */

document
  .getElementById("lowStockBtn")
  .addEventListener("click", () => {

    const lowStockItems =
      inventory.filter(item =>
        getTotalQuantity(item) <= 5
      );

    if(lowStockItems.length === 0){

      alert("No low stock items.");

      return;

    }

    alert(

      lowStockItems.map(item => {

        return `${item.name} (${getTotalQuantity(item)})`;

      }).join("\n")

    );

  });

/* reports */

document
  .getElementById("reportsBtn")
  .addEventListener("click", function() {
    window.location.href = "gen-reports.html";
})


/*document
  .getElementById("financialBtn")
  .addEventListener("click", () => {

    alert(
      `Inventory Value:
₱${formatPrice(
  calculateInventoryValue()
)}`
    );

  });
*/

document
  .getElementById("stockHistoryBtn")
  .addEventListener("click", function() {
    window.location.href = "stockhistory.html";
  });

/* logout placeholder */

document
  .getElementById("logoutBtn")
  .addEventListener("click", () => {

    alert("Logging out...");

  });

/* starts the system */

renderInventory();