const API_BASE_URL = "http://localhost:5244/api"; 

let rawInventory = []; 
let inventoryGroups = []; 
let currentTransactionType = ""; // Tracks 'In' or 'Out'

// DOM Elements
const inventoryTableBody = document.getElementById("inventoryTableBody");
const totalItems = document.getElementById("totalItems");
const inventoryValue = document.getElementById("inventoryValue");
const searchInput = document.getElementById("searchInput");

// Modals & Forms
const itemModal = document.getElementById("itemModal");
const itemForm = document.getElementById("itemForm");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.getElementById("closeModal");

const stockModal = document.getElementById("stockModal");
const stockForm = document.getElementById("stockForm");
const stockModalTitle = document.getElementById("stockModalTitle");
const stockItemSelect = document.getElementById("stockItemSelect");
const stockUTD = document.getElementById("stockUTD");
const stockUTDLabel = document.getElementById("stockUTDLabel");
const closeStockModal = document.getElementById("closeStockModal");

// Topbar Action Buttons
const addItemBtn = document.getElementById("addItemBtn");
const stockInBtn = document.getElementById("stockInBtn");
const stockOutBtn = document.getElementById("stockOutBtn");
const lowStockBtn = document.getElementById("lowStockBtn");

// Sidebar Navigation Items
const reportsBtn = document.getElementById("reportsBtn");
const financialBtn = document.getElementById("financialBtn");
const stockHistoryBtn = document.getElementById("stockHistoryBtn");
const logoutBtn = document.getElementById("logoutBtn");

// ==========================================
// INITIALIZATION & CORE DATA FETCH (READ)
// ==========================================
async function initializeDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/inventory`);
        if (!response.ok) throw new Error(`Server status: ${response.status}`);
        
        rawInventory = await response.json();
        groupInventoryData();
        renderInventory();
        populateStockDropdown();
    } catch (error) {
        console.error("Dashboard engine failure:", error);
        if (inventoryTableBody) {
            inventoryTableBody.innerHTML = `
                <tr>
                    <td colspan='7' style='color: #ff4757; text-align: center; font-weight: bold; padding: 20px;'>
                        ⚠️ System Offline: Could not communicate with KusinaFlows server.<br>
                        <span style='font-size: 12px; font-weight: normal; color: #aaa;'>Error: ${error.message}</span>
                    </td>
                </tr>`;
        }
    }
}

function groupInventoryData() {
    const groups = {};
    rawInventory.forEach(row => {
        if (!groups[row.itemName]) {
            groups[row.itemName] = {
                id: row.itemID,
                name: row.itemName,
                price: row.price,
                category: row.category,
                expanded: false,
                batches: []
            };
        }
        groups[row.itemName].batches.push(row);
    });
    inventoryGroups = Object.values(groups);
}

function renderInventory(filteredGroups = inventoryGroups) {
    if (!inventoryTableBody) return;
    inventoryTableBody.innerHTML = "";

    if (filteredGroups.length === 0) {
        inventoryTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #888;">No data rows discovered.</td></tr>`;
        updateMetrics();
        return;
    }

    filteredGroups.forEach(group => {
        const totalQty = group.batches.reduce((sum, b) => sum + b.quantity, 0);
        const isLow = totalQty <= 5;
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <span style="cursor: pointer; font-size: 14px; user-select: none;" onclick="toggleExpand('${group.name.replace(/'/g, "\\'")}')">
                    ${group.expanded ? "▲" : "▼"}
                </span>
            </td>
            <td><strong>${group.name}</strong></td>
            <td>₱${group.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>${totalQty} units</td>
            <td>${group.category}</td>
            <td>
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: ${isLow ? '#ffe0e3' : '#d4edda'}; color: ${isLow ? '#ff4757' : '#28a745'};">
                    ${isLow ? 'Running Out' : 'Safe'}
                </span>
            </td>
            <td>
                <button style="background: #2ed573; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="editItemGroup(${group.batches[0].batchID})">Edit</button>
            </td>
        `;
        inventoryTableBody.appendChild(row);

        if (group.expanded) {
            const batchRow = document.createElement("tr");
            batchRow.innerHTML = `
                <td colspan="7">
                    <div style="padding: 10px 40px; background: #fafafa; border-radius: 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid #ddd; text-align: left; font-size: 12px; color: #666;">
                                    <th style="padding: 6px;">Date Added</th>
                                    <th style="padding: 6px;">Batch Code</th>
                                    <th style="padding: 6px;">Quantity Available</th>
                                    <th style="padding: 6px;">Use-Thru-Date (Expiry)</th>
                                    <th style="padding: 6px; text-align: right;">System Adjustments</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.batches.map(b => {
                                    const daDate = `${String(b.dAmonth).padStart(2, '0')}/${String(b.dAday).padStart(2, '0')}/${b.dAyear}`;
                                    const utdDate = `${String(b.utDmonth).padStart(2, '0')}/${String(b.utDday).padStart(2, '0')}/${b.utDyear}`;
                                    return `
                                        <tr style="border-bottom: 1px solid #eee; font-size: 13px;">
                                            <td style="padding: 6px; color: #555;">${daDate}</td>
                                            <td style="padding: 6px; color: #888;">#BTC-${b.batchID}</td>
                                            <td style="padding: 6px; font-weight: 600;">${b.quantity}</td>
                                            <td style="padding: 6px; color: #ff4757; font-weight: 500;">${utdDate}</td>
                                            <td style="padding: 6px; text-align: right;">
                                                <button style="background: #ff4757; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;" onclick="deleteBatchRow(${b.batchID})">Delete</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                </td>
            `;
            inventoryTableBody.appendChild(batchRow);
        }
    });

    updateMetrics();
}

