// ============================================================================
// CONFIGURATION & GLOBAL STATE MANAGER
// ============================================================================
const API_BASE_URL = "http://localhost:5244/api"; 

let staffRegistry = [];
let selectedStaffIds = new Set();

// DOM Elements - Core Layout Structures
const staffTableBody = document.getElementById("staffTableBody");
const selectedCount = document.getElementById("selectedCount");
const bulkDeactivateBtn = document.getElementById("bulkDeactivateBtn");
const staffSearchInput = document.getElementById("staffSearchInput");
const roleFilter = document.getElementById("roleFilter");
const statusFilter = document.getElementById("statusFilter");

// Modals & Forms Mappings
const staffModal = document.getElementById("staffModal");
const staffForm = document.getElementById("staffForm");
const staffModalTitle = document.getElementById("staffModalTitle");
const closeStaffModal = document.getElementById("closeStaffModal");

// Form Inputs - Interactive Elements
const staffProfilePicInput = document.getElementById("staffProfilePicInput");
const staffAvatarPreview = document.getElementById("staffAvatarPreview");
const staffFirstName = document.getElementById("staffFirstName");
const staffMI = document.getElementById("staffMI");
const staffLastName = document.getElementById("staffLastName");
const staffUsername = document.getElementById("staffUsername");
const staffPassword = document.getElementById("staffPassword");
const staffRole = document.getElementById("staffRole");
const staffContactInfo = document.getElementById("staffContactInfo");
const staffStatusToggle = document.getElementById("staffStatusToggle");

// Topbar Trigger Action
const addStaffBtn = document.getElementById("addStaffBtn");

// Holds the raw base64 string of the uploaded image file
let structuralBase64Image = "";

// ============================================================================
// INITIALIZATION & RESOURCE SYNCHRONIZATION (READ)
// ============================================================================
async function initializeStaffDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/staff`);
        if (!response.ok) throw new Error(`Server status: ${response.status}`);
        
        staffRegistry = await response.json();
        console.log("Raw Staff Data from Server:", staffRegistry[0]);
        renderStaffTable();
    } catch (error) {
        console.error("Staff management execution failure:", error);
        if (staffTableBody) {
            staffTableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="color: #ff4757; text-align: center; font-weight: bold; padding: 20px;">
                        ⚠️ System Offline: Could not communicate with Staff Routing Server.<br>
                        <span style="font-size: 12px; font-weight: normal; color: #aaa;">Error: ${error.message}</span>
                    </td>
                </tr>`;
        }
    }
}

