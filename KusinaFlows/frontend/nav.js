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

// Exact route mapping matching your folder architecture
go("dashboardBtn", "dashboard/dashboard.html"); 
go("stocksBtn", "stocks/stocks.html");
go("reportBtn", "gen-reports/gen-reports.html");
go("stockHistoryBtn", "stock-history/stock-history.html");
go("logoutBtn", "login/login.html");

// Dynamic active state styling & User Profile card injection
document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname;
  let activeId = "";

  if (currentPath.includes("/stocks/")) {
    activeId = "stocksBtn";
  } else if (currentPath.includes("/gen-reports/")) {
    activeId = "reportBtn";
  } else if (currentPath.includes("/stock-history/")) {
    activeId = "stockHistoryBtn";
  } else if (currentPath.includes("/dashboard/")) {
    activeId = "dashboardBtn";
  }

  const activeEl = document.getElementById(activeId);
  if (activeEl) {
    activeEl.classList.add("active");
  }

  // Inject user profile card in the sidebar dynamically
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  let currentUser = JSON.parse(localStorage.getItem("currentUser")) || { name: "Chef Kiko", role: "Manager" };

  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";
  sidebar.style.justifyContent = "space-between";

  const navEl = sidebar.querySelector("nav");
  if (navEl) {
    navEl.style.flex = "1";
    navEl.style.marginBottom = "30px";
  }

  const card = document.createElement("div");
  card.className = "user-card";
  card.style.padding = "12px";
  card.style.background = "rgba(255,255,255,0.06)";
  card.style.borderRadius = "8px";
  card.style.border = "1px solid rgba(255,255,255,0.1)";
  
  card.innerHTML = `
    <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px;">Logged In As:</div>
    <div style="font-weight: bold; font-size: 13px; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${currentUser.name}</div>
    <div style="font-size: 10px; color: var(--primary); margin-top: 1px; font-weight: bold; text-transform: uppercase;">${currentUser.role}</div>
    <button id="btnSwitchRole" style="margin-top: 8px; padding: 5px; font-size: 10px; width: 100%; background: #4a3828; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;">
      Switch to ${currentUser.role === "Manager" ? "Employee (Alice)" : "Manager (Chef Kiko)"}
    </button>
  `;

  sidebar.appendChild(card);

  const switchBtn = document.getElementById("btnSwitchRole");
  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      if (currentUser.role === "Manager") {
        localStorage.setItem("currentUser", JSON.stringify({ name: "Alice", role: "Employee" }));
      } else {
        localStorage.setItem("currentUser", JSON.stringify({ name: "Chef Kiko", role: "Manager" }));
      }
      window.location.reload();
    });
  }
});