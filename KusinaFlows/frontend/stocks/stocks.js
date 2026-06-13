// ============================================================================
// CONFIGURATION & GLOBAL STATE MANAGER
// ============================================================================
const API_BASE_URL = "http://localhost:5244/api"; 

let rawInventory = []; 
let inventoryGroups = []; 
let currentTransactionType = ""; // Tracks 'IN' or 'OUT'
let currentFilterMode = "DEFAULT"; // Tracks 'DEFAULT' or 'LOW_STOCK'

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

// Sidebar Navigation Control Mappings
const reportsBtn = document.getElementById("reportsBtn");
const financialBtn = document.getElementById("financialBtn");
const stockHistoryBtn = document.getElementById("stockHistoryBtn");
const logoutBtn = document.getElementById("logoutBtn");

// ============================================================================
// INITIALIZATION & CORE DATA FETCH (READ)
// ============================================================================
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
    const showAll = showUnavailableCheckbox ? showUnavailableCheckbox.checked : false;
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    rawInventory.forEach(row => {
        // --- LIVE DYNAMIC STATUS EVALUATION ---
        const expiryDate = new Date(row.utDyear, row.utDmonth - 1, row.utDday);
        expiryDate.setHours(0, 0, 0, 0);
        
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0 || row.quantity === 0) {
            row.available = false;
        }

        if (!showAll && !row.available) {
            return;
        }

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
        
        if (row.available) {
            groups[row.itemName].anyAvailable = true;
        }
        groups[row.itemName].batches.push(row);
    });

    let groupedArray = Object.values(groups);

    groupedArray.sort((a, b) => {
        if (a.anyAvailable === b.anyAvailable) {
            return a.name.localeCompare(b.name); 
        }
        return a.anyAvailable ? -1 : 1; 
    });

    inventoryGroups = groupedArray;
}

