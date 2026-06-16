using Microsoft.AspNetCore.Mvc;
using KusinaFlows.Models;
using KusinaFlows.Services;
using Npgsql;
using System.Data;

namespace KusinaFlows.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InventoryController : ControllerBase
    {
        private readonly DatabaseService _dbService;

        public InventoryController(DatabaseService dbService)
        {
            _dbService = dbService;
        }

        // --------------------------------------------------------------------
        // READ: Fetch database tracking rows with dynamic availability filtering
        // GET: api/inventory?includeUnavailable=true
        // --------------------------------------------------------------------
        [HttpGet]
        public async Task<IActionResult> GetAllInventory([FromQuery] bool includeUnavailable = false)
        {
            var items = new List<InventoryItem>();
            
            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();
                
                // Included PerformedBy and ApprovedBy in the core inventory feed select query
                string query = @"SELECT ""BatchID"", ""ItemID"", ""ItemName"", ""Category"", ""Price"", 
                                       ""Quantity"", ""Available"", ""UTDmonth"", ""UTDday"", ""UTDyear"", 
                                       ""DAmonth"", ""DAday"", ""DAyear"", ""PerformedBy"", ""ApprovedBy"", 
                                       ""Action"", ""TimeStamp"", ""Status""
                                FROM public.""ITEM"" ";

                if (!includeUnavailable)
                {
                    query += @"WHERE ""Available"" = true AND ""Quantity"" > 0 ";
                }

                query += @"ORDER BY ""ItemName"" ASC, ""BatchID"" DESC;";

                using (var cmd = new NpgsqlCommand(query, conn))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        items.Add(new InventoryItem
                        {
                            BatchID = reader.GetInt32(0),
                            ItemID = reader.GetInt32(1),
                            ItemName = reader.GetString(2),
                            Category = reader.GetString(3),
                            Price = reader.GetDecimal(4),
                            Quantity = reader.GetInt32(5),
                            Available = reader.GetBoolean(6),
                            UTDmonth = reader.GetInt32(7),
                            UTDday = reader.GetInt32(8),
                            UTDyear = reader.GetInt32(9),
                            DAmonth = reader.GetInt32(10),
                            DAday = reader.GetInt32(11),
                            DAyear = reader.GetInt32(12),
                            PerformedBy = reader.IsDBNull(13) ? "" : reader.GetString(13),
                            ApprovedBy = reader.IsDBNull(14) ? "" : reader.GetString(14),
                            Action = reader.IsDBNull(15) ? "" : reader.GetString(15),
                            TimeStamp = reader.IsDBNull(16) ? "" : reader.GetString(16),
                            Status = reader.IsDBNull(17) ? "" : reader.GetString(17)
                        });
                    }
                }
            }
            return Ok(items);
        }

        // --------------------------------------------------------------------
        // CREATE: Write a fresh item batch line row to Neon Postgres
        // POST: api/inventory/add
        // --------------------------------------------------------------------
        [HttpPost("add")]
        public async Task<IActionResult> AddNewBatch([FromBody] InventoryItem item)
        {
            if (item == null) return BadRequest("Invalid processing payload parameters.");

            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    await conn.OpenAsync();

                    string checkExistenceQuery = @"SELECT COUNT(1) FROM public.""ITEM"" WHERE ""ItemName"" = @ItemName;";
                    bool itemExists = false;
                    using (var cmdCheck = new NpgsqlCommand(checkExistenceQuery, conn))
                    {
                        cmdCheck.Parameters.AddWithValue("@ItemName", item.ItemName);
                        itemExists = Convert.ToInt32(await cmdCheck.ExecuteScalarAsync()) > 0;
                    }

                    if (item.ItemID <= 0)
                    {
                        string maxIdQuery = @"SELECT COALESCE(MAX(""ItemID""), 100) + 1 FROM public.""ITEM"";";
                        using (var cmdMax = new NpgsqlCommand(maxIdQuery, conn))
                        {
                            item.ItemID = Convert.ToInt32(await cmdMax.ExecuteScalarAsync());
                        }
                    }

                    string detectedAction = itemExists ? "Stock-In" : "Add Item";

                    DateTime utcNow = DateTime.UtcNow;
                    TimeZoneInfo phTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time"); 
                    DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, phTimeZone);

                    // FIXED: Explicitly mapping PerformedBy and ApprovedBy columns during SQL insertions
                    string insertQuery = @"
                        INSERT INTO public.""ITEM"" 
                        (""ItemID"", ""ItemName"", ""Category"", ""Price"", ""Quantity"", ""Available"", ""Status"",
                        ""UTDmonth"", ""UTDday"", ""UTDyear"", ""DAmonth"", ""DAday"", ""DAyear"", ""Action"", ""TimeStamp"", ""PerformedBy"", ""ApprovedBy"")
                        VALUES (@ItemID, @ItemName, @Category, @Price, @Quantity, @Available, @Status,
                                @UTDmonth, @UTDday, @UTDyear, @DAmonth, @DAday, @DAyear, @Action, @TimeStamp, @PerformedBy, @ApprovedBy);";

                    using (var cmd = new NpgsqlCommand(insertQuery, conn))
                    {
                        cmd.Parameters.AddWithValue("@ItemID", item.ItemID);
                        cmd.Parameters.AddWithValue("@ItemName", item.ItemName);
                        cmd.Parameters.AddWithValue("@Category", item.Category);
                        cmd.Parameters.AddWithValue("@Price", item.Price);
                        cmd.Parameters.AddWithValue("@Quantity", item.Quantity);
                        cmd.Parameters.AddWithValue("@Available", true);
                        cmd.Parameters.AddWithValue("@Status", string.IsNullOrEmpty(item.Status) ? "Active" : item.Status);
                        cmd.Parameters.AddWithValue("@UTDmonth", item.UTDmonth);
                        cmd.Parameters.AddWithValue("@UTDday", item.UTDday);
                        cmd.Parameters.AddWithValue("@UTDyear", item.UTDyear);
                        cmd.Parameters.AddWithValue("@DAmonth", item.DAmonth);
                        cmd.Parameters.AddWithValue("@DAday", item.DAday);
                        cmd.Parameters.AddWithValue("@DAyear", item.DAyear);
                        cmd.Parameters.AddWithValue("@Action", detectedAction);
                        cmd.Parameters.AddWithValue("@TimeStamp", phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff"));
                        cmd.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(item.PerformedBy) ? "System" : item.PerformedBy);
                        cmd.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(item.ApprovedBy) ? "N/A" : item.ApprovedBy);

                        await cmd.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Asset successfully saved to Neon cloud backend storage engine." });
            }
            catch (System.Exception ex)
            {
                System.Console.WriteLine($"[CRASH LOG - AddNewBatch]: {ex.Message}");
                return StatusCode(500, "Failed to write fresh entry row.");
            }
        }

        // --------------------------------------------------------------------
        // UPDATE: Modify properties inside a specific batch row line
        // PUT: api/inventory/update-full-batch
        // --------------------------------------------------------------------
        [HttpPut("update-full-batch")]
        public async Task<IActionResult> UpdateFullBatch([FromBody] InventoryItem updatedItem)
        {
            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();

                string updateQuery = @"
                    UPDATE public.""ITEM""
                    SET ""ItemName"" = @ItemName,
                        ""Category"" = @Category,
                        ""Price"" = @Price,
                        ""Quantity"" = @Quantity,
                        ""Available"" = @Available,
                        ""UTDmonth"" = @UTDmonth,
                        ""UTDday"" = @UTDday,
                        ""UTDyear"" = @UTDyear
                    WHERE ""BatchID"" = @BatchID;";

                using (var cmd = new NpgsqlCommand(updateQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@BatchID", updatedItem.BatchID);
                    cmd.Parameters.AddWithValue("@ItemName", updatedItem.ItemName);
                    cmd.Parameters.AddWithValue("@Category", updatedItem.Category);
                    cmd.Parameters.AddWithValue("@Price", updatedItem.Price);
                    cmd.Parameters.AddWithValue("@Quantity", updatedItem.Quantity);
                    cmd.Parameters.AddWithValue("@Available", updatedItem.Quantity > 0);
                    cmd.Parameters.AddWithValue("@UTDmonth", updatedItem.UTDmonth);
                    cmd.Parameters.AddWithValue("@UTDday", updatedItem.UTDday);
                    cmd.Parameters.AddWithValue("@UTDyear", updatedItem.UTDyear);

                    int rowsAffected = await cmd.ExecuteNonQueryAsync();
                    if (rowsAffected == 0) return NotFound("Target batch entity was not modified.");
                }
            }

            return Ok(new { message = "Batch modifications permanently captured." });
        }

        // --------------------------------------------------------------------
        // TRANSACTIONAL: Process targeted metric stock-out quantitative deductions
        // POST: api/inventory/stock-out-specific
        // --------------------------------------------------------------------
        [HttpPost("stock-out-specific")]
        public async Task<IActionResult> StockOutSpecific([FromBody] StockOutRequest request)
        {
            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    await conn.OpenAsync();

                    string selectQuery = @"SELECT ""Quantity"" FROM public.""ITEM"" WHERE ""BatchID"" = @BatchID;";
                    int currentQty = 0;

                    using (var cmdSelect = new NpgsqlCommand(selectQuery, conn))
                    {
                        cmdSelect.Parameters.AddWithValue("@BatchID", request.BatchID);
                        var result = await cmdSelect.ExecuteScalarAsync();
                        if (result == null) return NotFound(new { message = "Batch code target could not be found." });
                        currentQty = Convert.ToInt32(result);
                    }

                    if (currentQty < request.Quantity)
                    {
                        return BadRequest(new { message = $"Insufficient stock volume balance. Available: {currentQty}" });
                    }

                    int newQty = currentQty - request.Quantity;

                    DateTime utcNow = DateTime.UtcNow;
                    TimeZoneInfo phTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time");
                    DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, phTimeZone);

                    string updateQuery = @"
                        UPDATE public.""ITEM""
                        SET ""Quantity"" = @NewQty,
                            ""Available"" = @Available,
                            ""Action"" = 'Stock-Out',
                            ""TimeStamp"" = @TimeStamp,
                            ""PerformedBy"" = @PerformedBy,
                            ""ApprovedBy"" = @ApprovedBy
                        WHERE ""BatchID"" = @BatchID;";

                    using (var cmdUpdate = new NpgsqlCommand(updateQuery, conn))
                    {
                        cmdUpdate.Parameters.AddWithValue("@BatchID", request.BatchID);
                        cmdUpdate.Parameters.AddWithValue("@NewQty", newQty);
                        cmdUpdate.Parameters.AddWithValue("@Available", newQty > 0);
                        cmdUpdate.Parameters.AddWithValue("@TimeStamp", phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff"));
                        cmdUpdate.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(request.PerformedBy) ? "System" : request.PerformedBy);
                        cmdUpdate.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(request.ApprovedBy) ? "N/A" : request.ApprovedBy);

                        await cmdUpdate.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Quantitative database extraction completed safely." });
            }
            catch (System.Exception ex)
            {
                System.Console.WriteLine($"[CRASH LOG - StockOutSpecific]: {ex.Message}");
                return StatusCode(500, "Failed to apply quantitative deductions.");
            }
        }

        // --------------------------------------------------------------------
        // DELETE: Execute logical soft-delete via visibility status flags
        // DELETE: api/inventory/delete/{batchId}
        // --------------------------------------------------------------------
        [HttpDelete("delete/{batchId}")]
        public async Task<IActionResult> SoftDeleteBatch(int batchId)
        {
            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();

                string softDeleteQuery = @"
                    UPDATE public.""ITEM""
                    SET ""Available"" = false,
                        ""Quantity"" = 0
                    WHERE ""BatchID"" = @BatchID;";

                using (var cmd = new NpgsqlCommand(softDeleteQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@BatchID", batchId);
                    int rowsAffected = await cmd.ExecuteNonQueryAsync();
                    
                    if (rowsAffected == 0) 
                        return NotFound("No batch mapping records found for the execution context.");
                }
            }

            return Ok(new { message = "Batch soft-archived successfully." });
        }

        // --------------------------------------------------------------------
        // READ: Fetch all logging histories dynamically from primary table rows
        // GET: api/inventory/history
        // --------------------------------------------------------------------
        [HttpGet("history")]
        public async Task<IActionResult> GetStockHistoryLog()
        {
            var historyLogs = new List<object>();

            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();
                
                // FIXED: Explicitly selecting PerformedBy and ApprovedBy columns from the database
                string query = @"
                    SELECT ""TimeStamp"", ""ItemName"", ""Action"", ""Quantity"", ""PerformedBy"", ""ApprovedBy""
                    FROM public.""ITEM""
                    WHERE ""TimeStamp"" IS NOT NULL AND ""Action"" IS NOT NULL
                    ORDER BY ""BatchID"" DESC;";
                    
                using (var cmd = new NpgsqlCommand(query, conn))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        string rawTimeStamp = reader.IsDBNull(0) ? "" : reader.GetString(0);
                        
                        DateTime parsedDate;
                        if (!DateTime.TryParse(rawTimeStamp, out parsedDate))
                        {
                            parsedDate = DateTime.MinValue;
                        }

                        // FIXED: No longer hardcoding "-"! Reading true values directly from database lines
                        historyLogs.Add(new {
                            timeStamp = parsedDate,
                            itemName = reader.IsDBNull(1) ? "-" : reader.GetString(1),  
                            action = reader.IsDBNull(2) ? "-" : reader.GetString(2),    
                            quantity = reader.IsDBNull(3) ? 0 : reader.GetInt32(3),   
                            performedBy = reader.IsDBNull(4) ? "System" : reader.GetString(4),
                            approvedBy = reader.IsDBNull(5) ? "N/A" : reader.GetString(5)
                        });
                    }
                }
            }
            return Ok(historyLogs);
        }

        public class StockOutRequest
        {
            public int BatchID { get; set; }
            public int Quantity { get; set; }
            public string? PerformedBy { get; set; }
            public string? ApprovedBy { get; set; }
        }
    }
}