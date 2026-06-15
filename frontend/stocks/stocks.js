// ============================================================================
// CONFIGURATION & GLOBAL STATE MANAGER
// ============================================================================
const API_BASE_URL = "http://localhost:5244/api"; 

let rawInventory = []; 
let inventoryGroups = []; 
let currentTransactionType = ""; 
let currentFilterMode = "DEFAULT"; 

// DOM Elements - Core Layout
const inventoryTableBody = document.getElementById("inventoryTableBody");
const totalItems = document.getElementById("totalItems");
const inventoryValue = document.getElementById("inventoryValue");
const searchInput = document.getElementById("searchInput");
const showUnavailableCheckbox = document.getElementById("showUnavailableCheckbox");

// Modals & Forms - Item Mutations
const itemModal = document.getElementById("itemModal");
const itemForm = document.getElementById("itemForm");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.getElementById("closeModal");

// Modals & Forms - Stock Adjustments
const stockModal = document.getElementById("stockModal");
const stockForm = document.getElementById("stockForm");
const stockModalTitle = document.getElementById("stockModalTitle");
const stockItemSelect = document.getElementById("stockItemSelect");
const stockBatchSelect = document.getElementById("stockBatchSelect");
const stockUTD = document.getElementById("stockUTD");
const stockUTDLabel = document.getElementById("stockUTDLabel");
const closeStockModal = document.getElementById("closeStockModal");

// Topbar Action Trigger Interceptors
const addItemBtn = document.getElementById("addItemBtn");
const stockInBtn = document.getElementById("stockInBtn");
const stockOutBtn = document.getElementById("stockOutBtn");
const lowStockBtn = document.getElementById("lowStockBtn");

// ============================================================================
// TRANSACTION AUDIT UTILITIES
// ============================================================================
function formatUserIdentity(user) {
    if (!user) return "System Auto";
    const lastName = user.lastName || user.LastName || "";
    const firstName = user.firstName || user.FirstName || "";
    const mi = user.mi || user.MI || "";
    const position = user.position || user.Position || "";
    
    const miString = mi.trim() !== "" ? ` ${mi.trim()}.` : "";
    return `${lastName}, ${firstName}${miString} (${position})`;
}

async function populateApproverDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    try {
        const response = await fetch(`${API_BASE_URL}/staff`); 
        if (!response.ok) throw new Error("Failed to pull personnel logs.");
        
        const staffRegistry = await response.json();
        dropdown.innerHTML = '<option value="" disabled selected>-- Select an Approver --</option>';
        
        const authorizedApprovers = staffRegistry.filter(worker => {
            const pos = (worker.position || worker.Position || "").toLowerCase();
            const isActive = worker.active ?? true;
            return isActive && (pos === "manager" || pos === "owner");
        });
        
        authorizedApprovers.forEach(approver => {
            const option = document.createElement("option");
            const formattedName = formatUserIdentity(approver);
            option.value = formattedName; 
            option.textContent = formattedName; 
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error("Approver Dropdown Error:", error);
    }
}

function getActiveSessionUser() {
    const activeSession = localStorage.getItem("currentUser");
    if (!activeSession) {
        alert("Session expired. Please log back in.");
        window.location.href = "/KusinaFlows/frontend/login/login.html";
        return null;
    }
    return JSON.parse(activeSession);
}

// ============================================================================
// DATA PIPELINES (READ & GROUP)
// ============================================================================
function groupInventoryData() {
    const showAll = showUnavailableCheckbox ? showUnavailableCheckbox.checked : false;
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    rawInventory.forEach(row => {
        const expiryDate = new Date(row.utDyear, row.utDmonth - 1, row.utDday);
        expiryDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0 || row.quantity === 0) {
            row.available = false;
        }

        if (!showAll && !row.available) return;

        if (!groups[row.itemName]) {
            groups[row.itemName] = {
                id: row.itemID,
                name: row.itemName,
                price: row.price,
                category: row.category,
                expanded: false,
                anyAvailable: false, 
                batches: []
            };
        }
        
        if (row.available) groups[row.itemName].anyAvailable = true;
        groups[row.itemName].batches.push(row);
    });

    let groupedArray = Object.values(groups);
    groupedArray.sort((a, b) => {
        if (a.anyAvailable === b.anyAvailable) return a.name.localeCompare(b.name); 
        return a.anyAvailable ? -1 : 1; 
    });

    inventoryGroups = groupedArray;
}

