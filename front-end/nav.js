// Navigation system for all pages
// This file handles sidebar routing across the entire system

function go(id, page) {
  const el = document.getElementById(id);

  if (!el) return;

  el.addEventListener("click", () => {
    window.location.href = page;
  });
}

// Route mapping
go("dashboardBtn", "index.html");
go("stocksBtn", "stocks.html");
go("reportBtn", "gen-reports.html");
go("stockHistoryBtn", "stock-history.html");
go("staffBtn", "staff.html");
go("logoutBtn", "index.html");

// Dynamic active state styling & User Profile card injection
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Staff List if not exists
  let staffList = JSON.parse(localStorage.getItem("staffList"));
  if (!staffList || staffList.length === 0) {
    staffList = [
      {
        id: "STF-001",
        fullName: "Chef Kiko",
        username: "chefkiko",
        password: "password123",
        role: "Owner",
        contactInfo: "chefkiko@kusinaflow.com",
        status: "Active",
        dateHired: "2025-01-10",
        lastLogin: "2026-06-14 02:00",
        profilePic: ""
      },
      {
        id: "STF-002",
        fullName: "Alice",
        username: "alice",
        password: "password123",
        role: "Employee",
        contactInfo: "alice@kusinaflow.com",
        status: "Active",
        dateHired: "2025-03-15",
        lastLogin: "2026-06-14 01:15",
        profilePic: ""
      },
      {
        id: "STF-003",
        fullName: "Bob Admin",
        username: "bob",
        password: "password123",
        role: "Admin",
        contactInfo: "bob@kusinaflow.com",
        status: "Active",
        dateHired: "2025-02-20",
        lastLogin: "2026-06-13 18:30",
        profilePic: ""
      }
    ];
    localStorage.setItem("staffList", JSON.stringify(staffList));
  }

  // 2. Retrieve or set default current user (legacy Manager mapped to Owner)
  let currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role === "Manager") {
    currentUser = { name: "Chef Kiko", role: "Owner", username: "chefkiko" };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
  }

  const currentPath = window.location.pathname;
  let activeId = "";

  if (currentPath.includes("stocks.html")) {
    activeId = "stocksBtn";
  } else if (currentPath.includes("gen-reports.html")) {
    activeId = "reportBtn";
  } else if (currentPath.includes("stock-history.html")) {
    activeId = "stockHistoryBtn";
  } else if (currentPath.includes("staff.html")) {
    activeId = "staffBtn";
  } else {
    // Default to dashboard for index.html or root/directory routes
    activeId = "dashboardBtn";
  }

  // 3. Enforce RBAC Page Restrictions
  const isEmployee = currentUser.role === "Employee";
  if (isEmployee) {
    if (currentPath.includes("gen-reports.html") || currentPath.includes("staff.html")) {
      alert("Access Denied: Employees do not have permission to access this page.");
      window.location.href = "index.html";
      return;
    }
  }

  // Dynamically inject Staff Management button to navigation list if not present
  const navUl = document.querySelector(".sidebar nav ul");
  if (navUl && !document.getElementById("staffBtn")) {
    const logoutLi = document.getElementById("logoutBtn");
    const staffLi = document.createElement("li");
    staffLi.id = "staffBtn";
    staffLi.textContent = "Staff Management";
    if (logoutLi) {
      navUl.insertBefore(staffLi, logoutLi);
    } else {
      navUl.appendChild(staffLi);
    }
    go("staffBtn", "staff.html");
  }

  // Hide restricted navigation options for employees
  if (isEmployee) {
    const reportBtn = document.getElementById("reportBtn");
    const staffBtn = document.getElementById("staffBtn");
    if (reportBtn) reportBtn.style.display = "none";
    if (staffBtn) staffBtn.style.display = "none";
  }

  const activeEl = document.getElementById(activeId);
  if (activeEl) {
    activeEl.classList.add("active");
  }

  // Inject user profile card in the sidebar dynamically
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  // Flexbox styling to push the card to the bottom of the sidebar
  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";
  sidebar.style.justifyContent = "space-between";

  const navEl = sidebar.querySelector("nav");
  if (navEl) {
    navEl.style.flex = "1";
    navEl.style.marginBottom = "20px";
  }

  // Create and append user card
  const card = document.createElement("div");
  card.className = "user-card";
  card.style.padding = "12px";
  card.style.background = "rgba(255,255,255,0.06)";
  card.style.borderRadius = "8px";
  card.style.border = "1px solid rgba(255,255,255,0.1)";
  
  // Find active staff member for profile picture
  const activeStaff = staffList.find(s => s.username === currentUser.username) || {};
  const avatarUrl = activeStaff.profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23b08a62'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";

  // Construct options for switcher dropdown containing only active staff
  const activeStaffOptions = staffList
    .filter(s => s.status === "Active")
    .map(s => `<option value="${s.username}" ${s.username === currentUser.username ? 'selected' : ''}>${s.fullName} (${s.role})</option>`)
    .join("");

  card.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <img src="${avatarUrl}" alt="Avatar" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);">
      <div>
        <div style="font-size: 11px; opacity: 0.6; margin-bottom: 2px;">Logged In As:</div>
        <div style="font-weight: bold; font-size: 13px; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;" title="${currentUser.name}">${currentUser.name}</div>
      </div>
    </div>
    <div style="font-size: 10px; color: var(--primary); margin-top: 1px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">${currentUser.role}</div>
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <label style="font-size: 9px; opacity: 0.6;">Switch Account:</label>
      <select id="switchUserSelect" style="width: 100%; padding: 4px; font-size: 11px; background: #3b2a1a; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;">
        ${activeStaffOptions}
      </select>
    </div>
  `;

  sidebar.appendChild(card);

  // Toggle user profile role via select dropdown
  const switchSelect = document.getElementById("switchUserSelect");
  if (switchSelect) {
    switchSelect.addEventListener("change", (e) => {
      const selectedUsername = e.target.value;
      const selectedStaff = staffList.find(s => s.username === selectedUsername);
      if (selectedStaff) {
        // Update user lastLogin
        const now = new Date();
        selectedStaff.lastLogin = now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem("staffList", JSON.stringify(staffList));

        // Set current user
        localStorage.setItem("currentUser", JSON.stringify({
          name: selectedStaff.fullName,
          role: selectedStaff.role,
          username: selectedStaff.username
        }));
        
        window.location.reload();
      }
    });
  }
});


