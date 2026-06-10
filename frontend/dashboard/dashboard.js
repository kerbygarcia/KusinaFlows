const API_BASE_URL = "http://localhost:5244/api"; 

let rawInventory = []; 
let inventoryGroups = []; 
let currentTransactionType = ""; // Tracks 'IN' or 'OUT'

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

// Integrated Custom Cascading Dropdown Drop-Boxes
const stockCategorySelect = document.getElementById("stockCategorySelect");
const stockBatchSelect = document.getElementById("stockBatchSelect");
const stockBatchLabel = document.getElementById("stockBatchLabel");

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

// Global Checkbox Fallback (In case element isn't declared in HTML yet)
const showUnavailableCheckbox = document.getElementById("showUnavailableCheckbox") || { checked: false };

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
        const expiryDate = new Date(row.utDyear, row.utDmonth - 1, row.utDday);
        expiryDate.setHours(0, 0, 0, 0);
        
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Automatic Safety Invalidation Rules
        if (diffDays < 0 || row.quantity === 0) {
            row.available = false;
        }

        if (!showAll && !row.available) {
            return;
        }

        if (!groups[row.itemName]) {
            groups[row.itemName] = {
                id: row.ItemID,
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

function renderInventory(filteredGroups = inventoryGroups) {
    if (!inventoryTableBody) return;
    inventoryTableBody.innerHTML = "";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filteredGroups.length === 0) {
        inventoryTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #888;">No items discovered.</td></tr>`;
        updateMetrics();
        return;
    }

    filteredGroups.forEach(group => {
        const totalQty = group.batches.reduce((sum, b) => sum + (b.available ? b.quantity : 0), 0);
        const isGroupUnavailable = !group.anyAvailable;

        // --- GROUP QUANTITY BADGE GENERATION ---
        let qtyLabel = ""; let qtyColor = "";
        if (totalQty === 0) {
            qtyLabel = "No Stock"; qtyColor = "background: #fdadb2; color: #721c24;";
        } else if (totalQty <= 5) {
            qtyLabel = "Low Stock"; qtyColor = "background: #ffe0e3; color: #ff4757;";
        } else if (totalQty > 15) {
            qtyLabel = "High Stock"; qtyColor = "background: #d4edda; color: #28a745;";
        } else {
            qtyLabel = "Moderate Stock"; qtyColor = "background: #fff3cd; color: #856404;";
        }

        // --- GROUP UTD EXPIRES BADGE GENERATION ---
        const activeBatches = group.batches.filter(b => b.available);
        let utdLabel = "N/A"; let utdColor = "background: #eee; color: #666;";

        if (activeBatches.length > 0) {
            const minDays = Math.min(...activeBatches.map(b => {
                const exp = new Date(b.utDyear, b.utDmonth - 1, b.utDday);
                return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            }));

            if (minDays < 0) {
                utdLabel = "Expired"; utdColor = "background: #721c24; color: #ffffff;";
            } else if (minDays <= 7) {
                utdLabel = "Critical"; utdColor = "background: #ffe0e3; color: #ff4757;";
            } else if (minDays <= 14) {
                utdLabel = "Expiring Soon"; utdColor = "background: #fff3cd; color: #856404;";
            } else {
                utdLabel = "Fresh Stock"; utdColor = "background: #d4edda; color: #28a745;";
            }
        } else if (isGroupUnavailable) {
            utdLabel = "Archived"; utdColor = "background: #fdadb2; color: #721c24;";
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
            <td>${totalQty} units</td>
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

        // --- EXPANDED NESTED SUB-TABLE BATCHES ---
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
                                    else if (b.quantity <= 5) { bQtyLabel = "Low Stock"; bQtyColor = "background: #ffe0e3; color: #ff4757;"; }
                                    else if (b.quantity > 15) { bQtyLabel = "High Stock"; bQtyColor = "background: #d4edda; color: #28a745;"; }
                                    else { bQtyLabel = "Moderate Stock"; bQtyColor = "background: #fff3cd; color: #856404;"; }

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

if (showUnavailableCheckbox && showUnavailableCheckbox.addEventListener) {
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

// ==========================================
// CASCADING SINGLE-TARGET STOCK SELECTION MANAGEMENT
// ==========================================
function prepareStockModal(transactionType) {
    currentTransactionType = transactionType;
    stockForm.reset();
    
    // Completely clear and drop down secondary selection targets
    if (stockCategorySelect) {
        stockCategorySelect.innerHTML = '<option value="" disabled selected>Choose Category...</option>';
    }
    stockItemSelect.innerHTML = '<option value="" disabled selected>Choose Item...</option>';
    stockItemSelect.disabled = true;

    if (stockBatchSelect) {
        stockBatchSelect.innerHTML = '<option value="" disabled selected>Choose Batch...</option>';
        stockBatchSelect.disabled = true;
    }

    const qtyInput = document.getElementById("stockQuantity");
    qtyInput.removeAttribute("max");
    qtyInput.placeholder = "How Many?";

    // Dynamically filter all unique categories from the current active dataset
    const uniqueCategories = [...new Set(rawInventory.map(row => row.category))];
    uniqueCategories.sort().forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        if (stockCategorySelect) stockCategorySelect.appendChild(opt);
    });

    if (transactionType === "IN") {
        stockModalTitle.textContent = "Stock-In Transaction (Add New Batch)";
        stockUTD.style.display = "block";
        stockUTD.setAttribute("required", "true");
        stockUTDLabel.style.display = "block";
        
        if (stockBatchSelect) {
            stockBatchSelect.style.display = "none";
            stockBatchSelect.removeAttribute("required");
        }
        if (stockBatchLabel) stockBatchLabel.style.display = "none";
    } else {
        stockModalTitle.textContent = "Stock-Out Transaction (Deduct from Specific Batch)";
        stockUTD.style.display = "none";
        stockUTD.removeAttribute("required");
        stockUTDLabel.style.display = "none";
        
        if (stockBatchSelect) {
            stockBatchSelect.style.display = "block";
            stockBatchSelect.setAttribute("required", "true");
        }
        if (stockBatchLabel) stockBatchLabel.style.display = "block";
    }

    stockModal.classList.remove("hidden");
}

// Cascading Layer 1: Selecting Category filters item selection dropdown
if (stockCategorySelect) {
    stockCategorySelect.addEventListener("change", () => {
        const selectedCategory = stockCategorySelect.value;
        stockItemSelect.innerHTML = '<option value="" disabled selected>Choose Item Registry...</option>';
        stockItemSelect.disabled = false;
        
        if (stockBatchSelect) {
            stockBatchSelect.innerHTML = '<option value="" disabled selected>Choose Item...</option>';
            stockBatchSelect.disabled = true;
        }

        const filteredItems = [];
        const itemTracker = new Set();

        rawInventory.forEach(row => {
            if (row.category === selectedCategory && !itemTracker.has(row.itemName)) {
                // If stocking out, skip item registers entirely if they have no available records at all
                if (currentTransactionType === "OUT" && !row.available) return;
                
                itemTracker.add(row.itemName);
                filteredItems.push(row);
            }
        });

        filteredItems.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item.ItemID; // C# Binding Property Safety Anchor Target
            opt.dataset.name = item.itemName;
            opt.dataset.category = item.category;
            opt.dataset.price = item.price;
            opt.textContent = item.itemName;
            stockItemSelect.appendChild(opt);
        });
    });
}

// Cascading Layer 2: Selecting Item filters and populates direct database batches
stockItemSelect.addEventListener("change", () => {
    if (currentTransactionType === "IN") return; // Stock-In generates new lines directly, skip batch lookups

    const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
    const selectedItemName = selectedOption.dataset.name;

    if (stockBatchSelect) {
        stockBatchSelect.innerHTML = '<option value="" disabled selected>Choose a Batch...</option>';
        stockBatchSelect.disabled = false;
    }

    // Pull active, unexpired batches holding raw inventory quantities
    const activeBatches = rawInventory.filter(b => b.itemName === selectedItemName && b.available && b.quantity > 0);

    if (activeBatches.length === 0) {
        if (stockBatchSelect) {
            stockBatchSelect.innerHTML = '<option value="" disabled selected>Walang magagamit na batch!</option>';
            stockBatchSelect.disabled = true;
        }
        return;
    }

    activeBatches.forEach(b => {
        const utdDate = `${String(b.utDmonth).padStart(2, '0')}/${String(b.utDday).padStart(2, '0')}/${b.utDyear}`;
        const opt = document.createElement("option");
        opt.value = b.batchID;
        opt.dataset.maxQty = b.quantity; // Bound tracking safety variables onto element attributes
        opt.textContent = `Batch #${b.batchID} (Mayroong ${b.quantity} marka - Exp: ${utdDate})`;
        if (stockBatchSelect) stockBatchSelect.appendChild(opt);
    });
});

// Cascading Layer 3: Selecting Batch limits max allowed numeric boundary inside quantity inputs
if (stockBatchSelect) {
    stockBatchSelect.addEventListener("change", () => {
        const selectedBatchOption = stockBatchSelect.options[stockBatchSelect.selectedIndex];
        const maxAllowedStock = parseInt(selectedBatchOption.dataset.maxQty);
        
        const qtyInput = document.getElementById("stockQuantity");
        qtyInput.setAttribute("max", maxAllowedStock);
        qtyInput.placeholder = `Only ${maxAllowedStock} available`;
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
    document.getElementById("editItemId").value = targetBatch.ItemID;

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
    if (!confirm(`Sigurado ka ba na gusto mong burahin ang Batch #${batchId}?`)) {
        return; 
    }

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/delete/${batchId}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to remove record from backend.");
        }

        await initializeDashboard();
    } catch (error) {
        console.error("Delete handler error:", error);
        alert("Hindi naisakatuparan ang pagbura: " + error.message);
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
            ItemID: itemId,
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
        const nextId = rawInventory.length > 0 ? Math.max(...rawInventory.map(r => r.ItemID)) + 1 : 101;
        const payload = {
            ItemID: nextId,
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

// STOCK HANDLING ACTIONS (STOCK-IN / TARGETED STOCK-OUT)
stockForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const qty = parseInt(document.getElementById("stockQuantity").value);
    const today = new Date();

    if (currentTransactionType === "IN") {
        const selectedOption = stockItemSelect.options[stockItemSelect.selectedIndex];
        const itemId = parseInt(selectedOption.value);
        const utdValue = stockUTD.value;
        if (!utdValue) {
            alert("Please specify an expiry target mapping window.");
            return;
        }
        const utdDate = new Date(utdValue);

        const payload = {
            ItemID: itemId,
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
        const selectedBatchOption = stockBatchSelect.options[stockBatchSelect.selectedIndex];
        const batchId = parseInt(selectedBatchOption.value);
        const maxQty = parseInt(selectedBatchOption.dataset.maxQty);

        if (qty > maxQty) {
            alert(`Cannot proceed! Only ${maxQty} units available in this batch.`);
            return;
        }

        // Clean direct payload mapped cleanly to Single Target C# DTO Properties
        const payload = {
            BatchID: batchId,
            QuantityToDeduct: qty
        };

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/stock-out-specific`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Reduction step processing failed.");
            }
            
            alert(data.message);
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

stockInBtn.addEventListener("click", () => prepareStockModal("IN"));
stockOutBtn.addEventListener("click", () => prepareStockModal("OUT"));

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

// ==========================================
// DELETE ENTIRE ITEM GROUP (ALL BATCHES)
// ==========================================
window.deleteEntireItem = async function(itemName) {
    if (!confirm(`Are you sure you want to delete "${itemName}" and all its batches?`)) {
        return;
    }

    const group = inventoryGroups.find(g => g.name === itemName);
    if (!group || group.batches.length === 0) {
        alert("Can't find the item group or it has no batches to delete.");
        return;
    }

    try {
        const deletePromises = group.batches.map(batch => 
            fetch(`${API_BASE_URL}/inventory/delete/${batch.batchID}`, { method: "DELETE" })
        );

        const responses = await Promise.all(deletePromises);
        const allSuccessful = responses.every(res => res.ok);

        if (!allSuccessful) {
            throw new Error("May ilang batch na hindi nabura nang maayos sa database.");
        }

        await initializeDashboard();

    } catch (error) {
        console.error("Cascade delete failure:", error);
        alert("Error executing item removal: " + error.message);
    }
};

document.addEventListener("DOMContentLoaded", initializeDashboard);