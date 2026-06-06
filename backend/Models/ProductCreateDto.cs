// Inside Controllers/InventoryController.cs namespace scope

public class FullBatchUpdateDTO
{
    // Ensure these properties match what JavaScript drops off
    public int BatchID { get; set; }
    public int ItemID { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public int UTDmonth { get; set; }
    public int UTDday { get; set; }
    public int UTDyear { get; set; }
}