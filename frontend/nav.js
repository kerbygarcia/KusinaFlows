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
go("logoutBtn", "index.html");

// Dynamic active state styling & User Profile card injection
document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname;
  let activeId = "";

  if (currentPath.includes("stocks.html")) {
    activeId = "stocksBtn";
  } else if (currentPath.includes("gen-reports.html")) {
    activeId = "reportBtn";
  } else if (currentPath.includes("stock-history.html")) {
    activeId = "stockHistoryBtn";
  } else {
    // Default to dashboard for index.html or root/directory routes
    activeId = "dashboardBtn";
  }

  const activeEl = document.getElementById(activeId);
  if (activeEl) {
    activeEl.classList.add("active");
  }

  // Inject user profile card in the sidebar dynamically
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  // Retrieve or set default current user
  let currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser) {
    currentUser = { name: "Chef Kiko", role: "Manager" };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
  }

  // Flexbox styling to push the card to the bottom of the sidebar
  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";
  sidebar.style.justifyContent = "space-between";

  const navEl = sidebar.querySelector("nav");
  if (navEl) {
    navEl.style.flex = "1";
    navEl.style.marginBottom = "30px";
  }

  // Create and append user card
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

  // Toggle user profile role
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


