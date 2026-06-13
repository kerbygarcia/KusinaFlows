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
        const response = await fetch(`${API_BASE_URL}/inventory/history`);
        
        if (!response.ok) {
            throw new Error(`HTTP network error! Status: ${response.status}`);
        }

        const serverData = await response.json();
        stockHistory = serverData; // Assign server arrays directly
        
        renderHistory();
        console.log("Telemetry logs synchronized successfully:", stockHistory);
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
// DYNAMIC COMPONENT RENDER ENGINE
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

        // Color coding transaction strings based on your new "action" property values
        let typeClass = "";
        const currentAction = act.action || "";

        if (currentAction === "Stock-In") {
            typeClass = "in-stock";
        } else if (currentAction === "Stock-Out") {
            typeClass = "low-stock";
        } else {
            typeClass = "near-expiry"; // Orange color styling fallback for modifications
        }

        // Format your unified timestamp seamlessly for your table display column
        // Checks if backend formatted it as a clean local string, handles fallbacks gracefully
        let displayTime = "-";
        if (act.timeStamp) {
            const dt = new Date(act.timeStamp);
            // Outputs clean formatting: "MM/DD/YYYY hh:mm AM/PM"
            displayTime = `${dt.toLocaleDateString("en-US")} <span style="font-size: 11px; color: #888; margin-left: 5px;">${dt.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}</span>`;
        }

        // Personnel tracking parameter placeholders (Ignored for now)
        const user = act.user || "-";
        const approvedBy = act.approvedBy || "-";

        row.innerHTML = `
            <td>${displayTime}</td>
            <td><strong>${act.itemName}</strong></td>
            <td><span class="${typeClass}" style="padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">${currentAction}</span></td>
            <td><strong>${act.quantity}</strong></td>
            <td>${user}</td>
            <td>${approvedBy}</td>
        `;

        tableBody.appendChild(row);
    });
}

// ============================================================================
// LIFECYCLE ROUTINE REGISTRATIONS
// ============================================================================
window.addEventListener("focus", fetchStockHistoryFromServer);

// Bootstrapping engine initialization
document.addEventListener("DOMContentLoaded", fetchStockHistoryFromServer);