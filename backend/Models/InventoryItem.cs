public class InventoryItem
{
    public int BatchID { get; set; }
    public int ItemID { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public bool Available { get; set; }
    public string? Status { get; set; }
    
    // ➕ Add these two properties to catch the incoming frontend date strings
    public string? UTDDateString { get; set; } 
    public string? DADateString { get; set; }  

    // Keep your database structural columns exactly as they are
    public int UTDmonth { get; set; }
    public int UTDday { get; set; }
    public int UTDyear { get; set; }
    public int DAmonth { get; set; }
    public int DAday { get; set; }
    public int DAyear { get; set; }
    
    public string? PerformedBy { get; set; }
    public string? ApprovedBy { get; set; }
    public string? Action { get; set; }
    public string? TimeStamp { get; set; }
}