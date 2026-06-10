using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using KusinaFlows.Models; 
using KusinaFlows.Services; 

namespace KusinaFlows.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InventoryController : ControllerBase
    {
        private readonly DatabaseService _databaseService;

        public InventoryController(DatabaseService databaseService)
        {
            _databaseService = databaseService ?? throw new ArgumentNullException(nameof(databaseService));
        }

        /// <summary>
        /// GET: api/inventory
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllInventory()
        {
            var inventoryList = new List<InventoryItem>();
            try
            {
                using (var connection = _databaseService.GetConnection())
                {
                    await connection.OpenAsync();
                    
                    // REMOVED: WHERE "Available" = true to fetch all historical entries
                    string sql = @"
                        SELECT ""BatchID"", ""ItemID"", ""ItemName"", ""Category"", ""Price"", ""Quantity"", 
                            ""UTDmonth"", ""UTDday"", ""UTDyear"", ""DAmonth"", ""DAday"", ""DAyear"", 
                            ""Status"", ""Available"" 
                        FROM ""ITEM"" 
                        ORDER BY ""ItemName"" ASC, ""DAyear"" ASC, ""DAmonth"" ASC, ""DAday"" ASC;";
                    
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            inventoryList.Add(new InventoryItem
                            {
                                BatchID = reader.GetInt32(0),
                                ItemID = reader.GetInt32(1),
                                ItemName = reader.GetString(2),
                                Category = reader.GetString(3),
                                Price = reader.GetDecimal(4),
                                Quantity = reader.GetInt32(5),
                                UTDmonth = reader.GetInt32(6),
                                UTDday = reader.GetInt32(7),
                                UTDyear = reader.GetInt32(8),
                                DAmonth = reader.GetInt32(9),
                                DAday = reader.GetInt32(10),
                                DAyear = reader.GetInt32(11),
                                Status = reader.GetString(12),
                                Available = reader.GetBoolean(13)
                            });
                        }
                    }
                }
                return Ok(inventoryList); 
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error reading tracking tables.", error = ex.Message });
            }
        }

        /// <summary>
        /// POST: api/inventory/add
        /// </summary>
        [HttpPost("add")]
        public async Task<IActionResult> AddProduct([FromBody] ProductCreateDTO dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.ItemName))
            {
                return BadRequest(new { message = "Invalid database data layout provided." });
            }

            try
            {
                using (var connection = _databaseService.GetConnection())
                {
                    await connection.OpenAsync();

                    string sql = @"
                        INSERT INTO ""ITEM"" (""ItemID"", ""ItemName"", ""Category"", ""Price"", ""Quantity"", 
                                            ""UTDmonth"", ""UTDday"", ""UTDyear"", ""DAmonth"", ""DAday"", ""DAyear"", 
                                            ""Status"", ""Available"") 
                        VALUES (@ItemID, @ItemName, @Category, @Price, @Quantity, 
                                @UTDmonth, @UTDday, @UTDyear, @DAmonth, @DAday, @DAyear, 
                                @Status, true);";
                    
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@ItemID", dto.ItemID);
                        cmd.Parameters.AddWithValue("@ItemName", dto.ItemName);
                        cmd.Parameters.AddWithValue("@Category", dto.Category);
                        cmd.Parameters.AddWithValue("@Price", dto.Price);
                        cmd.Parameters.AddWithValue("@Quantity", dto.Quantity);
                        cmd.Parameters.AddWithValue("@UTDmonth", dto.UTDmonth);
                        cmd.Parameters.AddWithValue("@UTDday", dto.UTDday);
                        cmd.Parameters.AddWithValue("@UTDyear", dto.UTDyear);
                        cmd.Parameters.AddWithValue("@DAmonth", dto.DAmonth);
                        cmd.Parameters.AddWithValue("@DAday", dto.DAday);
                        cmd.Parameters.AddWithValue("@DAyear", dto.DAyear);
                        cmd.Parameters.AddWithValue("@Status", dto.Status);

                        await cmd.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Item row saved successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error inside POST api/inventory/add: {ex.Message}");
                return StatusCode(500, new { message = "Failed to save item row.", error = ex.Message });
            }
        }

        /// <summary>
        /// PUT: api/inventory/update-full-batch
        /// Updates all editable parameters for a given batch row tracking record in the ITEM table
        /// </summary>
        [HttpPut("update-full-batch")]
        public async Task<IActionResult> UpdateFullBatch([FromBody] FullBatchUpdateDTO dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "Payload dataset empty or malformed." });
            }

            try
            {
                using (var connection = _databaseService.GetConnection())
                {
                    await connection.OpenAsync();
                    
                    // Double-quoted identifiers match PostgreSQL/Neon case sensitivity rules perfectly
                    string sql = @"
                        UPDATE ""ITEM"" 
                        SET ""ItemName"" = @ItemName, 
                            ""Category"" = @Category, 
                            ""Price"" = @Price, 
                            ""Quantity"" = @Quantity, 
                            ""UTDmonth"" = @UTDmonth, 
                            ""UTDday"" = @UTDday, 
                            ""UTDyear"" = @UTDyear
                        WHERE ""BatchID"" = @BatchID;";
                    
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@ItemName", dto.ItemName);
                        cmd.Parameters.AddWithValue("@Category", dto.Category);
                        cmd.Parameters.AddWithValue("@Price", dto.Price);
                        cmd.Parameters.AddWithValue("@Quantity", dto.Quantity);
                        cmd.Parameters.AddWithValue("@UTDmonth", dto.UTDmonth);
                        cmd.Parameters.AddWithValue("@UTDday", dto.UTDday);
                        cmd.Parameters.AddWithValue("@UTDyear", dto.UTDyear);
                        cmd.Parameters.AddWithValue("@BatchID", dto.BatchID);

                        int rowsAffected = await cmd.ExecuteNonQueryAsync();
                        
                        if (rowsAffected == 0)
                        {
                            return NotFound(new { message = $"Batch ID {dto.BatchID} was not found in the database." });
                        }
                    }
                }
                return Ok(new { message = "Batch details updated successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during update-full-batch execution: {ex.Message}");
                return StatusCode(500, new { message = "Database execution error.", error = ex.Message });
            }
        }
        /// <summary>
        /// DELETE: api/inventory/delete/{batchId}
        /// Soft-deletes a specific inventory record by setting Available to false
        /// </summary>
        [HttpDelete("delete/{batchId}")]
        public async Task<IActionResult> DeleteBatch(int batchId)
        {
            try
            {
                using (var connection = _databaseService.GetConnection())
                {
                    await connection.OpenAsync();

                    // Flags the specific record as unavailable so it disappears from the dashboard view
                    string sql = @"UPDATE ""ITEM"" SET ""Available"" = false WHERE ""BatchID"" = @BatchID;";
                    
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@BatchID", batchId);
                        int rowsAffected = await cmd.ExecuteNonQueryAsync();

                        if (rowsAffected == 0)
                        {
                            return NotFound(new { message = "Hindi nahanap ang itinakdang Batch ID sa database." });
                        }
                    }
                }

                return Ok(new { message = "Batch row marked as unavailable successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error inside DELETE api/inventory/delete: {ex.Message}");
                return StatusCode(500, new { message = "Failed to remove item row data.", error = ex.Message });
            }
        }

        [HttpPost("stock-out-specific")]
        public async Task<IActionResult> StockOutSpecific([FromBody] SpecificBatchStockOutDTO dto)
        {
            if (dto == null || dto.QuantityToDeduct <= 0)
            {
                return BadRequest(new { message = "Mangyaring maglagay ng tamang dami ng ibabawas." });
            }

            try
            {
                using (var connection = _databaseService.GetConnection())
                {
                    await connection.OpenAsync();

                    // 1. Fetch the targeted batch row directly to verify remaining stock
                    string selectSql = @"
                        SELECT ""Quantity"" FROM ""ITEM"" 
                        WHERE ""BatchID"" = @BatchID AND ""Available"" = true;";

                    int currentQuantity = 0;

                    using (var selectCmd = new NpgsqlCommand(selectSql, connection))
                    {
                        selectCmd.Parameters.AddWithValue("@BatchID", dto.BatchID);
                        var result = await selectCmd.ExecuteScalarAsync();

                        if (result == null)
                        {
                            return NotFound(new { message = "Hindi nahanap ang piniling batch o hindi na ito available." });
                        }
                        currentQuantity = Convert.ToInt32(result);
                    }

                    // 2. Structural safety verification check
                    if (currentQuantity < dto.QuantityToDeduct)
                    {
                        return BadRequest(new { message = $"Kulang ang stock sa batch na ito. Mayroon lamang {currentQuantity} na natitirang marka." });
                    }

                    // 3. Deduct stock and dynamically flip 'Available' to false if it hits zero
                    int newQuantity = currentQuantity - dto.QuantityToDeduct;
                    bool isAvailable = newQuantity > 0;

                    string updateSql = @"
                        UPDATE ""ITEM"" 
                        SET ""Quantity"" = @Quantity,
                            ""Available"" = @Available
                        WHERE ""BatchID"" = @BatchID;";

                    using (var updateCmd = new NpgsqlCommand(updateSql, connection))
                    {
                        updateCmd.Parameters.AddWithValue("@Quantity", newQuantity);
                        updateCmd.Parameters.AddWithValue("@Available", isAvailable);
                        updateCmd.Parameters.AddWithValue("@BatchID", dto.BatchID);

                        await updateCmd.ExecuteNonQueryAsync();
                    }

                    return Ok(new { message = "Matagumpay na nabawasan ang stock mula sa piniling batch!" });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Specific Stock-Out Failure: {ex.Message}");
                return StatusCode(500, new { message = "Nagkaroon ng error sa pagbawas ng stock.", error = ex.Message });
            }
        }
    }

        public class FullBatchUpdateDTO
    {
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

    public class SpecificBatchStockOutDTO
    {
        public int BatchID { get; set; }
        public int QuantityToDeduct { get; set; }
    }
}       