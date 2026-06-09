let inventory = JSON.parse(localStorage.getItem("inventory")) || [];


function getTotalQuantity(item) {
  return item.batches.reduce((sum, b) => sum + b.quantity, 0);
}


function calculateTotalValue() {
  let total = 0;


  inventory.forEach(item => {
    item.batches.forEach(batch => {
      total += batch.quantity * item.price;
    });
  });


  return total;
}


function getLowStockCount() {
  return inventory.filter(i => getTotalQuantity(i) <= 5).length;
}


function updateReports() {
  document.getElementById("totalItemsReport").textContent = inventory.length;


  document.getElementById("totalValueReport").textContent =
    "₱" + calculateTotalValue().toLocaleString("en-PH");


  document.getElementById("lowStockReport").textContent =
    getLowStockCount();
}


updateReports();

