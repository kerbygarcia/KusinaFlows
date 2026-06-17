namespace KusinaFlows.Models
{
    public class InventoryItem
    {
        public int BatchID { get; set; }
        public int ItemID { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Quantity { get; set; }
        public int UTD { get; set; }
        public bool Available { get; set; } = true;
        public int? PerformedBy_SC_ID { get; set; }
        public int? ApprovedBy_SC_ID { get; set; }
        public string Action { get; set; } = "Add Item";
        public string DateAdded { get; set; } = string.Empty;

        // Resolved display names (not stored in ITEM table, joined from STOCK CONTROLLER)
        public string PerformedBy { get; set; } = "System Auto";
        public string ApprovedBy { get; set; } = "N/A";
    }
}