function updateMetrics() {
    if (totalItems) totalItems.textContent = inventoryGroups.length;
    const valueSum = rawInventory.reduce((sum, row) => sum + (row.quantity * row.price), 0);
    if (inventoryValue) inventoryValue.textContent = `₱${valueSum.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function populateStockDropdown() {
    if (!stockItemSelect) return;
    stockItemSelect.innerHTML = '<option value="" disabled selected>Select an item registry...</option>';
    
    // Get unique items by name to populate dropdown
    const itemTracker = new Set();
    rawInventory.forEach(row => {
        if (!itemTracker.has(row.itemName)) {
            itemTracker.add(row.itemName);
            const opt = document.createElement("option");
            opt.value = row.itemID;
            opt.dataset.name = row.itemName;
            opt.dataset.category = row.category;
            opt.dataset.price = row.price;
            opt.textContent = `${row.itemName} (ID: ${row.itemID})`;
            stockItemSelect.appendChild(opt);
        }
    });
}

// ==========================================
// INTERACTIVE WINDOW SCOPED BUTTON CLICKS
// ==========================================
window.toggleExpand = function(groupName) {
    const group = inventoryGroups.find(g => g.name === groupName);
    if (group) {
        group.expanded = !group.expanded;
        renderInventory();
    }
};

// UPDATE (U) Operation Setup
window.editItemGroup = function(batchId) {
    console.log("🎯 Loading parameters into Edit Window for BatchID:", batchId);
    
    // Find the exact flat data row matching this batch index number
    const targetBatch = rawInventory.find(b => b.batchID === batchId);
    if (!targetBatch) return;

    modalTitle.textContent = "Edit Inventory Item";
    
    // 1. Assign identifier tracking codes to hidden elements
    document.getElementById("editBatchId").value = batchId;
    document.getElementById("editItemId").value = targetBatch.itemID;

    // 2. Prepopulate all textual entry inputs
    document.getElementById("itemName").value = targetBatch.itemName;
    document.getElementById("itemQuantity").value = targetBatch.quantity;
    document.getElementById("itemCategory").value = targetBatch.category;
    document.getElementById("itemPrice").value = targetBatch.price;
    
    // 3. Format integer date numbers (MM, DD, YYYY) into standard HTML input syntax (YYYY-MM-DD)
    const formattedDate = `${targetBatch.utDyear}-${String(targetBatch.utDmonth).padStart(2, '0')}-${String(targetBatch.utDday).padStart(2, '0')}`;
    document.getElementById("itemUTD").value = formattedDate;

    // 4. Ensure all fields are fully displayed and active
    const qtyInput = document.getElementById("itemQuantity");
    const utdInput = document.getElementById("itemUTD");
    
    qtyInput.style.display = "block";
    qtyInput.setAttribute("required", "true");
    utdInput.style.display = "block";
    utdInput.setAttribute("required", "true");
    
    itemForm.dataset.mode = "EDIT";
    itemModal.classList.remove("hidden");
};

// DELETE (D) Operation
window.deleteBatchRow = async function(batchId) {
    if (!confirm(`Are you sure you want to drop Batch #${batchId} from active data tracking?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/delete/${batchId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Backend server declined transactional delete.");
        
        await initializeDashboard();
    } catch (error) {
        console.error("Delete operation crash:", error);
        alert("Transaction failure: " + error.message);
    }
};

