using Microsoft.AspNetCore.Mvc;
using Npgsql;
using KusinaFlows.Services;
using System;

namespace KusinaFlows.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly DatabaseService _dbService;

        public AuthController(DatabaseService dbService)
        {
            _dbService = dbService;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { message = "All login fields are required." });
            }

            // Declare tracking variables in the method scope
            string? dbUsername = null;
            string? dbPassword = null;
            string? firstName = null;
            string? lastName = null;   
            string? position = null;   
            int? scId = null;
            bool isActive = true; // Safety tracking flag initialized to true

            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    conn.Open();

                    // 🎯 SECURED: Added the missing "Active" column tracking flag to the SQL query
                    string sql = @"
                        SELECT ""SC_ID"", ""Username"", ""Password"", ""FirstName"", ""LastName"", ""Position"", ""Active""
                        FROM public.""STOCK CONTROLLER"" 
                        WHERE LOWER(""Username"") = LOWER(@Username);"; 

                    using (var cmd = new NpgsqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@Username", request.Username);

                        using (var reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                scId = reader.GetInt32(0);
                                dbUsername = reader.GetString(1);
                                dbPassword = reader.GetString(2);
                                firstName = reader.GetString(3);
                                lastName = reader.IsDBNull(4) ? "" : reader.GetString(4);  
                                position = reader.IsDBNull(5) ? "Staff" : reader.GetString(5); 
                                isActive = reader.IsDBNull(6) ? true : reader.GetBoolean(6); // 🎯 Maps row cell 6 directly to the boolean tracker
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "System authentication barrier encountered.", error = ex.Message });
            }

            // Evaluate Username Existence
            if (string.IsNullOrEmpty(dbUsername))
            {
                return NotFound(new { message = "Unknown Username" });
            }

            // Evaluate Password Match Integrity
            if (dbPassword != request.Password)
            {
                return Unauthorized(new { message = "Wrong Password" });
            }

            // 🔒 SECURITY INTERCEPT LAYER: Block access if administrative status is false
            if (!isActive)
            {
                return StatusCode(403, new { message = "Can't Logged in" });
            }

            // Authenticated successfully! Compile the payload profile object
            return Ok(new {
                status = "Success",
                message = $"Maligayang pagbabalik, {firstName}!",
                user = new {
                    userId = scId,
                    username = dbUsername,
                    firstName = firstName,
                    lastName = lastName,
                    position = position, // Contains account structural roles: "Owner", "Manager", or "Staff"
                    active = isActive    // Serialized value read cleanly by the browser interface
                }
            });
        }

        public class LoginRequest
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        public class LoginDto
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }
    }
}