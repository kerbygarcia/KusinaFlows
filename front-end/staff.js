// load staff database and current user
let staffList = JSON.parse(localStorage.getItem("staffList")) || [];
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || { name: "Chef Kiko", role: "Owner", username: "chefkiko" };

let editingStaffId = null;
let activeResetUsername = null;
const selectedStaffIds = new Set();

// Elements
const staffTableBody = document.getElementById("staffTableBody");
const searchInput = document.getElementById("staffSearchInput");
const roleFilter = document.getElementById("roleFilter");
const statusFilter = document.getElementById("statusFilter");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const selectedCountText = document.getElementById("selectedCount");
const bulkDeactivateBtn = document.getElementById("bulkDeactivateBtn");

const staffModal = document.getElementById("staffModal");
const staffForm = document.getElementById("staffForm");
const staffModalTitle = document.getElementById("staffModalTitle");
const profilePicInput = document.getElementById("staffProfilePicInput");
const avatarPreview = document.getElementById("staffAvatarPreview");

const detailsModal = document.getElementById("detailsModal");
const passwordModal = document.getElementById("passwordModal");
const passwordForm = document.getElementById("passwordForm");

// Save staff list to localStorage
function saveStaff() {
  localStorage.setItem("staffList", JSON.stringify(staffList));
}

// Convert file to Base64
let base64AvatarData = "";
if (profilePicInput) {
  profilePicInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        base64AvatarData = event.target.result;
        if (avatarPreview) avatarPreview.src = base64AvatarData;
      };
      reader.readAsDataURL(file);
    }
  });
}

