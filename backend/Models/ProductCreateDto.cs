namespace KusinaFlows.Models
{
    public class ProductCreateDTO
    {
        public int ItemID { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Quantity { get; set; }
        public int UTDmonth { get; set; }
        public int UTDday { get; set; }
        public int UTDyear { get; set; }
        public int DAmonth { get; set; }
        public int DAday { get; set; }
        public int DAyear { get; set; }
        
        // ADD THIS LINE HERE:
        public string Status { get; set; } = string.Empty;
    }
}