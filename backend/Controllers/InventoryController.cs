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
                
                string query = @"SELECT ""BatchID"", ""ItemID"", ""ItemName"", ""Category"", ""Price"", 
                                       ""Quantity"", ""Available"", ""UTDmonth"", ""UTDday"", ""UTDyear"", 
                                       ""DAmonth"", ""DAday"", ""DAyear"", ""PerformedBy"", ""ApprovedBy"", 
                                       ""Action"", ""TimeStamp"", ""Status""
                                FROM public.""ITEM"" ";

                if (!includeUnavailable)
                {
                    query += @"WHERE ""Available"" = true ";
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
        // CREATE: Write a fresh item batch line row + Auto-Unarchive + History Log
        // POST: api/inventory/add
        // --------------------------------------------------------------------
        [HttpPost("add")]
        public async Task<IActionResult> AddNewBatch([FromBody] InventoryItem item)
        {
            if (item == null) return BadRequest("Invalid processing payload parameters.");

            // 🔄 Parse Expiration/Up-To-Date Date (UTD)
            if (!string.IsNullOrEmpty(item.UTDDateString) && DateTime.TryParse(item.UTDDateString, out DateTime utdDate))
            {
                item.UTDmonth = utdDate.Month;
                item.UTDday = utdDate.Day;
                item.UTDyear = utdDate.Year;
            }

            // 🔄 Parse Date Added (DA) - Default to Today if the frontend didn't supply one
            if (!string.IsNullOrEmpty(item.DADateString) && DateTime.TryParse(item.DADateString, out DateTime daDate))
            {
                item.DAmonth = daDate.Month;
                item.DAday = daDate.Day;
                item.DAyear = daDate.Year;
            }
            else
            {
                // Fallback to current PH time if empty
                DateTime phNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time"));
                item.DAmonth = phNow.Month;
                item.DAday = phNow.Day;
                item.DAyear = phNow.Year;
            }

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

                    if (itemExists && item.Quantity > 0)
                    {
                        string unarchiveQuery = @"UPDATE public.""ITEM"" SET ""Available"" = true WHERE ""ItemName"" = @ItemName;";
                        using (var cmdUnarchive = new NpgsqlCommand(unarchiveQuery, conn))
                        {
                            cmdUnarchive.Parameters.AddWithValue("@ItemName", item.ItemName);
                            await cmdUnarchive.ExecuteNonQueryAsync();
                        }
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
                    string customFormattedDate = phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

                    // Grab the newly generated BatchID using RETURNING clause
                    string insertQuery = @"
                        INSERT INTO public.""ITEM"" 
                        (""ItemID"", ""ItemName"", ""Category"", ""Price"", ""Quantity"", ""Available"", ""Status"",
                        ""UTDmonth"", ""UTDday"", ""UTDyear"", ""DAmonth"", ""DAday"", ""DAyear"", ""Action"", ""TimeStamp"", ""PerformedBy"", ""ApprovedBy"")
                        VALUES (@ItemID, @ItemName, @Category, @Price, @Quantity, @Available, @Status,
                                @UTDmonth, @UTDday, @UTDyear, @DAmonth, @DAday, @DAyear, @Action, @TimeStamp, @PerformedBy, @ApprovedBy)
                        RETURNING ""BatchID"";";

                    int generatedBatchId = 0;

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
                        cmd.Parameters.AddWithValue("@TimeStamp", customFormattedDate);
                        cmd.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(item.PerformedBy) ? "System" : item.PerformedBy);
                        cmd.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(item.ApprovedBy) ? "N/A" : item.ApprovedBy);

                        generatedBatchId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                    }

                    // Map the batch identifier directly into your tracking column "SH_ID"
                    // 🔄 Let Postgres handle "SH_ID" automatically. We insert into the tracking column instead (e.g., ""BatchID"")
                    // 🔄 Added OVERRIDING SYSTEM VALUE so Postgres allows manual insertion into an ALWAYS identity column
                    string historyQuery = @"
                        INSERT INTO public.""STOCK HISTORY"" (""SH_ID"", ""Quantity"", ""ItemName"", ""PerformedBy"", ""ApprovedBy"", ""Type"", ""DateTime"")
                        OVERRIDING SYSTEM VALUE
                        VALUES (@SH_ID, @Quantity, @ItemName, @PerformedBy, @ApprovedBy, @Type, @DateTime);";

                    using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                    {
                        cmdHistory.Parameters.AddWithValue("@SH_ID", generatedBatchId); // Links directly to the Item's BatchID
                        cmdHistory.Parameters.AddWithValue("@Quantity", item.Quantity);
                        cmdHistory.Parameters.AddWithValue("@ItemName", item.ItemName);
                        cmdHistory.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(item.PerformedBy) ? "System" : item.PerformedBy);
                        cmdHistory.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(item.ApprovedBy) ? "N/A" : item.ApprovedBy);
                        cmdHistory.Parameters.AddWithValue("@Type", detectedAction);
                        cmdHistory.Parameters.AddWithValue("@DateTime", customFormattedDate);
                        
                        await cmdHistory.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Asset successfully saved and tracked." });
            }
            catch (System.Exception ex)
            {
                System.Console.WriteLine($"[CRASH LOG - AddNewBatch]: {ex.Message}");
                return StatusCode(500, "Failed to write batch entry row.");
            }
        }

        // --------------------------------------------------------------------
        // UPDATE: Modify properties inside a batch row + Log to History
        // PUT: api/inventory/update-full-batch
        // --------------------------------------------------------------------
        [HttpPut("update-full-batch")]
        public async Task<IActionResult> UpdateFullBatch([FromBody] InventoryItem updatedItem)
        {
            try
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
                        cmd.Parameters.AddWithValue("@Available", true); 
                        cmd.Parameters.AddWithValue("@UTDmonth", updatedItem.UTDmonth);
                        cmd.Parameters.AddWithValue("@UTDday", updatedItem.UTDday);
                        cmd.Parameters.AddWithValue("@UTDyear", updatedItem.UTDyear);

                        int rowsAffected = await cmd.ExecuteNonQueryAsync();
                        if (rowsAffected == 0) return NotFound("Target batch entity was not modified.");
                    }

                    DateTime utcNow = DateTime.UtcNow;
                    TimeZoneInfo phTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time");
                    DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, phTimeZone);

                    string historyQuery = @"
                        INSERT INTO public.""STOCK HISTORY"" (""SH_ID"", ""Quantity"", ""ItemName"", ""PerformedBy"", ""ApprovedBy"", ""Type"", ""DateTime"")
                        VALUES (@SH_ID, @Quantity, @ItemName, @PerformedBy, @ApprovedBy, @Type, @DateTime);";

                    using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                    {
                        cmdHistory.Parameters.AddWithValue("@SH_ID", updatedItem.BatchID);
                        cmdHistory.Parameters.AddWithValue("@Quantity", updatedItem.Quantity);
                        cmdHistory.Parameters.AddWithValue("@ItemName", updatedItem.ItemName);
                        cmdHistory.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(updatedItem.PerformedBy) ? "System" : updatedItem.PerformedBy);
                        cmdHistory.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(updatedItem.ApprovedBy) ? "N/A" : updatedItem.ApprovedBy);
                        cmdHistory.Parameters.AddWithValue("@Type", "Edit Batch");
                        cmdHistory.Parameters.AddWithValue("@DateTime", phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff"));
                        await cmdHistory.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Batch modifications permanently captured." });
            }
            catch (System.Exception ex)
            {
                System.Console.WriteLine($"[CRASH LOG - UpdateFullBatch]: {ex.Message}");
                return StatusCode(500, "Failed to complete edit tracking save operation.");
            }
        }

        // --------------------------------------------------------------------
        // TRANSACTIONAL: Process stock-out operations + Log to History
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

                    string selectQuery = @"SELECT ""Quantity"", ""ItemName"" FROM public.""ITEM"" WHERE ""BatchID"" = @BatchID;";
                    int currentQty = 0;
                    string itemName = "";

                    using (var cmdSelect = new NpgsqlCommand(selectQuery, conn))
                    {
                        cmdSelect.Parameters.AddWithValue("@BatchID", request.BatchID);
                        using (var reader = await cmdSelect.ExecuteReaderAsync())
                        {
                            if (!await reader.ReadAsync()) return NotFound(new { message = "Batch code target could not be found." });
                            currentQty = reader.GetInt32(0);
                            itemName = reader.GetString(1);
                        }
                    }

                    if (currentQty < request.Quantity)
                    {
                        return BadRequest(new { message = $"Insufficient stock volume balance. Available: {currentQty}" });
                    }

                    int newQty = currentQty - request.Quantity;

                    DateTime utcNow = DateTime.UtcNow;
                    TimeZoneInfo phTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time");
                    DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, phTimeZone);
                    string customFormattedDate = phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

                    string updateQuery = @"
                        UPDATE public.""ITEM""
                        SET ""Quantity"" = @NewQty,
                            ""Available"" = true,
                            ""Action"" = 'Stock-Out',
                            ""TimeStamp"" = @TimeStamp,
                            ""PerformedBy"" = @PerformedBy,
                            ""ApprovedBy"" = @ApprovedBy
                        WHERE ""BatchID"" = @BatchID;";

                    using (var cmdUpdate = new NpgsqlCommand(updateQuery, conn))
                    {
                        cmdUpdate.Parameters.AddWithValue("@BatchID", request.BatchID);
                        cmdUpdate.Parameters.AddWithValue("@NewQty", newQty);
                        cmdUpdate.Parameters.AddWithValue("@TimeStamp", customFormattedDate);
                        cmdUpdate.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(request.PerformedBy) ? "System" : request.PerformedBy);
                        cmdUpdate.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(request.ApprovedBy) ? "N/A" : request.ApprovedBy);
                        await cmdUpdate.ExecuteNonQueryAsync();
                    }

                    string historyQuery = @"
                        INSERT INTO public.""STOCK HISTORY"" (""SH_ID"", ""Quantity"", ""ItemName"", ""PerformedBy"", ""ApprovedBy"", ""Type"", ""DateTime"")
                        VALUES (@SH_ID, @Quantity, @ItemName, @PerformedBy, @ApprovedBy, @Type, @DateTime);";

                    using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                    {
                        cmdHistory.Parameters.AddWithValue("@SH_ID", request.BatchID); 
                        cmdHistory.Parameters.AddWithValue("@Quantity", request.Quantity); 
                        cmdHistory.Parameters.AddWithValue("@ItemName", itemName);
                        cmdHistory.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(request.PerformedBy) ? "System" : request.PerformedBy);
                        cmdHistory.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(request.ApprovedBy) ? "N/A" : request.ApprovedBy);
                        cmdHistory.Parameters.AddWithValue("@Type", "Stock-Out");
                        cmdHistory.Parameters.AddWithValue("@DateTime", customFormattedDate);
                        await cmdHistory.ExecuteNonQueryAsync();
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
        // DELETE: Execute logical soft-delete + Log to History
        // DELETE: api/inventory/delete/{batchId}
        // --------------------------------------------------------------------
        [HttpDelete("delete/{batchId}")]
        public async Task<IActionResult> SoftDeleteBatch(int batchId, [FromQuery] string? performedBy, [FromQuery] string? approvedBy)
        {
            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    await conn.OpenAsync();

                    string selectQuery = @"SELECT ""ItemName"", ""Quantity"" FROM public.""ITEM"" WHERE ""BatchID"" = @BatchID;";
                    string ItemName = "";
                    int Quantity = 0;

                    using (var cmdSelect = new NpgsqlCommand(selectQuery, conn))
                    {
                        cmdSelect.Parameters.AddWithValue("@BatchID", batchId);
                        using (var reader = await cmdSelect.ExecuteReaderAsync())
                        {
                            if (!await reader.ReadAsync()) return NotFound(new { message = "Target batch code could not be found." });
                            ItemName = reader.GetString(0);
                            Quantity = reader.GetInt32(1);
                        }
                    }

                    string updateQuery = @"UPDATE public.""ITEM"" SET ""Available"" = false, ""Action"" = 'Delete Batch' WHERE ""BatchID"" = @BatchID;";
                    using (var cmdUpdate = new NpgsqlCommand(updateQuery, conn))
                    {
                        cmdUpdate.Parameters.AddWithValue("@BatchID", batchId);
                        await cmdUpdate.ExecuteNonQueryAsync();
                    }

                    DateTime utcNow = DateTime.UtcNow;
                    TimeZoneInfo phTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time");
                    DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, phTimeZone);
                    string customFormattedDate = phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

                    string historyQuery = @"
                        INSERT INTO public.""STOCK HISTORY"" (""SH_ID"", ""Quantity"", ""ItemName"", ""PerformedBy"", ""ApprovedBy"", ""Type"", ""DateTime"")
                        VALUES (@SH_ID, @Quantity, @ItemName, @PerformedBy, @ApprovedBy, @Type, @DateTime);";

                    using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                    {
                        cmdHistory.Parameters.AddWithValue("@SH_ID", batchId);
                        cmdHistory.Parameters.AddWithValue("@Quantity", Quantity);
                        cmdHistory.Parameters.AddWithValue("@ItemName", ItemName);
                        cmdHistory.Parameters.AddWithValue("@PerformedBy", string.IsNullOrEmpty(performedBy) ? "System Auto" : performedBy);
                        cmdHistory.Parameters.AddWithValue("@ApprovedBy", string.IsNullOrEmpty(approvedBy) ? "N/A" : approvedBy);
                        cmdHistory.Parameters.AddWithValue("@Type", "Delete Batch");
                        cmdHistory.Parameters.AddWithValue("@DateTime", customFormattedDate);
                        await cmdHistory.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Batch soft-archived and historical log captured securely." });
            }
            catch (System.Exception ex)
            {
                System.Console.WriteLine($"[CRASH LOG - SoftDeleteBatch]: {ex.Message}");
                return StatusCode(500, "Failed to apply soft-deletion and append audit state.");
            }
        }

        // --------------------------------------------------------------------
        // READ: Fetch all logging histories directly from STOCK HISTORY table
        // GET: api/inventory/history
        // --------------------------------------------------------------------
        [HttpGet("history")]
        public async Task<IActionResult> GetStockHistoryLog()
        {
            var historyLogs = new List<object>();

            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();
                
                string query = @"
                    SELECT ""DateTime"", ""ItemName"", ""Type"", ""Quantity"", ""PerformedBy"", ""ApprovedBy""
                    FROM public.""STOCK HISTORY""
                    ORDER BY ""SH_ID"" DESC;";
                    
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