// ============================================================================
// DYNAMIC COMPONENT RENDER ENGINE
// ============================================================================
function renderInventory(filteredGroups = null) {
    if (!inventoryTableBody) return;
    
    if (filteredGroups === null) {
        if (currentFilterMode === "LOW_STOCK") {
            filteredGroups = getLowStockGroups();
        } else {
            filteredGroups = inventoryGroups;
        }
    }
    
    inventoryTableBody.innerHTML = "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    filteredGroups.forEach(group => {
        const totalQty = group.batches.reduce((sum, b) => sum + (b.available ? b.quantity : 0), 0);
        const isGroupUnavailable = !group.anyAvailable;

        let qtyLabel = "";
        let qtyColor = "";
        if (totalQty === 0) {
            qtyLabel = "No Stock";
            qtyColor = "background: #fdadb2; color: #721c24;";
        } else if (totalQty <= 5) {
            qtyLabel = "Low Quantity";
            qtyColor = "background: #ffe0e3; color: #ff4757;";
        } else if (totalQty > 15) {
            qtyLabel = "High Quantity";
            qtyColor = "background: #d4edda; color: #28a745;";
        } else {
            qtyLabel = "Moderate Quantity";
            qtyColor = "background: #fff3cd; color: #856404;";
        }

        const activeBatches = group.batches.filter(b => b.available);
        let utdLabel = "N/A";
        let utdColor = "background: #eee; color: #666;";

        if (activeBatches.length > 0) {
            const minDays = Math.min(...activeBatches.map(b => {
                const exp = new Date(b.utDyear, b.utDmonth - 1, b.utDday);
                return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            }));

            if (minDays < 0) {
                utdLabel = "Expired";
                utdColor = "background: #721c24; color: #ffffff;";
            } else if (minDays <= 7) {
                utdLabel = "Critical";
                utdColor = "background: #ffe0e3; color: #ff4757;";
            } else if (minDays <= 14) {
                utdLabel = "Expiring Soon";
                utdColor = "background: #fff3cd; color: #856404;";
            } else {
                utdLabel = "Fresh Stock";
                utdColor = "background: #d4edda; color: #28a745;";
            }
        } else if (isGroupUnavailable) {
            utdLabel = "Archived";
            utdColor = "background: #fdadb2; color: #721c24;";
        }

        const row = document.createElement("tr");
        if (isGroupUnavailable) {
            row.style.backgroundColor = "#fff5f5";
            row.style.color = "#c0392b";
        }

        row.innerHTML = `
            <td>
                <span style="cursor: pointer; font-size: 14px; user-select: none;" onclick="toggleExpand('${group.name.replace(/'/g, "\\'")}')">
                    ${group.expanded ? "▲" : "▼"}
                </span>
            </td>
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
                    <button style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;" 
                            onclick="deleteEntireItem('${group.name.replace(/'/g, "\\'")}')">
                        Delete Item
                    </button>
                ` : `<span style="color: #aaa; font-style: italic; font-size: 13px;">No Actions</span>`}
            </td>
        `;
        inventoryTableBody.appendChild(row);

        if (group.expanded) {
            group.batches.sort((a, b) => (a.available === b.available) ? 0 : a.available ? -1 : 1);

            const batchRow = document.createElement("tr");
            batchRow.innerHTML = `
                <td colspan="7">
                    <div style="padding: 10px 40px; background: #fafafa; border-radius: 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid #ddd; text-align: left; font-size: 12px; color: #666;">
                                    <th style="padding: 6px;">Date Added</th>
                                    <th style="padding: 6px;">Batch Code</th>
                                    <th style="padding: 6px;">Quantity</th>
                                    <th style="padding: 6px;">Use-Thru-Date (Expiry)</th>
                                    <th style="padding: 6px;">Batch Status Indicators</th>
                                    <th style="padding: 6px; text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.batches.map(b => {
                                    const daDate = `${String(b.dAmonth).padStart(2, '0')}/${String(b.dAday).padStart(2, '0')}/${b.dAyear}`;
                                    const utdDate = `${String(b.utDmonth).padStart(2, '0')}/${String(b.utDday).padStart(2, '0')}/${b.utDyear}`;
                                    
                                    const bExp = new Date(b.utDyear, b.utDmonth - 1, b.utDday);
                                    bExp.setHours(0, 0, 0, 0);
                                    const bDiffDays = Math.ceil((bExp - today) / (1000 * 60 * 60 * 24));

                                    let bUtdLabel = ""; let bUtdColor = "";
                                    if (bDiffDays < 0) { bUtdLabel = "Expired"; bUtdColor = "background: #721c24; color: #ffffff;"; }
                                    else if (bDiffDays <= 7) { bUtdLabel = "Critical"; bUtdColor = "background: #ffe0e3; color: #ff4757;"; }
                                    else if (bDiffDays <= 14) { bUtdLabel = "Expiring Soon"; bUtdColor = "background: #fff3cd; color: #856404;"; }
                                    else { bUtdLabel = "Fresh Stock"; bUtdColor = "background: #d4edda; color: #28a745;"; }

                                    let bQtyLabel = ""; let bQtyColor = "";
                                    if (b.quantity === 0) { bQtyLabel = "No Stock"; bQtyColor = "background: #fdadb2; color: #721c24;"; }
                                    else if (b.quantity <= 5) { bQtyLabel = "Low Quantity"; bQtyColor = "background: #ffe0e3; color: #ff4757;"; }
                                    else if (b.quantity > 15) { bQtyLabel = "High Quantity"; bQtyColor = "background: #d4edda; color: #28a745;"; }
                                    else { bQtyLabel = "Moderate Quantity"; bQtyColor = "background: #fff3cd; color: #856404;"; }

                                    const batchRowStyle = !b.available 
                                        ? `style="border-bottom: 1px solid #eee; font-size: 13px; background-color: #ffd6d6; color: #721c24;"` 
                                        : `style="border-bottom: 1px solid #eee; font-size: 13px;"`;

                                    return `
                                        <tr ${batchRowStyle}>
                                            <td style="padding: 6px;">${daDate}</td>
                                            <td style="padding: 6px; opacity: 0.7;">#BTC-${b.batchID} ${!b.available ? '(Unavailable)' : ''}</td>
                                            <td style="padding: 6px; font-weight: 600;">${b.quantity}</td>
                                            <td style="padding: 6px; font-weight: 500;">${utdDate}</td>
                                            <td style="padding: 6px;">
                                                <div style="display: flex; gap: 4px;">
                                                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; min-width: 75px; text-align: center; ${bUtdColor}">${bUtdLabel}</span>
                                                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; min-width: 80px; text-align: center; ${bQtyColor}">${bQtyLabel}</span>
                                                </div>
                                            </td>
                                            <td style="padding: 6px; text-align: right;">
                                                <button style="background: #2ed573; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; margin-right: 4px;" 
                                                        onclick="editItemGroup(${b.batchID})">
                                                    Edit Batch
                                                </button>
                                                <button style="background: #ff4757; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;" 
                                                        onclick="deleteBatchRow(${b.batchID})" ${!b.available ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>
                                                    Delete Batch
                                                </button>
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
    if (totalItems) {
        totalItems.textContent = inventoryGroups.filter(g => g.anyAvailable).length;
    }
    
    const valueSum = rawInventory.reduce((sum, row) => {
        if (row.available) {
            return sum + (row.quantity * row.price);
        }
        return sum; 
    }, 0);
    
    if (inventoryValue) {
        inventoryValue.textContent = `₱${valueSum.toLocaleString("en-PH", { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    }
}

function populateStockDropdown() {
    if (!stockItemSelect) return;
    stockItemSelect.innerHTML = '<option value="" disabled selected>Select an item registry...</option>';
    
    const itemTracker = new Set();
    rawInventory.forEach(row => {
        if (row.available && !itemTracker.has(row.itemName)) {
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

// ============================================================================
// WINDOW-SCOPED GLOBAL DOM INTERACTION TRIGGERS
// ============================================================================
window.toggleExpand = function(groupName) {
    const group = inventoryGroups.find(g => g.name === groupName);
    if (group) {
        group.expanded = !group.expanded;
        renderInventory();
    }
};

window.editItemGroup = function(batchId) {
    console.log("🎯 Loading parameters into Edit Window for BatchID:", batchId);
    
    const targetBatch = rawInventory.find(b => b.batchID === batchId);
    if (!targetBatch) return;

    modalTitle.textContent = "Edit Inventory Item";
    
    document.getElementById("editBatchId").value = batchId;
    document.getElementById("editItemId").value = targetBatch.itemID;
    document.getElementById("itemName").value = targetBatch.itemName;
    document.getElementById("itemQuantity").value = targetBatch.quantity;
    document.getElementById("itemCategory").value = targetBatch.category;
    document.getElementById("itemPrice").value = targetBatch.price;
    
    // Explicit clean splitting to prevent form timezone offsets shifting selected days backward
    const formattedDate = `${targetBatch.utDyear}-${String(targetBatch.utDmonth).padStart(2, '0')}-${String(targetBatch.utDday).padStart(2, '0')}`;
    document.getElementById("itemUTD").value = formattedDate;

    const qtyInput = document.getElementById("itemQuantity");
    const utdInput = document.getElementById("itemUTD");
    
    qtyInput.style.display = "block";
    qtyInput.setAttribute("required", "true");
    utdInput.style.display = "block";
    utdInput.setAttribute("required", "true");
    
    itemForm.dataset.mode = "EDIT";
    itemModal.classList.remove("hidden");
};

window.deleteBatchRow = async function(batchId) {
    if (!confirm(`Are you sure you want to delete Batch #${batchId}?`)) {
        return; 
    }

    console.log("Sending delete request for Batch ID:", batchId);

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/delete/${batchId}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to remove record from backend.");
        }

        console.log(`Batch ${batchId} deleted successfully.`);
        await initializeDashboard();
    } catch (error) {
        console.error("Delete handler error:", error);
        alert("The deletion could not be executed: " + error.message);
    }
};

window.deleteEntireItem = async function(itemName) {
    if (!confirm(`Are you sure you want to delete all batch records for "${itemName}"?`)) {
        return;
    }

    const group = inventoryGroups.find(g => g.name === itemName);
    if (!group || group.batches.length === 0) {
        alert("Could not locate underlying batches for this product asset.");
        return;
    }

    console.log(`Starting sequential soft-delete loop for all batches under: ${itemName}`);

    try {
        // Run sequentially using a loop rather than executing all parallel fetches at once
        // This stops asynchronous locking on localized SQL database engines
        for (const batch of group.batches) {
            const response = await fetch(`${API_BASE_URL}/inventory/delete/${batch.batchID}`, { method: "DELETE" });
            if (!response.ok) throw new Error(`Batch ID ${batch.batchID} rejected state structural updates.`);
        }

        console.log(`All batches for "${itemName}" successfully marked unavailable.`);
        await initializeDashboard();
    } catch (error) {
        console.error("Cascade delete failure:", error);
        alert("Error executing item removal: " + error.message);
    }
};

// ============================================================================
// MUTATION SUBMIT ACTIONS (CREATE / UPDATE)
// ============================================================================
itemForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const mode = itemForm.dataset.mode;
    const nameValue = document.getElementById("itemName").value;
    const qtyValue = parseInt(document.getElementById("itemQuantity").value);
    const catValue = document.getElementById("itemCategory").value;
    const priceValue = parseFloat(document.getElementById("itemPrice").value);
    
    const utdValue = document.getElementById("itemUTD").value; 
    // Safely parse local raw strings without losing timezone offsets
    const dateParts = utdValue.split("-");
    const yearParsed = parseInt(dateParts[0]);
    const monthParsed = parseInt(dateParts[1]);
    const dayParsed = parseInt(dateParts[2]);

    const today = new Date();

    if (mode === "EDIT") {
        const batchId = parseInt(document.getElementById("editBatchId").value);
        const itemId = parseInt(document.getElementById("editItemId").value);
        
        const payload = {
            batchID: batchId,
            itemID: itemId,
            itemName: nameValue,
            category: catValue,
            price: priceValue,
            quantity: qtyValue,
            utDmonth: monthParsed,
            utDday: dayParsed,
            utDyear: yearParsed
        };

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
        const nextId = rawInventory.length > 0 ? Math.max(...rawInventory.map(r => r.itemID)) + 1 : 101;
        const payload = {
            itemID: nextId,
            itemName: nameValue,
            category: catValue,
            price: priceValue,
            quantity: qtyValue,
            utDmonth: monthParsed,
            utDday: dayParsed,
            utDyear: yearParsed,
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

stockForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    const itemId = parseInt(selectedOption.value);
    const qty = parseInt(document.getElementById("stockQuantity").value);

    if (currentTransactionType === "IN") {
        const payload = {
            itemID: itemId,
            itemName: selectedOption.dataset.name,
            category: selectedOption.dataset.category,
            price: parseFloat(selectedOption.dataset.price),
            quantity: qty,
            status: "Fresh Stock"
        };
        
        const utdValue = stockUTD.value;
        if (utdValue) {
            const dateParts = utdValue.split("-");
            payload.utDyear = parseInt(dateParts[0]);
            payload.utDmonth = parseInt(dateParts[1]);
            payload.utDday = parseInt(dateParts[2]);
        }

        const today = new Date();
        payload.dAmonth = today.getMonth() + 1;
        payload.dAday = today.getDate();
        payload.dAyear = today.getFullYear();

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error("Stock-In action failed on backend.");
            closeStockModalWindow();
            await initializeDashboard();
        } catch (error) {
            alert(error.message);
        }
        
    } else if (currentTransactionType === "OUT") {
        const selectedBatchOption = stockBatchSelect.options[stockBatchSelect.selectedIndex];
        
        if (!selectedBatchOption || !selectedBatchOption.value) {
            alert("Please select a specific batch to deduct from.");
            return;
        }

        const batchId = parseInt(selectedBatchOption.value);
        const maxAvailable = parseInt(selectedBatchOption.dataset.maxQty);

        if (qty > maxAvailable) {
            alert(`Cannot deduct ${qty} items. This batch only has ${maxAvailable} available.`);
            return;
        }

        const payload = {
            batchID: batchId,
            quantity: qty
        };

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/stock-out-specific`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Deduction failed.");
            }
            
            closeStockModalWindow();
            await initializeDashboard();
        } catch (error) {
            alert(error.message);
        }
    }
});

// ============================================================================
// DYNAMIC CONDITIONAL DROPDOWN OPTIONS DATA INJECTION
// ============================================================================
stockItemSelect.addEventListener("change", () => {
    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    const targetItemName = selectedOption.dataset.name;
    
    if (!stockBatchSelect) return;
    stockBatchSelect.innerHTML = '<option value="" disabled selected>Select an active batch...</option>';

    if (currentTransactionType === "OUT") {
        const activeBatches = rawInventory.filter(row => row.itemName === targetItemName && row.available && row.quantity > 0);

        activeBatches.forEach(batch => {
            const opt = document.createElement("option");
            opt.value = batch.batchID;
            opt.textContent = `Batch #${batch.batchID} (Qty: ${batch.quantity} - Exp: ${batch.utDmonth}/${batch.utDday}/${batch.utDyear})`;
            opt.dataset.maxQty = batch.quantity;
            stockBatchSelect.appendChild(opt);
        });
    }
});