// ============================================================================
// DYNAMIC TABLES COMPONENT RENDERING ENGINE
// ============================================================================
function renderStaffTable(filteredData = null) {
    if (!staffTableBody) return;
    
    const records = filteredData !== null ? filteredData : staffRegistry;
    staffTableBody.innerHTML = "";
    
    records.forEach(staff => {
        // 🎯 EXACT CASING MATCH FOR YOUR BACKEND PAYLOAD
        const staffId = staff.sC_ID; 

        const row = document.createElement("tr");
        
        const profileImageSrc = staff.profilePicture && staff.profilePicture.trim() !== "" 
            ? staff.profilePicture 
            : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23ccc'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-10 4-10 4v2h20v-2s-3.9-4-10-4z'/></svg>";

        const statusStyle = staff.active 
            ? "background: #d4edda; color: #28a745;" 
            : "background: #fdadb2; color: #721c24;";

        const isChecked = selectedStaffIds.has(staffId) ? "checked" : "";

        row.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="row-select-checkbox" data-id="${staffId}" ${isChecked} onchange="handleRowSelect(this)">
            </td>
            <td><strong>#${staffId}</strong></td> 
            <td>
                <img src="${profileImageSrc}" alt="Avatar" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 1px solid #ddd; background: #fafafa;">
            </td>
            <td>${staff.lastName}, ${staff.firstName} ${staff.mi || ""}</td>
            <td>${staff.username}</td>
            <td><span style="font-weight: 500;">${staff.position}</span></td>
            <td>
                <span style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; ${statusStyle}">${staff.active ? 'Active' : 'Inactive'}</span>
            </td>
            <td>${staff.dateHired}</td>
            <td>${staff.lastLogin || '<span style="color:#aaa; font-style:italic;">Unknown</span>'}</td>
            <td>
                <button style="background: #2ed573; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;" 
                        onclick="loadStaffForEditing(${staffId})">
                    Edit
                </button>
            </td>
        `;
        staffTableBody.appendChild(row);
    });
    
    updateBulkActionPanelState();
}

// ============================================================================
// BASE64 PLAIN TEXT IMAGE STREAM PROCESSING
// ============================================================================
if (staffProfilePicInput) {
    staffProfilePicInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            structuralBase64Image = event.target.result;
            
            if (staffAvatarPreview) {
                staffAvatarPreview.src = structuralBase64Image;
            }
        };
        reader.readAsDataURL(file);
    });
}

// ============================================================================
// MUTATION SUBMIT ACTIONS (CREATE / UPDATE)
// ============================================================================
staffForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const mode = staffForm.dataset.mode;
    const today = new Date();
    
    const localDateHired = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Structure matches your C# StaffDto exactly
    const payload = {
        FirstName: staffFirstName.value.trim(),
        MI: staffMI.value.trim() || null,
        LastName: staffLastName.value.trim(),
        Position: staffRole.value,               
        Username: staffUsername.value.trim(),
        ContactInfo: staffContactInfo ? staffContactInfo.value.trim() : null,
        ProfilePicture: structuralBase64Image || null,
        Active: staffStatusToggle.checked        
    };

    if (mode === "EDIT") {
        const staffId = parseInt(staffForm.dataset.editId);
        payload.SC_ID = staffId;
        
        if (staffPassword && staffPassword.value.trim() !== "") {
            payload.Password = staffPassword.value.trim();
        } else {
            payload.Password = null;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/staff/${staffId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Backend system rejected structural data modification updates.");
            }
            
            closeStaffModalWindow();
            await initializeStaffDashboard();
        } catch (error) {
            console.error("Staff modification update fault:", error);
            alert("Error updating record: " + error.message);
        }
    } else {
        payload.DateHired = localDateHired;
        payload.Password = staffPassword.value.trim() || "password123"; 
        payload.LastLogin = "-";

        try {
            const response = await fetch(`${API_BASE_URL}/staff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Failed to write fresh entry row to database storage.");
            }
            
            closeStaffModalWindow();
            await initializeStaffDashboard();
        } catch (error) {
            console.error("Staff addition execution fault:", error);
            alert("Error writing entity payload: " + error.message);
        }
    }
});

// ============================================================================
// MODAL WINDOW INTERACTIVE CONTROLS
// ============================================================================
addStaffBtn.addEventListener("click", () => {
    staffModalTitle.textContent = "Add New Staff";
    staffForm.reset();
    
    staffForm.dataset.mode = "ADD";
    structuralBase64Image = ""; 
    
    if (staffAvatarPreview) staffAvatarPreview.src = "";
    if (staffPassword) staffPassword.setAttribute("required", "true"); 
    
    staffModal.classList.remove("hidden");
    staffModal.style.display = "flex";
});