// Render Staff List Table
function renderStaff() {
  if (!staffTableBody) return;
  staffTableBody.innerHTML = "";

  const keyword = searchInput.value.toLowerCase().trim();
  const roleVal = roleFilter.value;
  const statusVal = statusFilter.value;

  // Filter staff members
  const filtered = staffList.filter(s => {
    const matchesKeyword = s.fullName.toLowerCase().includes(keyword) || s.username.toLowerCase().includes(keyword);
    const matchesRole = roleVal === "all" || s.role === roleVal;
    const matchesStatus = statusVal === "all" || s.status === statusVal;
    return matchesKeyword && matchesRole && matchesStatus;
  });

  if (filtered.length === 0) {
    staffTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #777; padding: 20px;">No staff members found matching criteria</td></tr>`;
    updateBulkActionStatus();
    return;
  }

  filtered.forEach(s => {
    const row = document.createElement("tr");
    
    // Status badges
    const statusClass = s.status === "Active" ? "in-stock" : "low-stock"; // green vs red
    
    // Avatar URL or default vector avatar icon
    const avatarUrl = s.profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23b08a62'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";

    const isChecked = selectedStaffIds.has(s.id) ? "checked" : "";
    
    // Disable checkbox for currently logged-in user to prevent bulk actions on self
    const disableCheckbox = s.username === currentUser.username ? "disabled" : "";

    row.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="row-checkbox" data-id="${s.id}" ${isChecked} ${disableCheckbox}>
      </td>
      <td><strong>${s.id}</strong></td>
      <td>
        <img src="${avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid #ddd;">
      </td>
      <td><strong>${s.fullName}</strong></td>
      <td>@${s.username}</td>
      <td><span style="font-weight: 600; font-size: 13px;">${s.role}</span></td>
      <td class="${statusClass}"><strong>${s.status}</strong></td>
      <td>${s.dateHired || "-"}</td>
      <td style="font-size: 12px; color: #555;">${s.lastLogin || "-"}</td>
      <td>
        <button onclick="viewDetails('${s.id}')" style="background:#5a4d41; padding: 6px 10px; font-size: 11px;">Details</button>
        <button onclick="editStaff('${s.id}')" style="padding: 6px 10px; font-size: 11px;">Edit</button>
        <button onclick="toggleStaffStatus('${s.id}')" style="background:${s.status === 'Active' ? '#ff4757' : 'green'}; color:white; padding: 6px 10px; font-size: 11px;">
          ${s.status === 'Active' ? 'Deactivate' : 'Activate'}
        </button>
        <button onclick="openResetPassword('${s.username}')" style="background:#3b2a1a; padding: 6px 10px; font-size: 11px;">PW Reset</button>
      </td>
    `;
    staffTableBody.appendChild(row);
  });

  // Attach event listeners to checkboxes
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        selectedStaffIds.add(id);
      } else {
        selectedStaffIds.delete(id);
      }
      updateBulkActionStatus();
    });
  });

  updateBulkActionStatus();
}

// Update Bulk actions panel counts and buttons
function updateBulkActionStatus() {
  if (selectedCountText) {
    selectedCountText.textContent = `${selectedStaffIds.size} staff selected`;
  }
  if (bulkDeactivateBtn) {
    bulkDeactivateBtn.style.display = selectedStaffIds.size > 0 ? "inline-block" : "none";
  }
  if (selectAllCheckbox) {
    const activeCheckedBoxes = document.querySelectorAll(".row-checkbox:not(:disabled)");
    const allChecked = activeCheckedBoxes.length > 0 && Array.from(activeCheckedBoxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
  }
}

// Select All Checkbox Handler
if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener("change", (e) => {
    const checkboxes = document.querySelectorAll(".row-checkbox:not(:disabled)");
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      const id = cb.dataset.id;
      if (e.target.checked) {
        selectedStaffIds.add(id);
      } else {
        selectedStaffIds.delete(id);
      }
    });
    updateBulkActionStatus();
  });
}

// Open Add Staff Modal
document.getElementById("addStaffBtn").addEventListener("click", () => {
  editingStaffId = null;
  base64AvatarData = "";
  staffModalTitle.textContent = "Add New Staff";
  staffForm.reset();
  
  // Set default preview and date hired
  avatarPreview.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23b08a62'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
  document.getElementById("staffPassword").required = true;
  document.getElementById("staffStatusToggle").checked = true;
  
  staffModal.classList.remove("hidden");
});

document.getElementById("closeStaffModal").addEventListener("click", () => {
  staffModal.classList.add("hidden");
});

// Form Submission
staffForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fullName = document.getElementById("staffFullName").value.trim();
  const username = document.getElementById("staffUsername").value.trim().toLowerCase();
  const password = document.getElementById("staffPassword").value;
  const role = document.getElementById("staffRole").value;
  const contactInfo = document.getElementById("staffContactInfo").value.trim();
  const status = document.getElementById("staffStatusToggle").checked ? "Active" : "Inactive";

  // Validations
  if (!/^[a-zA-Z0-9_]{3,15}$/.test(username)) {
    alert("Username must be between 3 and 15 alphanumeric characters (underscores allowed).");
    return;
  }

  // Username unique constraint check
  const duplicate = staffList.find(s => s.username === username && s.id !== editingStaffId);
  if (duplicate) {
    alert("Username is already taken by another staff member.");
    return;
  }

  if (editingStaffId === null) {
    // Generate Staff ID (STF-XXX)
    const nextNum = staffList.length > 0 
      ? Math.max(...staffList.map(s => parseInt(s.id.split("-")[1]))) + 1 
      : 1;
    const staffId = "STF-" + String(nextNum).padStart(3, "0");
    const now = new Date();

    staffList.push({
      id: staffId,
      fullName,
      username,
      password: password || "password123",
      role,
      contactInfo,
      status,
      dateHired: now.toISOString().split("T")[0],
      lastLogin: "-",
      profilePic: base64AvatarData
    });
  } else {
    // Editing
    const staff = staffList.find(s => s.id === editingStaffId);
    
    // Prevent self-deactivation
    if (staff.username === currentUser.username && status === "Inactive") {
      alert("Error: You cannot deactivate your own currently logged-in account!");
      return;
    }

    staff.fullName = fullName;
    staff.username = username;
    if (password) staff.password = password; // Only update password if typed
    staff.role = role;
    staff.contactInfo = contactInfo;
    staff.status = status;
    if (base64AvatarData) staff.profilePic = base64AvatarData;

    // Real-time Update logged-in session profile details if self was edited
    if (staff.username === currentUser.username) {
      currentUser.name = fullName;
      currentUser.role = role;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    }
  }

  saveStaff();
  staffModal.classList.add("hidden");
  renderStaff();
  // Reload navbar user profile info
  window.dispatchEvent(new Event("storage"));
  window.location.reload();
});

// Edit Staff details
window.editStaff = function(id) {
  const staff = staffList.find(s => s.id === id);
  if (!staff) return;

  editingStaffId = id;
  base64AvatarData = staff.profilePic || "";

  staffModalTitle.textContent = "Edit Staff Details";
  document.getElementById("staffFullName").value = staff.fullName;
  document.getElementById("staffUsername").value = staff.username;
  document.getElementById("staffPassword").value = ""; // blank, only update if typed
  document.getElementById("staffPassword").required = false;
  document.getElementById("staffRole").value = staff.role;
  document.getElementById("staffContactInfo").value = staff.contactInfo;
  document.getElementById("staffStatusToggle").checked = (staff.status === "Active");
  
  avatarPreview.src = staff.profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23b08a62'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";

  staffModal.classList.remove("hidden");
};

// View Details Modal Trigger
window.viewDetails = function(id) {
  const staff = staffList.find(s => s.id === id);
  if (!staff) return;

  document.getElementById("detailId").textContent = staff.id;
  document.getElementById("detailFullName").textContent = staff.fullName;
  document.getElementById("detailUsername").textContent = "@" + staff.username;
  document.getElementById("detailContact").textContent = staff.contactInfo;
  document.getElementById("detailHired").textContent = staff.dateHired || "-";
  document.getElementById("detailLogin").textContent = staff.lastLogin || "-";
  
  // Badge display details
  const roleBadge = document.getElementById("detailRoleBadge");
  const statusBadge = document.getElementById("detailStatusBadge");
  
  roleBadge.textContent = staff.role;
  statusBadge.textContent = staff.status;
  
  // styling badge elements based on values
  roleBadge.style.background = staff.role === "Owner" ? "#ff4757" : (staff.role === "Admin" ? "#b08a62" : "#5a4d41");
  roleBadge.style.color = "white";
  
  statusBadge.style.background = staff.status === "Active" ? "green" : "red";
  statusBadge.style.color = "white";

  const avatarUrl = staff.profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23b08a62'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
  document.getElementById("detailAvatar").src = avatarUrl;

  detailsModal.classList.remove("hidden");
};

document.getElementById("closeDetailsModal").addEventListener("click", () => {
  detailsModal.classList.add("hidden");
});

// Toggle Staff active/inactive status
window.toggleStaffStatus = function(id) {
  const staff = staffList.find(s => s.id === id);
  if (!staff) return;

  if (staff.username === currentUser.username) {
    alert("Error: You cannot deactivate your own currently logged-in account!");
    return;
  }

  staff.status = staff.status === "Active" ? "Inactive" : "Active";
  saveStaff();
  renderStaff();
};

// Reset Password modal trigger
window.openResetPassword = function(username) {
  activeResetUsername = username;
  document.getElementById("passwordResetPrompt").textContent = `Set new password for staff account @${username}:`;
  document.getElementById("newPasswordInput").value = "";
  passwordModal.classList.remove("hidden");
};

document.getElementById("closePasswordModal").addEventListener("click", () => {
  passwordModal.classList.add("hidden");
  activeResetUsername = null;
});

passwordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const newPw = document.getElementById("newPasswordInput").value;
  
  if (activeResetUsername) {
    const staff = staffList.find(s => s.username === activeResetUsername);
    if (staff) {
      staff.password = newPw;
      saveStaff();
      alert(`Password updated successfully for @${activeResetUsername}.`);
    }
  }
  passwordModal.classList.add("hidden");
  activeResetUsername = null;
});

// Bulk deactivation
if (bulkDeactivateBtn) {
  bulkDeactivateBtn.addEventListener("click", () => {
    if (selectedStaffIds.size === 0) return;
    if (!confirm(`Are you sure you want to deactivate the ${selectedStaffIds.size} selected staff members?`)) return;

    let count = 0;
    selectedStaffIds.forEach(id => {
      const staff = staffList.find(s => s.id === id);
      if (staff && staff.username !== currentUser.username) {
        staff.status = "Inactive";
        count++;
      }
    });

    saveStaff();
    selectedStaffIds.clear();
    renderStaff();
    alert(`Successfully deactivated ${count} staff member(s).`);
  });
}

// Export staff list as CSV
const exportCsvBtn = document.getElementById("exportCsvBtn");
if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    if (staffList.length === 0) {
      alert("No staff members to export.");
      return;
    }

    const headers = ["Staff ID", "Full Name", "Username", "Role", "Status", "Date Hired", "Last Login", "Contact Info"];
    const rows = staffList.map(s => [
      s.id,
      s.fullName,
      s.username,
      s.role,
      s.status,
      s.dateHired || "-",
      s.lastLogin || "-",
      s.contactInfo || "-"
    ]);

    // Build CSV string
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.map(h => `"${h}"`).join(",") + "\n"
      + rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KusinaFlow_StaffList_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Print List (PDF trigger)
const printListBtn = document.getElementById("printListBtn");
if (printListBtn) {
  printListBtn.addEventListener("click", () => {
    window.print();
  });
}

// Reset All Passwords emergency action
const emergencyResetBtn = document.getElementById("emergencyResetBtn");
if (emergencyResetBtn) {
  emergencyResetBtn.addEventListener("click", () => {
    const defaultPw = "KusinaFlow2026";
    if (!confirm(`EMERGENCY PASSWORD RESET:\n\nAre you sure you want to reset ALL active staff passwords to the default password: "${defaultPw}"?`)) {
      return;
    }

    staffList.forEach(s => {
      s.password = defaultPw;
    });

    saveStaff();
    alert(`Emergency Reset Complete! All passwords have been reset to: ${defaultPw}`);
  });
}

// Search and Filter Listeners
if (searchInput) searchInput.addEventListener("input", renderStaff);
if (roleFilter) roleFilter.addEventListener("change", renderStaff);
if (statusFilter) statusFilter.addEventListener("change", renderStaff);

// Init
document.addEventListener("DOMContentLoaded", () => {
  renderStaff();
});