// ============================================================================
// RENDER ENGINE
// ============================================================================
function renderInventory(filteredGroups = null) {
    if (!inventoryTableBody) return;
    
    if (filteredGroups === null) {
        filteredGroups = (currentFilterMode === "LOW_STOCK") ? getLowStockGroups() : inventoryGroups;
    }
    
    inventoryTableBody.innerHTML = "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    filteredGroups.forEach(group => {
        const totalQty = group.batches.reduce((sum, b) => sum + (b.available ? b.quantity : 0), 0);
        const isGroupUnavailable = !group.anyAvailable;

        let qtyLabel = "Moderate Quantity"; let qtyColor = "background: #fff3cd; color: #856404;";
        if (totalQty === 0) { qtyLabel = "No Stock"; qtyColor = "background: #fdadb2; color: #721c24;"; }
        else if (totalQty <= 5) { qtyLabel = "Low Quantity"; qtyColor = "background: #ffe0e3; color: #ff4757;"; }
        else if (totalQty > 15) { qtyLabel = "High Quantity"; qtyColor = "background: #d4edda; color: #28a745;"; }

        const activeBatches = group.batches.filter(b => b.available);
        let utdLabel = "N/A"; let utdColor = "background: #eee; color: #666;";

        if (activeBatches.length > 0) {
            const minDays = Math.min(...activeBatches.map(b => {
                const exp = new Date(b.utDyear, b.utDmonth - 1, b.utDday);
                return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            }));

            if (minDays < 0) { utdLabel = "Expired"; utdColor = "background: #721c24; color: #ffffff;"; }
            else if (minDays <= 7) { utdLabel = "Critical"; utdColor = "background: #ffe0e3; color: #ff4757;"; }
            else if (minDays <= 14) { utdLabel = "Expiring Soon"; utdColor = "background: #fff3cd; color: #856404;"; }
            else { utdLabel = "Fresh Stock"; utdColor = "background: #d4edda; color: #28a745;"; }
        } else if (isGroupUnavailable) {
            utdLabel = "Archived"; utdColor = "background: #fdadb2; color: #721c24;";
        }

        const row = document.createElement("tr");
        if (isGroupUnavailable) row.style.backgroundColor = "#fff5f5";

        row.innerHTML = `
            <td><span style="cursor: pointer; font-size: 14px;" onclick="toggleExpand('${group.name.replace(/'/g, "\\'")}')">${group.expanded ? "▲" : "▼"}</span></td>
            <td><strong>${group.name} ${isGroupUnavailable ? '(Archived)' : ''}</strong></td>
            <td>₱${group.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>${totalQty}</td>
            <td>${group.category}</td>
            <td>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; min-width: 85px; text-align: center; ${utdColor}">${utdLabel}</span>
                    <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; min-width: 90px; text-align: center; ${qtyColor}">${qtyLabel}</span>
                </div>
            </td>
            <td>
                ${!isGroupUnavailable ? `
                    <button style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="deleteEntireItem('${group.name.replace(/'/g, "\\'")}')">Delete Item</button>
                ` : `<span style="color: #aaa; font-style: italic; font-size: 13px;">No Actions</span>`}
            </td>
        `;
        inventoryTableBody.appendChild(row);

        if (group.expanded) {
            group.batches.sort((a, b) => (a.available === b.available) ? 0 : a.available ? -1 : 1);
            const batchRow = document.createElement("tr");
            batchRow.innerHTML = `
                <td colspan="7">
                    <div style="padding: 10px 40px; background: #fafafa; border-radius: 4px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid #ddd; text-align: left; font-size: 12px; color: #666;">
                                    <th>Date Added</th><th>Batch Code</th><th>Quantity</th><th>Use-Thru-Date</th><th>Status Indicators</th><th style="text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.batches.map(b => {
                                    const daDate = `${String(b.dAmonth).padStart(2, '0')}/${String(b.dAday).padStart(2, '0')}/${b.dAyear}`;
                                    const utdDate = `${String(b.utDmonth).padStart(2, '0')}/${String(b.utDday).padStart(2, '0')}/${b.utDyear}`;
                                    const bExp = new Date(b.utDyear, b.utDmonth - 1, b.utDday);
                                    const bDiffDays = Math.ceil((bExp - today) / (1000 * 60 * 60 * 24));

                                    let bUtdLabel = "Fresh Stock"; let bUtdColor = "background: #d4edda; color: #28a745;";
                                    if (bDiffDays < 0) { bUtdLabel = "Expired"; bUtdColor = "background: #721c24; color: #ffffff;"; }
                                    else if (bDiffDays <= 7) { bUtdLabel = "Critical"; bUtdColor = "background: #ffe0e3; color: #ff4757;"; }
                                    else if (bDiffDays <= 14) { bUtdLabel = "Expiring Soon"; bUtdColor = "background: #fff3cd; color: #856404;"; }

                                    let bQtyLabel = "Moderate Quantity"; let bQtyColor = "background: #fff3cd; color: #856404;";
                                    if (b.quantity === 0) { bQtyLabel = "No Stock"; bQtyColor = "background: #fdadb2; color: #721c24;"; }
                                    else if (b.quantity <= 5) { bQtyLabel = "Low Quantity"; bQtyColor = "background: #ffe0e3; color: #ff4757;"; }
                                    else if (b.quantity > 15) { bQtyLabel = "High Quantity"; bQtyColor = "background: #d4edda; color: #28a745;"; }

                                    return `
                                        <tr style="border-bottom: 1px solid #eee; font-size: 13px; ${!b.available ? 'background-color: #ffd6d6;' : ''}">
                                            <td>${daDate}</td><td>#BTC-${b.batchID}</td><td>${b.quantity}</td><td>${utdDate}</td>
                                            <td>
                                                <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; min-width: 75px; text-align: center; ${bUtdColor}">${bUtdLabel}</span>
                                                <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; min-width: 80px; text-align: center; ${bQtyColor}">${bQtyLabel}</span>
                                            </td>
                                            <td style="text-align: right;">
                                                <button style="background: #2ed573; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;" onclick="editItemGroup(${b.batchID})">Edit</button>
                                                <button style="background: #ff4757; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;" onclick="deleteBatchRow(${b.batchID})" ${!b.available ? 'disabled style="opacity:0.3;"' : ''}>Delete</button>
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
    if (totalItems) totalItems.textContent = inventoryGroups.filter(g => g.anyAvailable).length;
    const valueSum = rawInventory.reduce((sum, row) => row.available ? sum + (row.quantity * row.price) : sum, 0);
    if (inventoryValue) inventoryValue.textContent = `₱${valueSum.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function populateStockDropdown() {
    if (!stockItemSelect) return;
    stockItemSelect.innerHTML = '<option value="" disabled selected>Select an item registry...</option>';
    const itemTracker = new Set();
    rawInventory.forEach(row => {
        if (row.available && !itemTracker.has(row.itemName)) {
            itemTracker.add(row.itemName);
            const opt = document.createElement("option");
            opt.value = row.itemID; opt.dataset.name = row.itemName; opt.dataset.category = row.category; opt.dataset.price = row.price;
            opt.textContent = `${row.itemName} (ID: ${row.itemID})`;
            stockItemSelect.appendChild(opt);
        }
    });
}

// ============================================================================
// WINDOW ACTIONS & MUTATIONS
// ============================================================================
window.toggleExpand = function(groupName) {
    const group = inventoryGroups.find(g => g.name === groupName);
    if (group) { group.expanded = !group.expanded; renderInventory(); }
};

window.editItemGroup = function(batchId) {
    const targetBatch = rawInventory.find(b => b.batchID === batchId);
    if (!targetBatch) return;

    modalTitle.textContent = "Edit Inventory Item";
    document.getElementById("editBatchId").value = batchId;
    document.getElementById("editItemId").value = targetBatch.itemID;
    document.getElementById("itemName").value = targetBatch.itemName;
    document.getElementById("itemQuantity").value = targetBatch.quantity;
    document.getElementById("itemCategory").value = targetBatch.category;
    document.getElementById("itemPrice").value = targetBatch.price;
    document.getElementById("itemUTD").value = `${targetBatch.utDyear}-${String(targetBatch.utDmonth).padStart(2, '0')}-${String(targetBatch.utDday).padStart(2, '0')}`;

    populateApproverDropdown("itemManagerApprovalDropdown");
    itemForm.dataset.mode = "EDIT";
    itemModal.classList.remove("hidden");
};

window.deleteBatchRow = async function(batchId) {
    if (!confirm(`Are you sure you want to delete Batch #${batchId}?`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/inventory/delete/${batchId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to remove record.");
        await syncInventoryFromServer();
    } catch (error) { alert(error.message); }
};

