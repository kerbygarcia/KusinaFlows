// Navigation system for all pages inside KusinaFlow
function go(id, folderAndPage) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("click", () => {
    // 1. Get the base URL path up to the current folder location
    const currentLoc = window.location.href;
    
    // 2. Safely find the 'frontend/' position in the URL
    const frontendIndex = currentLoc.indexOf('/frontend/');
    
    if (frontendIndex !== -1) {
      // Create a clean path starting from the frontend folder base root
      const baseUrl = currentLoc.substring(0, frontendIndex + 10); // Includes '/frontend/'
      window.location.href = baseUrl + folderAndPage;
    } else {
      // Fallback: If running without a server (file:/// protocol directly)
      window.location.href = "../" + folderAndPage;
    }
  });
}

// [Keep your existing go() function definitions up here...]

// ============================================================================
// EXACT ROUTE MAPPING ARCHITECTURE
// ============================================================================
go("dashboardBtn", "dashboard/dashboard.html"); 
go("stocksBtn", "stocks/stocks.html");
go("reportBtn", "gen-reports/gen-reports.html");
go("stockHistoryBtn", "stock-history/stock-history.html");
go("staffManagementBtn", "staff-management/staff-management.html"); // <--- ADDED: Maps sidebar clicks to your staff folder
go("logoutBtn", "login/login.html");


// Dynamic active state styling & User Profile card injection
document.addEventListener("DOMContentLoaded", () => {
    // 1. Retrieve and Parse Active Session Data
    const sessionData = localStorage.getItem("currentUser");
    if (!sessionData) {
        // Adjust this path to target the login folder explicitly
        window.location.href = "/KusinaFlows/frontend/login/login.html"; 
        return;
    }
    const user = JSON.parse(sessionData);

    // 2. Inject Dynamic User Profile Plate into the Sidebar Bottom Arena
    const sidebarNav = document.querySelector(".sidebar nav");
    if (sidebarNav) {
        // Create user display plate element
        const userProfilePlate = document.createElement("div");
        userProfilePlate.style.cssText = `
            margin-top: auto;
            padding: 15px;
            border-top: 1px solid rgba(255,255,255,0.15);
            display: flex;
            flex-direction: column;
            gap: 5px;
            color: #fff;
            font-family: sans-serif;
        `;
        
        userProfilePlate.innerHTML = `
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #bda38a;">Logged In As</div>
            <div style="font-weight: bold; font-size: 14px;">${user.firstName} ${user.lastName}</div>
            <div style="font-size: 12px; font-style: italic; color: #ccc;">${user.position}</div>
        `;
        sidebarNav.appendChild(userProfilePlate);
    }

    // 3. Style the Log Out Button Red
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function(event) {
            event.preventDefault();
            
            const userConfirmed = confirm("Are you sure you want to log out?");

            if (userConfirmed){
                localStorage.clear(); // Flushes all session tracking data keys simultaneously
            
                // Target your absolute server login page placement directly:
                window.location.href = "/KusinaFlows/frontend/login/login.html";
            }
        });
    }

    // 4. Enforce Structural Privilege Limitations Rules
    const staffManagementMenuItem = document.getElementById("staffManagementBtn");
    
    if (user.position === "Staff") {
        // Rule: Staff cannot view Staff Management at all
        if (staffManagementMenuItem) {
            staffManagementMenuItem.style.display = "none";
        }
        
        // If a Staff member tries to manually type the URL path into the address bar, boot them out
        if (window.location.href.includes("staff-management.html")) {
            alert("Access Denied: You do not possess structural clearance to view this directory node.");
            window.location.href = "../dashboard/dashboard.html";
        }
    }
});