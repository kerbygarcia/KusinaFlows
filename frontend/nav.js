// Navigation system for all pages
// This file handles sidebar routing across the entire system


function go(id, page) {
  const el = document.getElementById(id);


  if (!el) return;


  el.addEventListener("click", () => {
    window.location.href = page;
  });
}


// dashboard (landing page)
go("dashboardBtn", "index.html");


// stocks page
go("stocksBtn", "stocks.html");


// reports page
go("reportBtn", "gen-reports.html");


// stock history placeholder
go("stockHistoryBtn", "#");


// logout (adjust later if you add login page)
go("logoutBtn", "index.html");

