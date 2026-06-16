using Microsoft.AspNetCore.Mvc;
using KusinaFlows.Models;
using Npgsql;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using KusinaFlows.Services;

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
        // READ: Fetch all inventory items (With Relational Name Resolution)
        // --------------------------------------------------------------------
        [HttpGet]
        public async Task<IActionResult> GetAllInventory([FromQuery] bool includeUnavailable = false)
        {
            var items = new List<InventoryItem>();
            
            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();
                
                // 🔗 JOIN with STOCK CONTROLLER to pull full employee names instead of raw IDs
                string query = @"
                    SELECT i.""BatchID"", i.""ItemID"", i.""ItemName"", i.""Category"", i.""Price"", 
                           i.""Quantity"", i.""Available"", i.""UTDmonth"", i.""UTDday"", i.""UTDyear"", 
                           i.""DAmonth"", i.""DAday"", i.""DAyear"", i.""Action"", i.""TimeStamp"",
                           i.""PerformedBy_SC_ID"", i.""ApprovedBy_SC_ID"",
                           p.""LastName"" AS p_ln, p.""FirstName"" AS p_fn, p.""MI"" AS p_mi, p.""Position"" AS p_pos,
                           a.""LastName"" AS a_ln, a.""FirstName"" AS a_fn, a.""MI"" AS a_mi, a.""Position"" AS a_pos
                    FROM public.""ITEM"" i
                    LEFT JOIN public.""STOCK CONTROLLER"" p ON i.""PerformedBy_SC_ID"" = p.""SC_ID""
                    LEFT JOIN public.""STOCK CONTROLLER"" a ON i.""ApprovedBy_SC_ID"" = a.""SC_ID"" ";

                if (!includeUnavailable)
                {
                    query += @"WHERE i.""Available"" = true ";
                }

                query += @"ORDER BY i.""ItemName"" ASC, i.""BatchID"" DESC;";

                using (var cmd = new NpgsqlCommand(query, conn))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        // Formulate human-readable names from the foreign key joins
                        string perfName = reader.IsDBNull(17) ? "System Auto" : 
                            $"{reader.GetString(17)}, {reader.GetString(18)}{(reader.IsDBNull(19) ? "" : " " + reader.GetString(19) + ".")} ({reader.GetString(20)})";
                        
                        string apprName = reader.IsDBNull(21) ? "N/A" : 
                            $"{reader.GetString(21)}, {reader.GetString(22)}{(reader.IsDBNull(23) ? "" : " " + reader.GetString(23) + ".")} ({reader.GetString(24)})";

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
                            Action = reader.IsDBNull(13) ? "" : reader.GetString(13),
                            TimeStamp = reader.IsDBNull(14) ? "" : reader.GetString(14),
                            PerformedBy_SC_ID = reader.IsDBNull(15) ? 0 : reader.GetInt32(15),
                            ApprovedBy_SC_ID = reader.IsDBNull(16) ? 0 : reader.GetInt32(16),
                            PerformedBy = perfName,
                            ApprovedBy = apprName
                        });
                    }
                }
            }
            return Ok(items);
        }

        // --------------------------------------------------------------------
        // CREATE: Add Item / Stock-In
        // --------------------------------------------------------------------
        [HttpPost("add")]
        public async Task<IActionResult> AddNewBatch([FromBody] InventoryItem item)
        {
            if (item == null) return BadRequest("Invalid processing payload parameters.");

            // Parse Date Component Integers
            if (!string.IsNullOrEmpty(item.UTDDateString) && DateTime.TryParse(item.UTDDateString, out DateTime utdDate))
            {
                item.UTDmonth = utdDate.Month;
                item.UTDday = utdDate.Day;
                item.UTDyear = utdDate.Year;
            }

            DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time"));
            item.DAmonth = phTime.Month;
            item.DAday = phTime.Day;
            item.DAyear = phTime.Year;
            string customFormattedDate = phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    await conn.OpenAsync();

                    // Resolve string names to valid SC_ID foreign keys
                    item.PerformedBy_SC_ID = await ResolveStaffIdByNameAsync(item.PerformedBy, conn);
                    item.ApprovedBy_SC_ID = await ResolveStaffIdByNameAsync(item.ApprovedBy, conn);

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

                    string insertQuery = @"
                        INSERT INTO public.""ITEM"" 
                        (""ItemID"", ""ItemName"", ""Category"", ""Price"", ""Quantity"", ""Available"",
                        ""UTDmonth"", ""UTDday"", ""UTDyear"", ""DAmonth"", ""DAday"", ""DAyear"", 
                        ""Action"", ""TimeStamp"", ""PerformedBy_SC_ID"", ""ApprovedBy_SC_ID"")
                        VALUES (@ItemID, @ItemName, @Category, @Price, @Quantity, @Available,
                                @UTDmonth, @UTDday, @UTDyear, @DAmonth, @DAday, @DAyear, 
                                @Action, @TimeStamp, @PerformedBy_SC_ID, @ApprovedBy_SC_ID)
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
                        cmd.Parameters.AddWithValue("@UTDmonth", item.UTDmonth);
                        cmd.Parameters.AddWithValue("@UTDday", item.UTDday);
                        cmd.Parameters.AddWithValue("@UTDyear", item.UTDyear);
                        cmd.Parameters.AddWithValue("@DAmonth", item.DAmonth);
                        cmd.Parameters.AddWithValue("@DAday", item.DAday);
                        cmd.Parameters.AddWithValue("@DAyear", item.DAyear);
                        cmd.Parameters.AddWithValue("@Action", detectedAction);
                        cmd.Parameters.AddWithValue("@TimeStamp", customFormattedDate);
                        cmd.Parameters.AddWithValue("@PerformedBy_SC_ID", item.PerformedBy_SC_ID == 0 ? DBNull.Value : item.PerformedBy_SC_ID);
                        cmd.Parameters.AddWithValue("@ApprovedBy_SC_ID", item.ApprovedBy_SC_ID == 0 ? DBNull.Value : item.ApprovedBy_SC_ID);

                        generatedBatchId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                    }

                    // Write to STOCK HISTORY linking cleanly via BatchID column
                    string historyQuery = @"
                        INSERT INTO public.""STOCK HISTORY"" (""BatchID"", ""Quantity"", ""ItemName"", ""Action"", ""DateTime"", ""PerformedBy_SC_ID"", ""ApprovedBy_SC_ID"")
                        VALUES (@BatchID, @Quantity, @ItemName, @Action, @DateTime, @PerformedBy_SC_ID, @ApprovedBy_SC_ID);";

                    using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                    {
                        cmdHistory.Parameters.AddWithValue("@BatchID", generatedBatchId);
                        cmdHistory.Parameters.AddWithValue("@Quantity", item.Quantity);
                        cmdHistory.Parameters.AddWithValue("@ItemName", item.ItemName);
                        cmdHistory.Parameters.AddWithValue("@Action", detectedAction);
                        cmdHistory.Parameters.AddWithValue("@DateTime", customFormattedDate);
                        cmdHistory.Parameters.AddWithValue("@PerformedBy_SC_ID", item.PerformedBy_SC_ID == 0 ? DBNull.Value : item.PerformedBy_SC_ID);
                        cmdHistory.Parameters.AddWithValue("@ApprovedBy_SC_ID", item.ApprovedBy_SC_ID == 0 ? DBNull.Value : item.ApprovedBy_SC_ID);
                        
                        await cmdHistory.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Asset successfully saved and tracked relationally." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CRASH LOG - AddNewBatch]: {ex.Message}");
                return StatusCode(500, $"Failed to write batch entry row: {ex.Message}");
            }
        }

        // --------------------------------------------------------------------
        // DELETE: api/inventory/delete/{id}
        // --------------------------------------------------------------------
        [HttpDelete("delete/{id}")] 
        public async Task<IActionResult> DeleteBatch(int id, [FromQuery] string performedBy = "System Auto", [FromQuery] string approvedBy = "N/A")
        {
            if (id <= 0)
            {
                return BadRequest("Invalid Batch ID specification.");
            }

            DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time"));
            string customFormattedDate = phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    await conn.OpenAsync();

                    int finalPerformedById = 0;
                    int finalApprovedById = 0;

                    // 1. DYNAMICALLY FETCH A GUARANTEED VALID FALLBACK ID FIRST
                    string masterFallbackQuery = @"SELECT ""SC_ID"" FROM public.""STOCK CONTROLLER"" LIMIT 1;";
                    using (var cmdMaster = new NpgsqlCommand(masterFallbackQuery, conn))
                    {
                        var masterResult = await cmdMaster.ExecuteScalarAsync();
                        if (masterResult == null || masterResult == DBNull.Value)
                        {
                            return BadRequest("Database Error: The 'STOCK CONTROLLER' table is completely empty. Add a staff member first.");
                        }
                        int absoluteFallbackId = Convert.ToInt32(masterResult);
                        
                        // Assign defaults immediately
                        finalPerformedById = absoluteFallbackId;
                        finalApprovedById = absoluteFallbackId;
                    }

                    // 2. TRY TO RESOLVE THE 'performedBy' NAME DIRECTLY
                    if (!string.IsNullOrEmpty(performedBy) && performedBy != "System Auto")
                    {
                        // Adjust "StaffName" to match your actual text column name if different (e.g., "Name", "Username")
                        string perfQuery = @"SELECT ""SC_ID"" FROM public.""STOCK CONTROLLER"" WHERE ""StaffName"" = @Name LIMIT 1;";
                        using (var cmdPerf = new NpgsqlCommand(perfQuery, conn))
                        {
                            cmdPerf.Parameters.AddWithValue("@Name", performedBy);
                            var res = await cmdPerf.ExecuteScalarAsync();
                            if (res != null && res != DBNull.Value)
                            {
                                finalPerformedById = Convert.ToInt32(res);
                            }
                        }
                    }

                    // 3. TRY TO RESOLVE THE 'approvedBy' NAME DIRECTLY
                    if (!string.IsNullOrEmpty(approvedBy) && approvedBy != "N/A")
                    {
                        string appQuery = @"SELECT ""SC_ID"" FROM public.""STOCK CONTROLLER"" WHERE ""StaffName"" = @Name LIMIT 1;";
                        using (var cmdApp = new NpgsqlCommand(appQuery, conn))
                        {
                            cmdApp.Parameters.AddWithValue("@Name", approvedBy);
                            var res = await cmdApp.ExecuteScalarAsync();
                            if (res != null && res != DBNull.Value)
                            {
                                finalApprovedById = Convert.ToInt32(res);
                            }
                        }
                    }

                    // 4. FETCH THE ITEM NAME FOR HISTORY PERSISTENCE
                    string fetchedItemName = "Archived Item";
                    string nameQuery = @"SELECT ""ItemName"" FROM public.""ITEM"" WHERE ""BatchID"" = @BatchID;";
                    using (var cmdName = new NpgsqlCommand(nameQuery, conn))
                    {
                        cmdName.Parameters.AddWithValue("@BatchID", id);
                        var result = await cmdName.ExecuteScalarAsync();
                        fetchedItemName = result?.ToString() ?? "Archived Item";
                    }

                    // 5. PERFORM THE SOFT DELETE ON ITEM TABLE
                    string softDeleteQuery = @"
                        UPDATE public.""ITEM""
                        SET ""Quantity"" = 0,
                            ""Available"" = false,
                            ""Action"" = 'Delete Item',
                            ""TimeStamp"" = @TimeStamp,
                            ""PerformedBy_SC_ID"" = @PerformedBy_SC_ID,
                            ""ApprovedBy_SC_ID"" = @ApprovedBy_SC_ID
                        WHERE ""BatchID"" = @BatchID;";

                    using (var cmd = new NpgsqlCommand(softDeleteQuery, conn))
                    {
                        cmd.Parameters.AddWithValue("@BatchID", id);
                        cmd.Parameters.AddWithValue("@TimeStamp", customFormattedDate);
                        cmd.Parameters.AddWithValue("@PerformedBy_SC_ID", finalPerformedById);
                        cmd.Parameters.AddWithValue("@ApprovedBy_SC_ID", finalApprovedById);
                        
                        int rowsAffected = await cmd.ExecuteNonQueryAsync();
                        if (rowsAffected == 0) return NotFound("Target batch entity row not found.");
                    }

                    // 6. LOG TO THE permanent STOCK HISTORY LEDGER
                    string historyQuery = @"
                        INSERT INTO public.""STOCK HISTORY"" (""BatchID"", ""Quantity"", ""ItemName"", ""Action"", ""DateTime"", ""PerformedBy_SC_ID"", ""ApprovedBy_SC_ID"")
                        VALUES (@BatchID, 0, @ItemName, 'Delete Item', @DateTime, @PerformedBy_SC_ID, @ApprovedBy_SC_ID);";

                    using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                    {
                        cmdHistory.Parameters.AddWithValue("@BatchID", id);
                        cmdHistory.Parameters.AddWithValue("@ItemName", fetchedItemName);    
                        cmdHistory.Parameters.AddWithValue("@DateTime", customFormattedDate);
                        cmdHistory.Parameters.AddWithValue("@PerformedBy_SC_ID", finalPerformedById);
                        cmdHistory.Parameters.AddWithValue("@ApprovedBy_SC_ID", finalApprovedById);

                        await cmdHistory.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { message = "Batch row archived and tracked inside ledger successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CRITICAL DELETE ERROR]: {ex}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        // --------------------------------------------------------------------
        // RELATIONAL LOOKUP HELPERS (Name to ID Resolution)
        // --------------------------------------------------------------------
        private async Task<int> ResolveStaffIdByNameAsync(string? fullIdentityString, NpgsqlConnection conn)
        {
            if (string.IsNullOrEmpty(fullIdentityString) || !fullIdentityString.Contains(",")) return 0;

            try
            {
                // Parses "LastName, FirstName (Position)"
                var parts = fullIdentityString.Split(',');
                string lastName = parts[0].Trim();
                
                string rest = parts[1].Trim();
                int idxBracket = rest.IndexOf('(');
                string firstNameText = idxBracket - 1 > 0 ? rest.Substring(0, idxBracket).Trim() : rest;

                // Handle Middle Initial extraction if present
                string firstName = firstNameText;
                if (firstNameText.Contains("."))
                {
                    int lastSpace = firstNameText.LastIndexOf(' ');
                    if (lastSpace > 0) firstName = firstNameText.Substring(0, lastSpace).Trim();
                }

                string lookupQuery = @"
                    SELECT ""SC_ID"" FROM public.""STOCK CONTROLLER"" 
                    WHERE LOWER(""LastName"") = LOWER(@LastName) AND LOWER(""FirstName"") LIKE LOWER(@FirstName) LIMIT 1;";

                using (var cmd = new NpgsqlCommand(lookupQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@LastName", lastName);
                    cmd.Parameters.AddWithValue("@FirstName", firstName + "%");
                    var result = await cmd.ExecuteScalarAsync();
                    return result != null ? Convert.ToInt32(result) : 0;
                }
            }
            catch
            {
                return 0; // Fallback to system tracking safely if text parsing fails
            }

            
        }
    
    // --------------------------------------------------------------------
    // POST: api/inventory/stock-out-specific
    // --------------------------------------------------------------------
    [HttpPost("stock-out-specific")]
    public async Task<IActionResult> StockOutSpecific([FromBody] StockOutRequest request)
    {
        if (request == null || request.BatchID <= 0 || request.Quantity <= 0)
        {
            return BadRequest("Invalid stock-out parameters.");
        }

        DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time"));
        string customFormattedDate = phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

        try
        {
            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();

                // 🔍 Resolve personnel string names into relational IDs
                int? performedBy_Id = await ResolveStaffIdByNameAsync(request.PerformedBy, conn);
                int? approvedBy_Id = await ResolveStaffIdByNameAsync(request.ApprovedBy, conn);

                // 1. Fetch current row state to make sure we don't drop quantity below zero
                string selectQuery = @"SELECT ""Quantity"", ""ItemName"" FROM public.""ITEM"" WHERE ""BatchID"" = @BatchID;";
                int currentQty = 0;
                string itemName = "";

                using (var cmdSelect = new NpgsqlCommand(selectQuery, conn))
                {
                    cmdSelect.Parameters.AddWithValue("@BatchID", request.BatchID);
                    using (var reader = await cmdSelect.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            currentQty = reader.GetInt32(0);
                            itemName = reader.GetString(1);
                        }
                        else
                        {
                            return NotFound("Target inventory batch registry missing.");
                        }
                    }
                }

                if (request.Quantity > currentQty)
                {
                    return BadRequest("Overdeduction bounds tripped. Insufficient quantity.");
                }

                int structuralNewQty = currentQty - request.Quantity;
                
                // 🎯 If the new quantity hits 0, flip 'Available' to false automatically!
                bool isAvailable = structuralNewQty > 0;

                // 2. Perform table update tracking state changes
                string updateQuery = @"
                    UPDATE public.""ITEM"" 
                    SET ""Quantity"" = @Quantity, 
                        ""Available"" = @Available,
                        ""Action"" = 'Stock-Out', 
                        ""TimeStamp"" = @TimeStamp,
                        ""PerformedBy_SC_ID"" = @PerformedBy_SC_ID,
                        ""ApprovedBy_SC_ID"" = @ApprovedBy_SC_ID
                    WHERE ""BatchID"" = @BatchID;";

                using (var cmdUpdate = new NpgsqlCommand(updateQuery, conn))
                {
                    cmdUpdate.Parameters.AddWithValue("@Quantity", structuralNewQty);
                    cmdUpdate.Parameters.AddWithValue("@Available", isAvailable);
                    cmdUpdate.Parameters.AddWithValue("@TimeStamp", customFormattedDate);
                    cmdUpdate.Parameters.AddWithValue("@BatchID", request.BatchID);
                    cmdUpdate.Parameters.AddWithValue("@PerformedBy_SC_ID", performedBy_Id.HasValue ? (object)performedBy_Id.Value : DBNull.Value);
                    cmdUpdate.Parameters.AddWithValue("@ApprovedBy_SC_ID", approvedBy_Id.HasValue ? (object)approvedBy_Id.Value : DBNull.Value);

                    await cmdUpdate.ExecuteNonQueryAsync();
                }

                // 3. Write relational audit ledger line entry to STOCK HISTORY
                string historyQuery = @"
                    INSERT INTO public.""STOCK HISTORY"" (""BatchID"", ""Quantity"", ""ItemName"", ""Action"", ""DateTime"", ""PerformedBy_SC_ID"", ""ApprovedBy_SC_ID"")
                    VALUES (@BatchID, @Quantity, @ItemName, 'Stock-Out', @DateTime, @PerformedBy_SC_ID, @ApprovedBy_SC_ID);";

                using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                {
                    cmdHistory.Parameters.AddWithValue("@BatchID", request.BatchID);
                    cmdHistory.Parameters.AddWithValue("@Quantity", request.Quantity); // Log deduction amount
                    cmdHistory.Parameters.AddWithValue("@ItemName", itemName);
                    cmdHistory.Parameters.AddWithValue("@DateTime", customFormattedDate);
                    cmdHistory.Parameters.AddWithValue("@PerformedBy_SC_ID", performedBy_Id.HasValue ? (object)performedBy_Id.Value : DBNull.Value);
                    cmdHistory.Parameters.AddWithValue("@ApprovedBy_SC_ID", approvedBy_Id.HasValue ? (object)approvedBy_Id.Value : DBNull.Value);

                    await cmdHistory.ExecuteNonQueryAsync();
                }
            }

            return Ok(new { message = "Stock extraction completed successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal transactional error processing stock-out mapping: {ex.Message}");
        }
    }

    // --------------------------------------------------------------------
    // PUT: api/inventory/update-full-batch
    // --------------------------------------------------------------------
    [HttpPut("update-full-batch")]
    public async Task<IActionResult> UpdateFullBatch([FromBody] InventoryItem item)
    {
        if (item == null || item.BatchID <= 0)
        {
            return BadRequest("Invalid full-batch update parameters.");
        }

        // Parse out the manually edited date string back to system values if altered
        if (!string.IsNullOrEmpty(item.UTDDateString) && DateTime.TryParse(item.UTDDateString, out DateTime updatedUtd))
        {
            item.UTDmonth = updatedUtd.Month;
            item.UTDday = updatedUtd.Day;
            item.UTDyear = updatedUtd.Year;
        }

        DateTime phTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time"));
        string customFormattedDate = phTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

        try
        {
            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();

                // 🔍 Safely convert auditing strings into structural relational IDs
                int? performedBy_Id = await ResolveStaffIdByNameAsync(item.PerformedBy, conn);
                int? approvedBy_Id = await ResolveStaffIdByNameAsync(item.ApprovedBy, conn);

                // Automatically manage availability state based on quantity input adjustments
                bool isAvailable = item.Quantity > 0;

                string updateQuery = @"
                    UPDATE public.""ITEM""
                    SET ""ItemName"" = @ItemName,
                        ""Category"" = @Category,
                        ""Price"" = @Price,
                        ""Quantity"" = @Quantity,
                        ""Available"" = @Available,
                        ""UTDmonth"" = @UTDmonth,
                        ""UTDday"" = @UTDday,
                        ""UTDyear"" = @UTDyear,
                        ""Action"" = 'Edit Item',
                        ""TimeStamp"" = @TimeStamp,
                        ""PerformedBy_SC_ID"" = @PerformedBy_SC_ID,
                        ""ApprovedBy_SC_ID"" = @ApprovedBy_SC_ID
                    WHERE ""BatchID"" = @BatchID;";

                using (var cmd = new NpgsqlCommand(updateQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@ItemName", item.ItemName);
                    cmd.Parameters.AddWithValue("@Category", item.Category);
                    cmd.Parameters.AddWithValue("@Price", item.Price);
                    cmd.Parameters.AddWithValue("@Quantity", item.Quantity);
                    cmd.Parameters.AddWithValue("@Available", isAvailable);
                    cmd.Parameters.AddWithValue("@UTDmonth", item.UTDmonth);
                    cmd.Parameters.AddWithValue("@UTDday", item.UTDday);
                    cmd.Parameters.AddWithValue("@UTDyear", item.UTDyear);
                    cmd.Parameters.AddWithValue("@TimeStamp", customFormattedDate);
                    cmd.Parameters.AddWithValue("@BatchID", item.BatchID);
                    cmd.Parameters.AddWithValue("@PerformedBy_SC_ID", performedBy_Id.HasValue ? (object)performedBy_Id.Value : DBNull.Value);
                    cmd.Parameters.AddWithValue("@ApprovedBy_SC_ID", approvedBy_Id.HasValue ? (object)approvedBy_Id.Value : DBNull.Value);

                    await cmd.ExecuteNonQueryAsync();
                }

                // 📜 Log a fresh row entry within STOCK HISTORY tracking this direct manipulation layout change
                string historyQuery = @"
                    INSERT INTO public.""STOCK HISTORY"" (""BatchID"", ""Quantity"", ""ItemName"", ""Action"", ""DateTime"", ""PerformedBy_SC_ID"", ""ApprovedBy_SC_ID"")
                    VALUES (@BatchID, @Quantity, @ItemName, 'Edit Item', @DateTime, @PerformedBy_SC_ID, @ApprovedBy_SC_ID);";

                using (var cmdHistory = new NpgsqlCommand(historyQuery, conn))
                {
                    cmdHistory.Parameters.AddWithValue("@BatchID", item.BatchID);
                    cmdHistory.Parameters.AddWithValue("@Quantity", item.Quantity);
                    cmdHistory.Parameters.AddWithValue("@ItemName", item.ItemName);
                    cmdHistory.Parameters.AddWithValue("@DateTime", customFormattedDate);
                    cmdHistory.Parameters.AddWithValue("@PerformedBy_SC_ID", performedBy_Id.HasValue ? (object)performedBy_Id.Value : DBNull.Value);
                    cmdHistory.Parameters.AddWithValue("@ApprovedBy_SC_ID", approvedBy_Id.HasValue ? (object)approvedBy_Id.Value : DBNull.Value);

                    await cmdHistory.ExecuteNonQueryAsync();
                }
            }

            return Ok(new { message = "Batch updates written and tracked successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal transactional failure modifying operational block fields: {ex.Message}");
        }
    }
    [HttpGet("all-history")]
    public async Task<IActionResult> GetStockHistory()
    {
        var historyLogs = new List<object>();

        try
        {
            using (var conn = _dbService.GetConnection())
            {
                await conn.OpenAsync();

                // 🎯 FIX: We are now explicitly querying the "STOCK HISTORY" table (h)
                // instead of the "ITEM" table, ensuring we see every past action log!
                string query = @"
                    SELECT h.""SH_ID"", h.""BatchID"", h.""ItemName"", h.""Quantity"", h.""Action"", h.""DateTime"",
                        p.""LastName"" AS p_ln, p.""FirstName"" AS p_fn, p.""Position"" AS p_pos,
                        a.""LastName"" AS a_ln, a.""FirstName"" AS a_fn, a.""Position"" AS a_pos,
                        h.""PerformedBy"" AS raw_perf, h.""ApprovedBy"" AS raw_app
                    FROM public.""STOCK HISTORY"" h
                    LEFT JOIN public.""STOCK CONTROLLER"" p ON h.""PerformedBy_SC_ID"" = p.""SC_ID""
                    LEFT JOIN public.""STOCK CONTROLLER"" a ON h.""ApprovedBy_SC_ID"" = a.""SC_ID""
                    ORDER BY h.""SH_ID"" DESC;";

                using (var cmd = new NpgsqlCommand(query, conn))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        // Safe handling for PerformedBy names
                        string performedByName = "System Auto";
                        if (!reader.IsDBNull(6)) 
                        {
                            performedByName = $"{reader.GetString(6)}, {reader.GetString(7)} ({reader.GetString(8)})";
                        }
                        else if (!reader.IsDBNull(12)) 
                        {
                            performedByName = reader.GetString(12);
                        }

                        // Safe handling for ApprovedBy names
                        string approvedByName = "N/A";
                        if (!reader.IsDBNull(9)) 
                        {
                            approvedByName = $"{reader.GetString(9)}, {reader.GetString(10)} ({reader.GetString(11)})";
                        }
                        else if (!reader.IsDBNull(13)) 
                        {
                            approvedByName = reader.GetString(13);
                        }

                        historyLogs.Add(new
                        {
                            SH_ID = reader.GetInt32(0),
                            BatchID = reader.GetInt32(1),
                            ItemName = reader.GetString(2),
                            Quantity = reader.GetInt32(3),
                            Action = reader.GetString(4),
                            DateTime = reader.GetString(5),
                            PerformedBy = performedByName,
                            ApprovedBy = approvedByName
                        });
                    }
                }
            }

            return Ok(historyLogs);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[HISTORY FETCH ERROR]: {ex.Message}");
            return StatusCode(500, $"Failed to retrieve history records: {ex.Message}");
        }
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