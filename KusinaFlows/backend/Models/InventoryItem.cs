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
        public bool Available { get; set; } = true;
        
        // === ADD THIS NEW COLUMN MAPPING PROPERTY ===
        public string Status { get; set; } = "Active"; 

        public int UTDmonth { get; set; }
        public int UTDday { get; set; }
        public int UTDyear { get; set; }

        public int DAmonth { get; set; }
        public int DAday { get; set; }
        public int DAyear { get; set; }
    }
}