// ============================================================================
// UI WINDOW TOGGLE HANDLERS
// ============================================================================
addItemBtn.addEventListener("click", () => {
    modalTitle.textContent = "Add Inventory Item";
    itemForm.reset();
    
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
    
    document.getElementById("batchSelectContainer").style.display = "none";
    stockBatchSelect.removeAttribute("required");
    
    stockUTD.style.display = "block";
    stockUTD.setAttribute("required", "true");
    stockUTDLabel.style.display = "block";
    stockModal.classList.remove("hidden");
});

stockOutBtn.addEventListener("click", () => {
    currentTransactionType = "OUT";
    stockModalTitle.textContent = "Stock-Out Transaction (Deduct Specific Batch)";
    stockForm.reset();
    
    document.getElementById("batchSelectContainer").style.display = "block";
    stockBatchSelect.setAttribute("required", "true");
    
    stockUTD.style.display = "none";
    stockUTD.removeAttribute("required");
    stockUTDLabel.style.display = "none";
    stockModal.classList.remove("hidden");
});

function closeItemModalWindow() { itemModal.classList.add("hidden"); }
function closeStockModalWindow() { stockModal.classList.add("hidden"); }

closeModal.addEventListener("click", closeItemModalWindow);
closeStockModal.addEventListener("click", closeStockModalWindow);