// ==========================================
// CREATE & UPDATE FORM ACTIONS
// ==========================================
itemForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const mode = itemForm.dataset.mode;
    const nameValue = document.getElementById("itemName").value;
    const qtyValue = parseInt(document.getElementById("itemQuantity").value);
    const catValue = document.getElementById("itemCategory").value;
    const priceValue = parseFloat(document.getElementById("itemPrice").value);
    
    const utdValue = document.getElementById("itemUTD").value; 
    const utdDate = new Date(utdValue);
    const today = new Date();

    if (mode === "EDIT") {
        const batchId = parseInt(document.getElementById("editBatchId").value);
        const itemId = parseInt(document.getElementById("editItemId").value);
        
        // This payload preserves the exact structure of your ITEM database table rows!
        const payload = {
            batchID: batchId,
            itemID: itemId,
            itemName: nameValue,
            category: catValue,
            price: priceValue,
            quantity: qtyValue,
            utDmonth: utdDate.getMonth() + 1,
            utDday: utdDate.getDate(),
            utDyear: utdDate.getFullYear()
        };

        console.log("Submitting full layout batch edit request:", payload);

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/update-full-batch`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Backend system rejected structural batch alterations.");
            
            closeItemModalWindow();
            await initializeDashboard();
        } catch (error) {
            console.error("Full update error:", error);
            alert("Error saving: " + error.message);
        }
    } else {
        // ==========================================
        // STANDARD ADD ITEM CONTEXT (UNCHANGED)
        // ==========================================
        const nextId = rawInventory.length > 0 ? Math.max(...rawInventory.map(r => r.itemID)) + 1 : 101;
        const payload = {
            itemID: nextId,
            itemName: nameValue,
            category: catValue,
            price: priceValue,
            quantity: qtyValue,
            utDmonth: utdDate.getMonth() + 1,
            utDday: utdDate.getDate(),
            utDyear: utdDate.getFullYear(),
            dAmonth: today.getMonth() + 1,
            dAday: today.getDate(),
            dAyear: today.getFullYear(),
            status: "Fresh Stock"
        };

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error("Failed to write fresh entry row.");
            closeItemModalWindow();
            await initializeDashboard();
        } catch (error) {
            alert(error.message);
        }
    }
});

// STOCK HANDLING ACTIONS (STOCK-IN / STOCK-OUT)
stockForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    const itemId = parseInt(selectedOption.value);
    const qty = parseInt(document.getElementById("stockQuantity").value);
    const today = new Date();

    if (currentTransactionType === "IN") {
        const utdValue = stockUTD.value;
        if (!utdValue) {
            alert("Please specify an expiry target mapping window.");
            return;
        }
        const utdDate = new Date(utdValue);

        const payload = {
            itemID: itemId,
            itemName: selectedOption.dataset.name,
            category: selectedOption.dataset.category,
            price: parseFloat(selectedOption.dataset.price),
            quantity: qty,
            utDmonth: utdDate.getMonth() + 1,
            utDday: utdDate.getDate(),
            utDyear: utdDate.getFullYear(),
            dAmonth: today.getMonth() + 1,
            dAday: today.getDate(),
            dAyear: today.getFullYear(),
            status: "Restocked"
        };

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error("Restock insertion step failed.");
            closeStockModalWindow();
            await initializeDashboard();
        } catch (error) {
            alert(error.message);
        }

    } else if (currentTransactionType === "OUT") {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/stock-out`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemID: itemId, quantity: qty })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Reduction step processing failed.");
            }
            
            closeStockModalWindow();
            await initializeDashboard();
        } catch (error) {
            alert(error.message);
        }
    }
});

