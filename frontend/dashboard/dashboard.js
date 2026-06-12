const API_BASE_URL = "http://localhost:5244/api"; 

let rawInventory = []; 
let inventoryGroups = []; 
let currentTransactionType = ""; // Tracks 'In' or 'Out'

// ADD THIS: Track current filter state ('DEFAULT' or 'LOW_STOCK')
let currentFilterMode = "DEFAULT";

// DOM Elements
const inventoryTableBody = document.getElementById("inventoryTableBody");
const totalItems = document.getElementById("totalItems");
const inventoryValue = document.getElementById("inventoryValue");
const searchInput = document.getElementById("searchInput");
const showUnavailableCheckbox = document.getElementById("showUnavailableCheckbox");

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

// Change the default parameter logic to look at your tracking state
function renderInventory(filteredGroups = null) {
    if (!inventoryTableBody) return;
    
    // If no explicit array was passed, determine what to show based on currentFilterMode
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

if (showUnavailableCheckbox) {
    showUnavailableCheckbox.addEventListener("change", () => {
        groupInventoryData();
        renderInventory();
    });
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

stockForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    const itemId = parseInt(selectedOption.value);
    const qty = parseInt(document.getElementById("stockQuantity").value);

    if (currentTransactionType === "IN") {
        // Safe, functional, untouched Stock-In handling
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
            const utdDate = new Date(utdValue);
            payload.utDmonth = utdDate.getMonth() + 1;
            payload.utDday = utdDate.getDate();
            payload.utDyear = utdDate.getFullYear();
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
        const stockBatchSelect = document.getElementById("stockBatchSelect");
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

// ==========================================
// MODAL DISPLAY TOGGLE UTILITIES
// ==========================================
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
    document.getElementById("stockBatchSelect").removeAttribute("required");
    
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
    document.getElementById("stockBatchSelect").setAttribute("required", "true");
    
    stockUTD.style.display = "none";
    stockUTD.removeAttribute("required");
    stockUTDLabel.style.display = "none";
    stockModal.classList.remove("hidden");
});

function closeItemModalWindow() { itemModal.classList.add("hidden"); }
function closeStockModalWindow() { stockModal.classList.add("hidden"); }

closeModal.addEventListener("click", closeItemModalWindow);
closeStockModal.addEventListener("click", closeStockModalWindow);

// Add a global tracking state variable at the top of your file with the other variables
let isLowStockFilterActive = false; 

// ==========================================
// AUXILIARY SIDEBAR & FILTER BUTTON ACTIONS
// ==========================================
// Helper function to extract and map out precise low stock items safely
function getLowStockGroups() {
    return inventoryGroups.map(group => {
        // Isolate low-stock batches inside the expandable group window
        const lowStockBatches = group.batches.filter(b => b.quantity <= 5);
        
        return {
            ...group,
            batches: lowStockBatches,
            // Keep user expanded configuration state or let it dynamically show data cascades
            expanded: group.expanded 
        };
    }).filter(group => {
        // Sum total active quantity safely
        const totalQty = group.batches.reduce((sum, b) => sum + b.quantity, 0);
        return totalQty <= 5 && group.batches.length > 0;
    });
}

// ==========================================
// AUXILIARY SIDEBAR & FILTER BUTTON ACTIONS
// ==========================================
lowStockBtn.addEventListener("click", () => {
    if (currentFilterMode === "DEFAULT") {
        // Switch context mode to Low Stock view
        currentFilterMode = "LOW_STOCK";
        
        // Force expand item lines so user can instantly see actionable batches
        inventoryGroups.forEach(g => {
            const hasLowStock = g.batches.some(b => b.quantity <= 5);
            if (hasLowStock) g.expanded = true;
        });

        renderInventory();
        
        // Toggle button look and text
        lowStockBtn.textContent = "Back to Default";
        lowStockBtn.style.background = "#ffa502"; 
    } else {
        // Return context state to Default main table view
        currentFilterMode = "DEFAULT";
        
        groupInventoryData(); 
        renderInventory();
        
        // Restore standard button structures
        lowStockBtn.textContent = "Low Stock Items";
        lowStockBtn.style.background = ""; 
    }
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

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        // 1. Show native browser confirmation window
        const confirmLogout = confirm("Are you sure you want to log out of KusinaFlow?");
        
        if (confirmLogout) {
            // 1. Clear session variables
            localStorage.clear();
            sessionStorage.clear();
            
            // 2. Clear token indicators (example authentication flag)
            localStorage.setItem("isLoggedIn", "false");
            
            // 3. Destructive redirect (replaces dashboard in the history stack)
            window.location.replace("../login/login.html"); 
        }
    });
}
// ==========================================
// DELETE ENTIRE ITEM GROUP (ALL BATCHES)
// ==========================================
window.deleteEntireItem = async function(itemName) {
    if (!confirm(`Are you sure you want to delete all batch records for "${itemName}"?`)) {
        return;
    }

    const group = inventoryGroups.find(g => g.name === itemName);
    if (!group || group.batches.length === 0) {
        alert("Could not locate underlying batches for this product asset.");
        return;
    }

    console.log(`Starting cascade soft-delete for all batches under: ${itemName}`);

    try {
        const deletePromises = group.batches.map(batch => 
            fetch(`${API_BASE_URL}/inventory/delete/${batch.batchID}`, { method: "DELETE" })
        );

        const responses = await Promise.all(deletePromises);
        const allSuccessful = responses.every(res => res.ok);

        if (!allSuccessful) {
            throw new Error("Some batches failed to update structural integrity status.");
        }

        console.log(`All batches for "${itemName}" successfully marked unavailable.`);
        await initializeDashboard();

    } catch (error) {
        console.error("Cascade delete failure:", error);
        alert("Error executing item removal: " + error.message);
    }
};

stockItemSelect.addEventListener("change", () => {
    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    const targetItemName = selectedOption.dataset.name;
    const stockBatchSelect = document.getElementById("stockBatchSelect");
    
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

// Run Init on Page Boot
document.addEventListener("DOMContentLoaded", initializeDashboard);