// ============================================================================
// FILTERS & SEARCH EXECUTION PIPELINES
// ============================================================================
function getLowStockGroups() {
    return inventoryGroups.map(group => {
        const lowStockBatches = group.batches.filter(b => b.quantity <= 5);
        return {
            ...group,
            batches: lowStockBatches,
            expanded: group.expanded 
        };
    }).filter(group => {
        const totalQty = group.batches.reduce((sum, b) => sum + b.quantity, 0);
        return totalQty <= 5 && group.batches.length > 0;
    });
}

lowStockBtn.addEventListener("click", () => {
    if (currentFilterMode === "DEFAULT") {
        currentFilterMode = "LOW_STOCK";
        
        inventoryGroups.forEach(g => {
            const hasLowStock = g.batches.some(b => b.quantity <= 5);
            if (hasLowStock) g.expanded = true;
        });

        renderInventory();
        lowStockBtn.textContent = "Back to Default";
        lowStockBtn.style.background = "#ffa502"; 
    } else {
        currentFilterMode = "DEFAULT";
        groupInventoryData(); 
        renderInventory();
        lowStockBtn.textContent = "Low Stock Items";
        lowStockBtn.style.background = ""; 
    }
});

if (showUnavailableCheckbox) {
    showUnavailableCheckbox.addEventListener("change", () => {
        groupInventoryData();
        renderInventory();
    });
}

