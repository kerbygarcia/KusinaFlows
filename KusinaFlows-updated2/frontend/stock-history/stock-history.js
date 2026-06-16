// ============================================================================
// CONFIGURATION & GLOBAL STATE MANAGER
// ============================================================================
const API_BASE_URL = "http://localhost:5244/api"; 
let stockHistory = [];

// ============================================================================
// CORE DATA FETCH ROUTINE (READ FROM ENDPOINT)
// ============================================================================
async function fetchStockHistoryFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/inventory`);
        
        if (!response.ok) {
            throw new Error(`HTTP network error! Status: ${response.status}`);
        }

        const serverData = await response.json();
        
        // 🔍 DIAGNOSTIC LOG: This will show us the actual contents of your Postgres records!
        console.log("=== RAW API RESPONSE DATA ===");
        console.log(serverData);
        if (serverData.length > 0) {
            console.log("First item sample:", JSON.stringify(serverData[0], null, 2));
        }
        console.log("==============================");

        // Sort using safe fallbacks for the timestamp keys
        stockHistory = serverData.sort((a, b) => {
            const timeA = new Date(a.timeStamp || a.TimeStamp || 0);
            const timeB = new Date(b.timeStamp || b.TimeStamp || 0);
            return timeB - timeA;
        }); 
        
        renderHistory();
    } catch (error) {
        console.error("Critical log synchronization failure:", error);
        
        const tableBody = document.getElementById("historyTableBody");
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="color: #ff4757; text-align: center; font-weight: bold; padding: 20px;">
                        ⚠️ System Offline: Unable to sync log streams from database layer.<br>
                        <span style="font-size: 12px; font-weight: normal; color: #aaa;">Error: ${error.message}</span>
                    </td>
                </tr>`;
        }
    }
}

// ============================================================================
// DYNAMIC COMPONENT RENDER ENGINE (IN STOCK-HISTORY.JS)
// ============================================================================
function renderHistory() {
    const tableBody = document.getElementById("historyTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (stockHistory.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777; padding: 20px;">No stock activities recorded yet.</td></tr>`;
        return;
    }

    stockHistory.forEach(act => {
        const row = document.createElement("tr");

        // Parse timestamp string structure safely
        let displayTime = "N/A";
        const ts = act.timeStamp || act.TimeStamp || act.timestamp || act.TimeStampLog;
        if (ts) {
            // Replaces space with 'T' to ensure cross-browser parsing stability
            const dt = new Date(ts.replace(" ", "T"));
            if (!isNaN(dt.getTime())) {
                // Renders the MM/DD/YYYY baseline string, followed by the styled, smaller gray 12-hour AM/PM time text node
                displayTime = `${dt.toLocaleDateString("en-US")}<br><span style="font-size: 10px !important; color: #999 !important; font-weight: normal;">${dt.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}</span>`;
            }
        }

        // Action status resolution
        const currentAction = act.action || act.Action || act.status || act.Status || "Fresh Stock";
        let typeClass = "in-stock";
        if (currentAction.toLowerCase().includes("out")) typeClass = "low-stock";
        if (currentAction.toLowerCase().includes("add")) typeClass = "near-expiry";

        // Fallback properties lookups matching your schema names
        const performer = act.performedBy || act.PerformedBy || "System";
        const approver = act.approvedBy || act.ApprovedBy || "N/A";
        const itemName = act.itemName || act.ItemName || "Unknown";
        const quantity = act.quantity ?? act.Quantity ?? 0;

        row.innerHTML = `
            <td>${displayTime}</td>
            <td><strong>${itemName}</strong></td>
            <td><span class="${typeClass}" style="padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">${currentAction}</span></td>
            <td><strong>${quantity}</strong></td>
            <td>${performer}</td>
            <td>${approver}</td>
        `;

        tableBody.appendChild(row);
    });
}

// Lifecycle Initialization
window.addEventListener("focus", fetchStockHistoryFromServer);

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchStockHistoryFromServer);
} else {
    fetchStockHistoryFromServer();
}