window.loadStaffForEditing = function(staffId) {
    // 🎯 FIX 1: Checked against correct sC_ID backend casing constraint
    const target = staffRegistry.find(s => s.sC_ID === staffId);
    if (!target) return;

    staffModalTitle.textContent = "Edit Staff Member Settings";
    staffForm.reset();

    staffForm.dataset.mode = "EDIT";
    staffForm.dataset.editId = staffId;
    staffForm.dataset.dateHired = target.dateHired;

    // 🎯 FIX 2: Properties populated explicitly from working camelCase keys
    staffFirstName.value = target.firstName || "";
    staffMI.value = target.mi || "";
    staffLastName.value = target.lastName || "";
    staffUsername.value = target.username || "";
    staffRole.value = target.position || "Staff"; // Maps correctly to target.position
    
    if (staffContactInfo) {
        staffContactInfo.value = target.contactInfo || "";
    }
    
    // 🎯 FIX 3: Bound checkbox explicitly to active state boolean property
    staffStatusToggle.checked = !!target.active;

    structuralBase64Image = target.profilePicture || "";
    if (staffAvatarPreview) {
        staffAvatarPreview.src = structuralBase64Image || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23ccc'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-10 4-10 4v2h20v-2s-3.9-4-10-4z'/></svg>";
    }
    
    if (staffPassword) {
        staffPassword.removeAttribute("required"); 
        staffPassword.placeholder = "Leave blank to keep password unchanged";
    }

    staffModal.classList.remove("hidden");
    staffModal.style.display = "flex";
};

function closeStaffModalWindow() {
    staffModal.classList.add("hidden");
    staffModal.style.display = "none";
}
closeStaffModal.addEventListener("click", closeStaffModalWindow);

// ============================================================================
// LIVE DYNAMIC INTERPOLATION DATA MATCH FILTERS
// ============================================================================
staffSearchInput.addEventListener("keyup", performPipelineSearchFilter);
roleFilter.addEventListener("change", performPipelineSearchFilter);
statusFilter.addEventListener("change", performPipelineSearchFilter);

function performPipelineSearchFilter() {
    const term = staffSearchInput.value.toLowerCase();
    const selectedRole = roleFilter.value;
    const selectedStatus = statusFilter.value;

    const matches = staffRegistry.filter(staff => {
        const matchTerm = (staff.firstName + " " + staff.lastName + " " + staff.username).toLowerCase().includes(term);
        const matchRole = selectedRole === "all" || staff.position === selectedRole; 
        const matchStatus = selectedStatus === "all" || (selectedStatus === "Active" ? staff.active : !staff.active); 
        return matchTerm && matchRole && matchStatus;
    });

    renderStaffTable(matches);
}

// ============================================================================
// SELECTION MANAGEMENT HOOKS
// ============================================================================
window.handleRowSelect = function(checkbox) {
    const id = parseInt(checkbox.dataset.id); 
    if (checkbox.checked) {
        selectedStaffIds.add(id);
    } else {
        selectedStaffIds.delete(id);
    }
    updateBulkActionPanelState();
};

document.getElementById("selectAllCheckbox").addEventListener("change", function(e) {
    const visibleCheckboxes = staffTableBody.querySelectorAll(".row-select-checkbox");
    visibleCheckboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const id = parseInt(cb.dataset.id);
        if (e.target.checked) {
            selectedStaffIds.add(id);
        } else {
            selectedStaffIds.delete(id);
        }
    });
    updateBulkActionPanelState();
});

function updateBulkActionPanelState() {
    if (selectedCount) selectedCount.textContent = `${selectedStaffIds.size} staff selected`;
    if (bulkDeactivateBtn) {
        bulkDeactivateBtn.style.display = selectedStaffIds.size > 0 ? "inline-block" : "none";
    }
}

// ============================================================================
// DOM LIFECYCLE RUNTIME INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (!user) return;

    const roleDropdown = document.getElementById("staffRole");

    if (user.position === "Manager") {
        if (roleDropdown) {
            roleDropdown.innerHTML = `<option value="Staff">Staff</option>`;
        }

        const originalLoadStaffForEditing = window.loadStaffForEditing;
        window.loadStaffForEditing = function(staffId) {
            // 🎯 FIX 4: Aligned interception logic check to match sC_ID casing
            const targetWorker = staffRegistry.find(s => s.sC_ID === staffId);
            
            if (targetWorker && (targetWorker.position === "Manager" || targetWorker.position === "Owner")) {
                alert("Privilege Limitation Error: Managers cannot alter Managerial or Ownership security structures.");
                return;
            }
            originalLoadStaffForEditing(staffId);
        };
    }
    
    initializeStaffDashboard();
});