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
// logoutBtn is handled separately to allow confirmation modal



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

    // 3. Style the Log Out Button Red & Bind Premium Confirmation Modal
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.style.color = "#ff6b6b";
        logoutBtn.style.fontWeight = "600";
        logoutBtn.style.transition = "all 0.3s ease";
        
        logoutBtn.addEventListener("mouseenter", () => {
            logoutBtn.style.background = "#ff4d4d";
            logoutBtn.style.color = "#ffffff";
        });
        logoutBtn.addEventListener("mouseleave", () => {
            logoutBtn.style.background = "";
            logoutBtn.style.color = "#ff6b6b";
        });

        logoutBtn.addEventListener("click", function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showLogoutModal();
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

// Premium Logout Confirmation Modal
function showLogoutModal() {
    // Create modal container (backdrop overlay)
    const modalOverlay = document.createElement("div");
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(59, 42, 26, 0.55);
        backdrop-filter: blur(6px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999;
        opacity: 0;
        transition: opacity 0.25s ease-out;
    `;

    // Create modal box (card container)
    const modalBox = document.createElement("div");
    modalBox.style.cssText = `
        background: #ffffff;
        width: 90%;
        max-width: 400px;
        padding: 32px 24px;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        text-align: center;
        transform: scale(0.9) translateY(10px);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-family: Arial, sans-serif;
    `;

    // Modal Inner HTML
    modalBox.innerHTML = `
        <div style="
            width: 64px;
            height: 64px;
            background: #fee2e2;
            color: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px auto;
            font-size: 28px;
        ">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
        </div>
        <h3 style="
            margin: 0 0 8px 0;
            font-size: 20px;
            color: #3b2a1a;
            font-weight: 700;
        ">Confirm Logout</h3>
        <p style="
            margin: 0 0 24px 0;
            font-size: 14px;
            color: #6b7280;
            line-height: 1.5;
        ">Are you sure you want to log out of KusinaFlow? You will need to log in again to access the dashboard.</p>
        <div style="
            display: flex;
            gap: 12px;
            justify-content: center;
        ">
            <button id="cancelLogoutBtn" style="
                flex: 1;
                padding: 12px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                background: #ffffff;
                color: #374151;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: background-color 0.2s ease, border-color 0.2s ease;
            ">Cancel</button>
            <button id="confirmLogoutBtn" style="
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 8px;
                background: #ef4444;
                color: #ffffff;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: background-color 0.2s ease;
            ">Log Out</button>
        </div>
    `;

    modalOverlay.appendChild(modalBox);
    document.body.appendChild(modalOverlay);

    // Trigger animations
    setTimeout(() => {
        modalOverlay.style.opacity = "1";
        modalBox.style.transform = "scale(1) translateY(0)";
    }, 10);

    // Event handlers
    const cancelBtn = modalBox.querySelector("#cancelLogoutBtn");
    const confirmBtn = modalBox.querySelector("#confirmLogoutBtn");

    const closeModal = () => {
        modalOverlay.style.opacity = "0";
        modalBox.style.transform = "scale(0.9) translateY(10px)";
        setTimeout(() => {
            modalOverlay.remove();
        }, 250);
    };

    cancelBtn.addEventListener("mouseenter", () => {
        cancelBtn.style.background = "#f3f4f6";
        cancelBtn.style.borderColor = "#9ca3af";
    });
    cancelBtn.addEventListener("mouseleave", () => {
        cancelBtn.style.background = "#ffffff";
        cancelBtn.style.borderColor = "#d1d5db";
    });
    cancelBtn.addEventListener("click", closeModal);

    confirmBtn.addEventListener("mouseenter", () => {
        confirmBtn.style.background = "#dc2626";
    });
    confirmBtn.addEventListener("mouseleave", () => {
        confirmBtn.style.background = "#ef4444";
    });

    confirmBtn.addEventListener("click", () => {
        localStorage.clear();
        sessionStorage.clear();

        // Determine login page url dynamically
        const currentLoc = window.location.href;
        const frontendIndex = currentLoc.indexOf('/frontend/');
        let loginUrl;
        if (frontendIndex !== -1) {
            const baseUrl = currentLoc.substring(0, frontendIndex + 10); // Includes '/frontend/'
            loginUrl = baseUrl + "login/login.html";
        } else {
            loginUrl = "../login/login.html";
        }
        window.location.href = loginUrl;
    });

    // Close when clicking overlay backdrop
    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}