window.deleteEntireItem = async function(itemName) {
    if (!confirm(`Are you sure you want to delete all records for "${itemName}"?`)) return;
    const group = inventoryGroups.find(g => g.name === itemName);
    if (!group) return;
    try {
        for (const batch of group.batches) {
            await fetch(`${API_BASE_URL}/inventory/delete/${batch.batchID}`, { method: "DELETE" });
        }
        await syncInventoryFromServer();
    } catch (error) { alert(error.message); }
};

// ============================================================================
// FORM RECEPTORS
// ============================================================================
itemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = getActiveSessionUser();
    if (!currentUser) return;

    const mode = itemForm.dataset.mode;
    const utdValue = document.getElementById("itemUTD").value.split("-");
    const today = new Date();

    const payload = {
        itemName: document.getElementById("itemName").value,
        category: document.getElementById("itemCategory").value,
        price: parseFloat(document.getElementById("itemPrice").value),
        quantity: parseInt(document.getElementById("itemQuantity").value),
        utDyear: parseInt(utdValue[0]), utDmonth: parseInt(utdValue[1]), utDday: parseInt(utdValue[2]),
        performedBy: formatUserIdentity(currentUser),
        approvedBy: document.getElementById("itemManagerApprovalDropdown").value
    };

    if (mode === "EDIT") {
        payload.batchID = parseInt(document.getElementById("editBatchId").value);
        payload.itemID = parseInt(document.getElementById("editItemId").value);
        try {
            const res = await fetch(`${API_BASE_URL}/inventory/update-full-batch`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed update.");
            closeItemModalWindow(); await syncInventoryFromServer();
        } catch (e) { alert(e.message); }
    } else {
        payload.itemID = rawInventory.length > 0 ? Math.max(...rawInventory.map(r => r.itemID)) + 1 : 101;
        payload.dAyear = today.getFullYear(); payload.dAmonth = today.getMonth() + 1; payload.dAday = today.getDate();
        payload.status = "Fresh Stock";
        try {
            const res = await fetch(`${API_BASE_URL}/inventory/add`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed creation.");
            closeItemModalWindow(); await syncInventoryFromServer();
        } catch (e) { alert(e.message); }
    }
});

stockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = getActiveSessionUser();
    if (!currentUser) return;

    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    const qty = parseInt(document.getElementById("stockQuantity").value);
    const approverValue = document.getElementById("stockManagerApprovalDropdown").value;

    if (currentTransactionType === "IN") {
        const utdValue = stockUTD.value.split("-");
        const today = new Date();
        const payload = {
            itemID: parseInt(selectedOption.value), itemName: selectedOption.dataset.name,
            category: selectedOption.dataset.category, price: parseFloat(selectedOption.dataset.price),
            quantity: qty, status: "Fresh Stock", performedBy: formatUserIdentity(currentUser), approvedBy: approverValue,
            utDyear: parseInt(utdValue[0]), utDmonth: parseInt(utdValue[1]), utDday: parseInt(utdValue[2]),
            dAyear: today.getFullYear(), dAmonth: today.getMonth() + 1, dAday: today.getDate()
        };
        try {
            const res = await fetch(`${API_BASE_URL}/inventory/add`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Stock-In execution error.");
            closeStockModalWindow(); await syncInventoryFromServer();
        } catch (err) { alert(err.message); }
    } else {
        const selectedBatch = stockBatchSelect.options[stockBatchSelect.selectedIndex];
        if (qty > parseInt(selectedBatch.dataset.maxQty)) { alert("Overdeduction bounds tripped."); return; }

        const payload = { batchID: parseInt(selectedBatch.value), quantity: qty, performedBy: formatUserIdentity(currentUser), approvedBy: approverValue };
        try {
            const res = await fetch(`${API_BASE_URL}/inventory/stock-out-specific`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Stock-Out error.");
            closeStockModalWindow(); await syncInventoryFromServer();
        } catch (err) { alert(err.message); }
    }
});

