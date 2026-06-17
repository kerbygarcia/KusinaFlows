namespace KusinaFlows.Models
{
    public class StockOutDto
    {
        public int BatchID { get; set; }
        public int Quantity { get; set; }
        public string? PerformedBy { get; set; }
        public string? ApprovedBy { get; set; }
    }
}