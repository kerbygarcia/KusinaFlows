public class StockHistory
{
    public int SH_ID { get; set; }
    public int Quantity { get; set; }
    public string? ItemName { get; set; }
    public string? PerformedBy { get; set; }
    public string? ApprovedBy { get; set; }
    public string? Type { get; set; } // "Add Item", "Stock-In", "Stock-Out", etc.
    public string? DateTime { get; set; } // Stored as string matching your schema
}