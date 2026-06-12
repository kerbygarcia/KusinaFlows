using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json.Serialization;
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
        /// POST: api/inventory/stock-out-specific
        /// Deducts quantity from a specific target batch and marks it unavailable if it reaches 0
        /// </summary>
        [HttpPost("stock-out-specific")]
        public async Task<IActionResult> StockOutSpecific([FromBody] SpecificStockOutDTO dto)
        {
            if (dto == null || dto.BatchID <= 0 || dto.Quantity <= 0)
            {
                return BadRequest(new { message = "Invalid transaction metrics supplied." });
            }

            try
            {
                using (var connection = _databaseService.GetConnection())
                {
                    await connection.OpenAsync();

                    string sql = @"
                        UPDATE ""ITEM""
                        SET ""Quantity"" = ""Quantity"" - @Quantity,
                            ""Available"" = CASE WHEN (""Quantity"" - @Quantity) <= 0 THEN false ELSE ""Available"" END
                        WHERE ""BatchID"" = @BatchID AND ""Available"" = true AND ""Quantity"" >= @Quantity;";

                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@Quantity", dto.Quantity);
                        cmd.Parameters.AddWithValue("@BatchID", dto.BatchID);

                        int rowsAffected = await cmd.ExecuteNonQueryAsync();

                        if (rowsAffected == 0)
                        {
                            return BadRequest(new { message = "Transaction rejected. Batch may not exist, is already archived, or lacks sufficient quantities." });
                        }
                    }
                }

                return Ok(new { message = "Stock successfully deducted from selected batch." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during stock-out-specific execution: {ex.Message}");
                return StatusCode(500, new { message = "Database processing failure.", error = ex.Message });
            }
        }

        /// <summary>
        /// PUT: api/inventory/update-full-batch
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
        /// </summary>
        [HttpDelete("delete/{batchId}")]
        public async Task<IActionResult> DeleteBatch(int batchId)
        {
            try
            {
                using (var connection = _databaseService.GetConnection())
                {
                    await connection.OpenAsync();

                    string sql = @"UPDATE ""ITEM"" SET ""Available"" = false WHERE ""BatchID"" = @BatchID;";
                    
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@BatchID", batchId);
                        int rowsAffected = await cmd.ExecuteNonQueryAsync();

                        if (rowsAffected == 0)
                        {
                            return NotFound(new { message = "Target Batch ID was not found in the database." });
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
    }

    // --- DATA TRANSFER OBJECTS (DTOs) ---

    public class ProductCreateDTO
    {
        [JsonPropertyName("itemID")]
        public int ItemID { get; set; }

        [JsonPropertyName("itemName")]
        public string ItemName { get; set; } = string.Empty;

        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("price")]
        public decimal Price { get; set; }

        [JsonPropertyName("quantity")]
        public int Quantity { get; set; }

        [JsonPropertyName("utDmonth")]
        public int UTDmonth { get; set; }

        [JsonPropertyName("utDday")]
        public int UTDday { get; set; }

        [JsonPropertyName("utDyear")]
        public int UTDyear { get; set; }

        [JsonPropertyName("dAmonth")]
        public int DAmonth { get; set; }

        [JsonPropertyName("dAday")]
        public int DAday { get; set; }

        [JsonPropertyName("dAyear")]
        public int DAyear { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;
    }

    public class FullBatchUpdateDTO
    {
        [JsonPropertyName("batchID")]
        public int BatchID { get; set; }

        [JsonPropertyName("itemID")]
        public int ItemID { get; set; }

        [JsonPropertyName("itemName")]
        public string ItemName { get; set; } = string.Empty;

        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("price")]
        public decimal Price { get; set; }

        [JsonPropertyName("quantity")]
        public int Quantity { get; set; }

        [JsonPropertyName("utDmonth")]
        public int UTDmonth { get; set; }

        [JsonPropertyName("utDday")]
        public int UTDday { get; set; }

        [JsonPropertyName("utDyear")]
        public int UTDyear { get; set; }
    }

    public class SpecificStockOutDTO
    {
        [JsonPropertyName("batchID")]
        public int BatchID { get; set; }
        
        [JsonPropertyName("quantity")]
        public int Quantity { get; set; }
    }
}