stockItemSelect.addEventListener("change", () => {
    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    if (!stockBatchSelect) return;
    stockBatchSelect.innerHTML = '<option value="" disabled selected>Select an active batch...</option>';

    if (currentTransactionType === "OUT") {
        rawInventory.filter(row => row.itemName === selectedOption.dataset.name && row.available && row.quantity > 0)
            .forEach(batch => {
                const opt = document.createElement("option"); opt.value = batch.batchID; opt.dataset.maxQty = batch.quantity;
                opt.textContent = `Batch #${batch.batchID} (Qty: ${batch.quantity} - Exp: ${batch.utDmonth}/${batch.utDday}/${batch.utDyear})`;
                stockBatchSelect.appendChild(opt);
            });
    }
});

// ============================================================================
// UI WINDOW TOGGLES
// ============================================================================
addItemBtn.addEventListener("click", () => {
    modalTitle.textContent = "Add Item"; itemForm.reset();
    populateApproverDropdown("itemManagerApprovalDropdown");
    itemForm.dataset.mode = "ADD"; itemModal.classList.remove("hidden");
});

stockInBtn.addEventListener("click", () => {
    currentTransactionType = "IN"; stockModalTitle.textContent = "Stock-In Transaction"; stockForm.reset();
    document.getElementById("batchSelectContainer").style.display = "none"; stockBatchSelect.removeAttribute("required");
    stockUTD.style.display = "block"; stockUTD.setAttribute("required", "true"); stockUTDLabel.style.display = "block";
    populateApproverDropdown("stockManagerApprovalDropdown"); stockModal.classList.remove("hidden");
});

stockOutBtn.addEventListener("click", () => {
    currentTransactionType = "OUT"; stockModalTitle.textContent = "Stock-Out Transaction"; stockForm.reset();
    document.getElementById("batchSelectContainer").style.display = "block"; stockBatchSelect.setAttribute("required", "true");
    stockUTD.style.display = "none"; stockUTD.removeAttribute("required"); stockUTDLabel.style.display = "none";
    populateApproverDropdown("stockManagerApprovalDropdown"); stockModal.classList.remove("hidden");
});

function closeItemModalWindow() { itemModal.classList.add("hidden"); }
function closeStockModalWindow() { stockModal.classList.add("hidden"); }
closeModal.addEventListener("click", closeItemModalWindow);
closeStockModal.addEventListener("click", closeStockModalWindow);

// ============================================================================
// FILTERS & LIFECYCLE MANAGEMENT
// ============================================================================
function getLowStockGroups() {
    return inventoryGroups.map(g => ({ ...g, batches: g.batches.filter(b => b.quantity <= 5) })).filter(g => g.batches.length > 0);
}

lowStockBtn.addEventListener("click", () => {
    if (currentFilterMode === "DEFAULT") {
        currentFilterMode = "LOW_STOCK"; inventoryGroups.forEach(g => { if (g.batches.some(b => b.quantity <= 5)) g.expanded = true; });
        renderInventory(); lowStockBtn.textContent = "Back to Default"; lowStockBtn.style.background = "#ffa502";
    } else {
        currentFilterMode = "DEFAULT"; groupInventoryData(); renderInventory();
        lowStockBtn.textContent = "Low Stock Items"; lowStockBtn.style.background = "";
    }
});

if (showUnavailableCheckbox) {
    showUnavailableCheckbox.addEventListener("change", () => { groupInventoryData(); renderInventory(); });
}

searchInput.addEventListener("keyup", () => {
    const term = searchInput.value.toLowerCase();
    renderInventory(inventoryGroups.filter(g => g.name.toLowerCase().includes(term) || g.category.toLowerCase().includes(term)));
});

async function syncInventoryFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/inventory`);
        if (!response.ok) throw new Error("HTTP degradation error!");
        rawInventory = await response.json();
        groupInventoryData(); 
        renderInventory(); 
        populateStockDropdown();
        console.log("Neon Postgres data synced successfully.");
    } catch (error) {
        console.error("Critical core synchronization failure:", error);
    }
}

// Safe layout fallback event wireups
const reportBtn = document.getElementById("reportBtn") || document.getElementById("reportsBtn");
const historyBtn = document.getElementById("stockHistoryBtn");

if (document.getElementById("logoutBtn")) {
    document.getElementById("logoutBtn").addEventListener("click", () => {
        if (confirm("Log out of KusinaFlow?")) {
            localStorage.clear(); sessionStorage.clear(); window.location.replace("../login/login.html");
        }
    });
}

// LIFECYCLE BOOTSTRAP RESILIENCE LOOP
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncInventoryFromServer);
} else {
    syncInventoryFromServer();
}