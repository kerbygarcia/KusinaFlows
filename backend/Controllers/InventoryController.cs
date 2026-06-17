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

        // Philippine time zone (UTC+8, same as Singapore Standard Time)
        private static readonly TimeZoneInfo PhilippineTime =
            TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time");

        public InventoryController(DatabaseService dbService)
        {
            _dbService = dbService;
        }

        // ====================================================================
        // GET api/inventory
        // Returns all (or only available) ITEM rows joined with staff names
        // ====================================================================
        [HttpGet]
        public async Task<IActionResult> GetAllInventory([FromQuery] bool includeUnavailable = false)
        {
            var items = new List<InventoryItem>();
            try
            {
                using var conn = _dbService.GetConnection();
                await conn.OpenAsync();

                string query = @"
                    SELECT
                        i.""BatchID"",
                        i.""ItemID"",
                        i.""ItemName"",
                        i.""Category"",
                        i.""Price"",
                        i.""Quantity"",
                        i.""Available"",
                        i.""UTD"",
                        i.""Action"",
                        i.""DateAdded"",
                        TRIM(CONCAT(p.""FirstName"", ' ', p.""LastName"")) AS PerformedByName,
                        TRIM(CONCAT(a.""FirstName"", ' ', a.""LastName"")) AS ApprovedByName
                    FROM public.""ITEM"" i
                    LEFT JOIN public.""STOCK CONTROLLER"" p ON i.""PerformedBy_SC_ID"" = p.""SC_ID""
                    LEFT JOIN public.""STOCK CONTROLLER"" a ON i.""ApprovedBy_SC_ID""  = a.""SC_ID"" "
                    + (includeUnavailable ? "" : @"WHERE i.""Available"" = true ")
                    + @"ORDER BY i.""BatchID"" DESC;";

                using var cmd = new NpgsqlCommand(query, conn);
                using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    string performedBy = (!reader.IsDBNull(10) && !string.IsNullOrWhiteSpace(reader.GetString(10)))
                        ? reader.GetString(10) : "System Auto";
                    string approvedBy  = (!reader.IsDBNull(11) && !string.IsNullOrWhiteSpace(reader.GetString(11)))
                        ? reader.GetString(11) : "N/A";

                    items.Add(new InventoryItem
                    {
                        BatchID    = reader.GetInt32(0),
                        ItemID     = reader.GetInt32(1),
                        ItemName   = reader.GetString(2),
                        Category   = reader.GetString(3),
                        Price      = reader.GetDecimal(4),
                        Quantity   = reader.GetInt32(5),
                        Available  = reader.GetBoolean(6),
                        UTD        = reader.GetInt32(7),
                        Action     = reader.IsDBNull(8)  ? "Add Item" : reader.GetString(8),
                        DateAdded  = reader.IsDBNull(9)  ? ""         : reader.GetString(9),
                        PerformedBy = performedBy,
                        ApprovedBy  = approvedBy
                    });
                }

                return Ok(items);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Failed to retrieve inventory: {ex.Message}");
            }
        }

        // ====================================================================
        // POST api/inventory/add
        // Inserts a new batch row into ITEM and logs to STOCK HISTORY
        // ====================================================================
        [HttpPost("add")]
        public async Task<IActionResult> AddNewBatch([FromBody] InventoryItem item)
        {
            if (item == null) return BadRequest("Invalid parameters.");

            string phNow = GetPhilippineTimestamp();

            try
            {
                using var conn = _dbService.GetConnection();
                await conn.OpenAsync();

                var pId = await ResolveStaffIdByNameAsync(item.PerformedBy, conn);
                var aId = await ResolveStaffIdByNameAsync(item.ApprovedBy, conn);

                // Determine if any batch for this item already exists (Stock-In vs Add Item)
                bool itemExists = false;
                using (var cmdCheck = new NpgsqlCommand(
                    @"SELECT COUNT(1) FROM public.""ITEM"" WHERE ""ItemName"" = @ItemName;", conn))
                {
                    cmdCheck.Parameters.AddWithValue("@ItemName", item.ItemName);
                    itemExists = Convert.ToInt32(await cmdCheck.ExecuteScalarAsync()) > 0;
                }

                // Auto-assign ItemID if not provided
                if (item.ItemID <= 0)
                {
                    using var cmdMax = new NpgsqlCommand(
                        @"SELECT COALESCE(MAX(""ItemID""), 100) + 1 FROM public.""ITEM"";", conn);
                    item.ItemID = Convert.ToInt32(await cmdMax.ExecuteScalarAsync());
                }

                string detectedAction = itemExists ? "Stock-In" : "Add Item";

                // Insert into ITEM
                int generatedBatchId;
                using (var cmd = new NpgsqlCommand(@"
                    INSERT INTO public.""ITEM""
                        (""ItemID"", ""ItemName"", ""Category"", ""Price"", ""Quantity"",
                         ""Available"", ""UTD"", ""Action"", ""DateAdded"",
                         ""PerformedBy_SC_ID"", ""ApprovedBy_SC_ID"")
                    VALUES
                        (@ItemID, @ItemName, @Category, @Price, @Quantity,
                         true, @UTD, @Action, @DateAdded,
                         @PerformedBy_SC_ID, @ApprovedBy_SC_ID)
                    RETURNING ""BatchID"";", conn))
                {
                    cmd.Parameters.AddWithValue("@ItemID",            item.ItemID);
                    cmd.Parameters.AddWithValue("@ItemName",          item.ItemName);
                    cmd.Parameters.AddWithValue("@Category",          item.Category);
                    cmd.Parameters.AddWithValue("@Price",             item.Price);
                    cmd.Parameters.AddWithValue("@Quantity",          item.Quantity);
                    cmd.Parameters.AddWithValue("@UTD",               item.UTD);
                    cmd.Parameters.AddWithValue("@Action",            detectedAction);
                    cmd.Parameters.AddWithValue("@DateAdded",         phNow);
                    cmd.Parameters.AddWithValue("@PerformedBy_SC_ID", pId.HasValue ? (object)pId.Value : DBNull.Value);
                    cmd.Parameters.AddWithValue("@ApprovedBy_SC_ID",  aId.HasValue ? (object)aId.Value : DBNull.Value);
                    generatedBatchId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                }

                // Log to STOCK HISTORY
                // For a brand-new add, OldQuantity/OldPrice/OldUTD/OldCategory mirror current values
                await InsertHistoryAsync(conn, new StockHistory
                {
                    BatchID     = generatedBatchId,
                    ItemName    = item.ItemName,
                    Action      = detectedAction,
                    Quantity    = item.Quantity,
                    OldQuantity = 0,
                    Price       = item.Price,
                    OldPrice    = item.Price,
                    UTD         = item.UTD,
                    OldUTD      = item.UTD,
                    Category    = item.Category,
                    OldCategory = item.Category,
                    DateTime    = phNow,
                    PerformedBy = item.PerformedBy ?? "System Auto",
                    ApprovedBy  = item.ApprovedBy  ?? "N/A",
                    PerformedBy_SC_ID = pId,
                    ApprovedBy_SC_ID  = aId
                });

                return Ok(new { message = "Batch added successfully.", batchId = generatedBatchId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // ====================================================================
        // PUT api/inventory/update-full-batch
        // Updates an existing ITEM row and logs old→new values to STOCK HISTORY
        // ====================================================================
        [HttpPut("update-full-batch")]
        public async Task<IActionResult> UpdateFullBatch([FromBody] InventoryItem item)
        {
            if (item == null || item.BatchID <= 0) return BadRequest("Invalid parameters.");

            string phNow = GetPhilippineTimestamp();

            try
            {
                using var conn = _dbService.GetConnection();
                await conn.OpenAsync();

                var pId = await ResolveStaffIdByNameAsync(item.PerformedBy, conn);
                var aId = await ResolveStaffIdByNameAsync(item.ApprovedBy, conn);

                // Read current values before overwriting (for history diff)
                int     oldQty   = 0;
                decimal oldPrice = 0;
                int     oldUtd   = 0;
                string  oldCat   = "";

                using (var cmdSelect = new NpgsqlCommand(@"
                    SELECT ""Quantity"", ""Price"", ""UTD"", ""Category""
                    FROM public.""ITEM""
                    WHERE ""BatchID"" = @BatchID;", conn))
                {
                    cmdSelect.Parameters.AddWithValue("@BatchID", item.BatchID);
                    using var reader = await cmdSelect.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        oldQty   = reader.GetInt32(0);
                        oldPrice = reader.GetDecimal(1);
                        oldUtd   = reader.GetInt32(2);
                        oldCat   = reader.GetString(3);
                    }
                }

                // Update ITEM row
                using (var cmd = new NpgsqlCommand(@"
                    UPDATE public.""ITEM""
                    SET
                        ""ItemName""          = @ItemName,
                        ""Category""          = @Category,
                        ""Price""             = @Price,
                        ""Quantity""          = @Quantity,
                        ""Available""         = @Avail,
                        ""UTD""               = @UTD,
                        ""Action""            = 'Edit Item',
                        ""DateAdded""         = @DateAdded,
                        ""PerformedBy_SC_ID"" = @PerformedBy_SC_ID,
                        ""ApprovedBy_SC_ID""  = @ApprovedBy_SC_ID
                    WHERE ""BatchID"" = @BatchID;", conn))
                {
                    cmd.Parameters.AddWithValue("@ItemName",          item.ItemName);
                    cmd.Parameters.AddWithValue("@Category",          item.Category);
                    cmd.Parameters.AddWithValue("@Price",             item.Price);
                    cmd.Parameters.AddWithValue("@Quantity",          item.Quantity);
                    cmd.Parameters.AddWithValue("@Avail",             true); // Available=false is ONLY set by Delete; qty=0 means Out-of-Stock
                    cmd.Parameters.AddWithValue("@UTD",               item.UTD);
                    cmd.Parameters.AddWithValue("@DateAdded",         phNow);
                    cmd.Parameters.AddWithValue("@PerformedBy_SC_ID", pId.HasValue ? (object)pId.Value : DBNull.Value);
                    cmd.Parameters.AddWithValue("@ApprovedBy_SC_ID",  aId.HasValue ? (object)aId.Value : DBNull.Value);
                    cmd.Parameters.AddWithValue("@BatchID",           item.BatchID);
                    await cmd.ExecuteNonQueryAsync();
                }

                // Log to STOCK HISTORY with old→new diff
                await InsertHistoryAsync(conn, new StockHistory
                {
                    BatchID     = item.BatchID,
                    ItemName    = item.ItemName,
                    Action      = "Edit Item",
                    Quantity    = item.Quantity,
                    OldQuantity = oldQty,
                    Price       = item.Price,
                    OldPrice    = oldPrice,
                    UTD         = item.UTD,
                    OldUTD      = oldUtd,
                    Category    = item.Category,
                    OldCategory = oldCat,
                    DateTime    = phNow,
                    PerformedBy = item.PerformedBy ?? "System Auto",
                    ApprovedBy  = item.ApprovedBy  ?? "N/A",
                    PerformedBy_SC_ID = pId,
                    ApprovedBy_SC_ID  = aId
                });

                return Ok(new { message = "Batch updated successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // ====================================================================
        // GET api/inventory/all-history
        // Returns all STOCK HISTORY rows joined with staff names, newest first
        // ====================================================================
        [HttpGet("all-history")]
        public async Task<IActionResult> GetStockHistory()
        {
            var logs = new List<object>();
            try
            {
                using var conn = _dbService.GetConnection();
                await conn.OpenAsync();

                string query = @"
                    SELECT
                        h.""SH_ID"",
                        h.""BatchID"",
                        h.""ItemName"",
                        h.""Action"",
                        h.""DateTime"",
                        h.""Quantity"",
                        h.""OldQuantity"",
                        h.""Price"",
                        h.""OldPrice"",
                        h.""UTD"",
                        h.""OldUTD"",
                        h.""Category"",
                        h.""OldCategory"",
                        h.""PerformedBy"",
                        h.""ApprovedBy"",
                        TRIM(CONCAT(p.""FirstName"", ' ', p.""LastName"")) AS PerformedByResolved,
                        TRIM(CONCAT(a.""FirstName"", ' ', a.""LastName"")) AS ApprovedByResolved
                    FROM public.""STOCK HISTORY"" h
                    LEFT JOIN public.""STOCK CONTROLLER"" p ON h.""PerformedBy_SC_ID"" = p.""SC_ID""
                    LEFT JOIN public.""STOCK CONTROLLER"" a ON h.""ApprovedBy_SC_ID""  = a.""SC_ID""
                    ORDER BY h.""SH_ID"" DESC;";

                using var cmd    = new NpgsqlCommand(query, conn);
                using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    // Prefer the joined name; fall back to the raw VARCHAR stored on the row
                    string performedBy = ResolveDisplayName(
                        reader.IsDBNull(15) ? null : reader.GetString(15),
                        reader.IsDBNull(13) ? null : reader.GetString(13),
                        "System Auto");

                    string approvedBy = ResolveDisplayName(
                        reader.IsDBNull(16) ? null : reader.GetString(16),
                        reader.IsDBNull(14) ? null : reader.GetString(14),
                        "N/A");

                    logs.Add(new
                    {
                        SH_ID       = reader.GetInt32(0),
                        BatchID     = reader.GetInt32(1),
                        ItemName    = reader.IsDBNull(2)  ? "Unknown" : reader.GetString(2),
                        Action      = reader.IsDBNull(3)  ? "Add Item": reader.GetString(3),
                        DateTime    = reader.IsDBNull(4)  ? "N/A"     : reader.GetString(4),
                        Quantity    = reader.GetInt32(5),
                        OldQuantity = reader.IsDBNull(6)  ? 0         : reader.GetInt32(6),
                        Price       = reader.IsDBNull(7)  ? 0m        : reader.GetDecimal(7),
                        OldPrice    = reader.IsDBNull(8)  ? 0m        : reader.GetDecimal(8),
                        UTD         = reader.IsDBNull(9)  ? 0         : reader.GetInt32(9),
                        OldUTD      = reader.IsDBNull(10) ? 0         : reader.GetInt32(10),
                        Category    = reader.IsDBNull(11) ? "General" : reader.GetString(11),
                        OldCategory = reader.IsDBNull(12) ? "General" : reader.GetString(12),
                        PerformedBy = performedBy,
                        ApprovedBy  = approvedBy
                    });
                }

                return Ok(logs);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[HISTORY FETCH ERROR]: {ex.Message}");
                return StatusCode(500, $"Failed to retrieve history: {ex.Message}");
            }
        }


        // ====================================================================
        // POST api/inventory/stock-out-specific
        // Deducts qty from a batch. Available stays TRUE even when qty hits 0.
        // Available=false is ONLY ever set by the DELETE endpoint (user action).
        // ====================================================================
        [HttpPost("stock-out-specific")]
        public async Task<IActionResult> StockOutSpecific([FromBody] StockOutDto dto)
        {
            if (dto == null || dto.BatchID <= 0 || dto.Quantity <= 0)
                return BadRequest("Invalid stock-out parameters.");

            string phNow = GetPhilippineTimestamp();

            try
            {
                using var conn = _dbService.GetConnection();
                await conn.OpenAsync();

                var pId = await ResolveStaffIdByNameAsync(dto.PerformedBy, conn);
                var aId = await ResolveStaffIdByNameAsync(dto.ApprovedBy,  conn);

                int oldQty = 0; decimal price = 0; int utd = 0;
                string category = "", itemName = "";

                using (var sel = new NpgsqlCommand(@"
                    SELECT ""Quantity"",""Price"",""UTD"",""Category"",""ItemName""
                    FROM public.""ITEM"" WHERE ""BatchID""=@B;", conn))
                {
                    sel.Parameters.AddWithValue("@B", dto.BatchID);
                    using var r = await sel.ExecuteReaderAsync();
                    if (!await r.ReadAsync()) return NotFound($"Batch #{dto.BatchID} not found.");
                    oldQty=r.GetInt32(0); price=r.GetDecimal(1); utd=r.GetInt32(2);
                    category=r.GetString(3); itemName=r.GetString(4);
                }

                if (dto.Quantity > oldQty)
                    return BadRequest($"Cannot deduct {dto.Quantity} from batch with only {oldQty} units.");

                int newQty = oldQty - dto.Quantity;

                using (var upd = new NpgsqlCommand(@"
                    UPDATE public.""ITEM""
                    SET ""Quantity""=@Q, ""Available""=true, ""Action""='Stock-Out',
                        ""DateAdded""=@D, ""PerformedBy_SC_ID""=@P, ""ApprovedBy_SC_ID""=@A
                    WHERE ""BatchID""=@B;", conn))
                {
                    upd.Parameters.AddWithValue("@Q", newQty);
                    upd.Parameters.AddWithValue("@D", phNow);
                    upd.Parameters.AddWithValue("@P", pId.HasValue?(object)pId.Value:DBNull.Value);
                    upd.Parameters.AddWithValue("@A", aId.HasValue?(object)aId.Value:DBNull.Value);
                    upd.Parameters.AddWithValue("@B", dto.BatchID);
                    await upd.ExecuteNonQueryAsync();
                }

                await InsertHistoryAsync(conn, new StockHistory {
                    BatchID=dto.BatchID, ItemName=itemName, Action="Stock-Out",
                    Quantity=newQty, OldQuantity=oldQty,
                    Price=price, OldPrice=price, UTD=utd, OldUTD=utd,
                    Category=category, OldCategory=category, DateTime=phNow,
                    PerformedBy=dto.PerformedBy??"System Auto", ApprovedBy=dto.ApprovedBy??"N/A",
                    PerformedBy_SC_ID=pId, ApprovedBy_SC_ID=aId
                });

                return Ok(new { message = $"Stock-Out: Batch #{dto.BatchID} {oldQty}→{newQty}" });
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ====================================================================
        // DELETE api/inventory/delete/{batchId}
        // The ONLY endpoint that sets Available=FALSE (hard archive / deleted).
        // Accepts { performedBy, approvedBy } body for full audit trail.
        // ====================================================================
        [HttpDelete("delete/{batchId}")]
        public async Task<IActionResult> DeleteBatch(int batchId, [FromBody] DeleteRequestDto? dto)
        {
            if (batchId <= 0) return BadRequest("Invalid BatchID.");
            string phNow = GetPhilippineTimestamp();

            try
            {
                using var conn = _dbService.GetConnection();
                await conn.OpenAsync();

                var pId = await ResolveStaffIdByNameAsync(dto?.PerformedBy, conn);
                var aId = await ResolveStaffIdByNameAsync(dto?.ApprovedBy,  conn);

                int qty=0; decimal price=0; int utd=0;
                string category="", itemName="";
                bool alreadyDeleted=false;

                using (var sel = new NpgsqlCommand(@"
                    SELECT ""Quantity"",""Price"",""UTD"",""Category"",""ItemName"",""Available""
                    FROM public.""ITEM"" WHERE ""BatchID""=@B;", conn))
                {
                    sel.Parameters.AddWithValue("@B", batchId);
                    using var r = await sel.ExecuteReaderAsync();
                    if (!await r.ReadAsync()) return NotFound($"Batch #{batchId} not found.");
                    qty=r.GetInt32(0); price=r.GetDecimal(1); utd=r.GetInt32(2);
                    category=r.GetString(3); itemName=r.GetString(4);
                    alreadyDeleted=!r.GetBoolean(5);
                }

                if (alreadyDeleted)
                    return Ok(new { message = $"Batch #{batchId} already archived." });

                using (var upd = new NpgsqlCommand(@"
                    UPDATE public.""ITEM""
                    SET ""Available""=false, ""Action""='Deleted', ""DateAdded""=@D,
                        ""PerformedBy_SC_ID""=@P, ""ApprovedBy_SC_ID""=@A
                    WHERE ""BatchID""=@B;", conn))
                {
                    upd.Parameters.AddWithValue("@D", phNow);
                    upd.Parameters.AddWithValue("@P", pId.HasValue?(object)pId.Value:DBNull.Value);
                    upd.Parameters.AddWithValue("@A", aId.HasValue?(object)aId.Value:DBNull.Value);
                    upd.Parameters.AddWithValue("@B", batchId);
                    await upd.ExecuteNonQueryAsync();
                }

                await InsertHistoryAsync(conn, new StockHistory {
                    BatchID=batchId, ItemName=itemName, Action="Deleted",
                    Quantity=0, OldQuantity=qty,
                    Price=price, OldPrice=price, UTD=utd, OldUTD=utd,
                    Category=category, OldCategory=category, DateTime=phNow,
                    PerformedBy=dto?.PerformedBy??"System Auto", ApprovedBy=dto?.ApprovedBy??"N/A",
                    PerformedBy_SC_ID=pId, ApprovedBy_SC_ID=aId
                });

                return Ok(new { message = $"Batch #{batchId} archived." });
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ====================================================================
        // PRIVATE HELPERS
        // ====================================================================

        /// <summary>
        /// Inserts one row into STOCK HISTORY.
        /// </summary>
        private static async Task InsertHistoryAsync(NpgsqlConnection conn, StockHistory h)
        {
            using var cmd = new NpgsqlCommand(@"
                INSERT INTO public.""STOCK HISTORY""
                    (""BatchID"", ""ItemName"", ""Action"", ""DateTime"",
                     ""Quantity"",    ""OldQuantity"",
                     ""Price"",       ""OldPrice"",
                     ""UTD"",         ""OldUTD"",
                     ""Category"",    ""OldCategory"",
                     ""PerformedBy"", ""ApprovedBy"",
                     ""PerformedBy_SC_ID"", ""ApprovedBy_SC_ID"")
                VALUES
                    (@BatchID, @ItemName, @Action, @DateTime,
                     @Quantity,    @OldQuantity,
                     @Price,       @OldPrice,
                     @UTD,         @OldUTD,
                     @Category,    @OldCategory,
                     @PerformedBy, @ApprovedBy,
                     @PerformedBy_SC_ID, @ApprovedBy_SC_ID);", conn);

            cmd.Parameters.AddWithValue("@BatchID",           h.BatchID);
            cmd.Parameters.AddWithValue("@ItemName",          h.ItemName);
            cmd.Parameters.AddWithValue("@Action",            h.Action);
            cmd.Parameters.AddWithValue("@DateTime",          h.DateTime);
            cmd.Parameters.AddWithValue("@Quantity",          h.Quantity);
            cmd.Parameters.AddWithValue("@OldQuantity",       h.OldQuantity);
            cmd.Parameters.AddWithValue("@Price",             h.Price);
            cmd.Parameters.AddWithValue("@OldPrice",          h.OldPrice);
            cmd.Parameters.AddWithValue("@UTD",               h.UTD);
            cmd.Parameters.AddWithValue("@OldUTD",            h.OldUTD);
            cmd.Parameters.AddWithValue("@Category",          h.Category);
            cmd.Parameters.AddWithValue("@OldCategory",       h.OldCategory);
            cmd.Parameters.AddWithValue("@PerformedBy",       h.PerformedBy);
            cmd.Parameters.AddWithValue("@ApprovedBy",        h.ApprovedBy);
            cmd.Parameters.AddWithValue("@PerformedBy_SC_ID", h.PerformedBy_SC_ID.HasValue ? (object)h.PerformedBy_SC_ID.Value : DBNull.Value);
            cmd.Parameters.AddWithValue("@ApprovedBy_SC_ID",  h.ApprovedBy_SC_ID.HasValue  ? (object)h.ApprovedBy_SC_ID.Value  : DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
        }

        /// <summary>
        /// Looks up SC_ID by full name "FirstName LastName" from STOCK CONTROLLER.
        /// The original code had a missing '(' — this is the corrected version.
        /// </summary>
        private static async Task<int?> ResolveStaffIdByNameAsync(string? rawName, NpgsqlConnection conn)
        {
            if (string.IsNullOrWhiteSpace(rawName) || rawName == "System Auto" || rawName == "N/A")
                return null;

            // Fixed: was missing opening '(' after CONCAT
            const string query = @"
                SELECT ""SC_ID""
                FROM public.""STOCK CONTROLLER""
                WHERE TRIM(CONCAT(""FirstName"", ' ', ""LastName"")) = @Name
                LIMIT 1;";

            using var cmd = new NpgsqlCommand(query, conn);
            cmd.Parameters.AddWithValue("@Name", rawName.Trim());
            var res = await cmd.ExecuteScalarAsync();
            return (res != null && res != DBNull.Value) ? Convert.ToInt32(res) : null;
        }

        /// <summary>
        /// Returns the first non-blank candidate name, falling back to defaultValue.
        /// </summary>
        private static string ResolveDisplayName(string? joinedName, string? rawName, string defaultValue)
        {
            if (!string.IsNullOrWhiteSpace(joinedName)) return joinedName;
            if (!string.IsNullOrWhiteSpace(rawName))    return rawName;
            return defaultValue;
        }

        /// <summary>Returns a "yyyy-MM-dd HH:mm:ss" timestamp in Philippine time (UTC+8).</summary>
        private string GetPhilippineTimestamp()
        {
            return TimeZoneInfo
                .ConvertTimeFromUtc(DateTime.UtcNow, PhilippineTime)
                .ToString("yyyy-MM-dd HH:mm:ss");
        }
    }
}