searchInput.addEventListener("keyup", () => {
    const term = searchInput.value.toLowerCase();
    const matches = inventoryGroups.filter(g => 
        g.name.toLowerCase().includes(term) || g.category.toLowerCase().includes(term)
    );
    renderInventory(matches);
});

// ============================================================================
// RUN DYNAMIC SYNCHRONIZATION AUTOMATICALLY ON PAGE LOAD / INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Fire synchronization routine instantly when the HTML DOM tree compiles
    syncInventoryFromServer();
});

async function syncInventoryFromServer() {
    try {
        // Points to your fully configured C# database routing endpoint
        const response = await fetch(`${API_BASE_URL}/inventory`);
        
        if (!response.ok) {
            throw new Error(`HTTP network degradation error! Status: ${response.status}`);
        }

        const serverData = await response.json();
        
        // 1. Assign server data arrays to your frontend global tracking state variables
        rawInventory = serverData; 
        
        // 2. MAPPED TO YOUR ACTUAL RENDERING PIPELINES:
        // Processes raw structural rows into clustered presentation blocks
        groupInventoryData(); 
        
        // Paints the tables dynamically into the DOM layout container
        renderInventory(); 
        
        // Refreshes drop-down selectors so items display inside Stock-In / Stock-Out menus
        populateStockDropdown(); 

        console.log("Neon Postgres data synced successfully:", rawInventory);
    } catch (error) {
        console.error("Critical lifecycle synchronization failure:", error);
    }
}

// ============================================================================
// AUXILIARY SIDEBAR ROUTING SIMULATION STUBS
// ============================================================================
reportsBtn.addEventListener("click", () => alert("Generating Operational Summary Reports..."));
financialBtn.addEventListener("click", () => alert("Loading Financial Cashflows and Assets Analytics Ledger..."));
stockHistoryBtn.addEventListener("click", () => alert("Opening Historical Transaction Logging Records..."));

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to log out of KusinaFlow?")) {
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem("isLoggedIn", "false");
            window.location.replace("../login/login.html"); 
        }
    });
}

// RUN PROGRAM BOOTSTRAP INITIALIZATION
// CHANGED: Trigger syncInventoryFromServer instead of initializeDashboard 
// to make sure your data array state stays persistently structured across view loads!
document.addEventListener("DOMContentLoaded", syncInventoryFromServer);