// ==========================================
// MODAL DISPLAY TOGGLE UTILITIES
// ==========================================
addItemBtn.addEventListener("click", () => {
    modalTitle.textContent = "Add Inventory Item";
    itemForm.reset();
    
    // Restore elements hidden during edits
    document.getElementById("itemQuantity").style.display = "block";
    document.getElementById("itemQuantity").setAttribute("required", "true");
    document.getElementById("itemUTD").style.display = "block";
    document.getElementById("itemUTD").setAttribute("required", "true");
    
    itemForm.dataset.mode = "ADD";
    itemModal.classList.remove("hidden");
});

stockInBtn.addEventListener("click", () => {
    currentTransactionType = "IN";
    stockModalTitle.textContent = "Stock-In Transaction (Add New Batch)";
    stockForm.reset();
    stockUTD.style.display = "block";
    stockUTD.setAttribute("required", "true");
    stockUTDLabel.style.display = "block";
    stockModal.classList.remove("hidden");
});

stockOutBtn.addEventListener("click", () => {
    currentTransactionType = "OUT";
    stockModalTitle.textContent = "Stock-Out Transaction (Deduct from Oldest)";
    stockForm.reset();
    stockUTD.style.display = "none";
    stockUTD.removeAttribute("required");
    stockUTDLabel.style.display = "none";
    stockModal.classList.remove("hidden");
});

function closeItemModalWindow() { itemModal.classList.add("hidden"); }
function closeStockModalWindow() { stockModal.classList.add("hidden"); }

closeModal.addEventListener("click", closeItemModalWindow);
closeStockModal.addEventListener("click", closeStockModalWindow);

// ==========================================
// AUXILIARY SIDEBAR & FILTER BUTTON ACTIONS
// ==========================================
lowStockBtn.addEventListener("click", () => {
    const lowStock = inventoryGroups.filter(group => {
        const totalQty = group.batches.reduce((sum, b) => sum + b.quantity, 0);
        return totalQty <= 5;
    });
    renderInventory(lowStock);
});

searchInput.addEventListener("keyup", () => {
    const term = searchInput.value.toLowerCase();
    const matches = inventoryGroups.filter(g => 
        g.name.toLowerCase().includes(term) || g.category.toLowerCase().includes(term)
    );
    renderInventory(matches);
});

reportsBtn.addEventListener("click", () => alert("Generating Operational Summary Reports..."));
financialBtn.addEventListener("click", () => alert("Loading Financial Cashflows and Assets Analytics Ledger..."));
stockHistoryBtn.addEventListener("click", () => alert("Opening Historical Transaction Logging Records..."));
logoutBtn.addEventListener("click", () => {
    if(confirm("Log out from KusinaFlows?")) {
        alert("Redirecting to Authentication Gate...");
    }
});

// Run Init on Page Boot
document.addEventListener("DOMContentLoaded", initializeDashboard);