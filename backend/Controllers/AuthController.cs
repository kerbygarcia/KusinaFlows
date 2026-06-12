using Microsoft.AspNetCore.Mvc;
using Npgsql;
using KusinaFlows.Services;
using System;
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

            // 1. Declare variables in the method scope so they survive outside the try block
            string? dbUsername = null;
            string? dbPassword = null;
            string? firstName = null;
            int? scId = null;

            // 1. Declare variables in the method scope so they survive outside the try block
            string? dbUsername = null;
            string? dbPassword = null;
            string? firstName = null;
            int? scId = null;

            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    conn.Open();

                    string sql = @"
                        SELECT ""SC_ID"", ""Username"", ""Password"", ""FirstName"" 
                        FROM public.""STOCK CONTROLLER"" 
                        WHERE LOWER(""Username"") = LOWER(@Username);"; // LOWER ensures case-insensitive search
                        WHERE LOWER(""Username"") = LOWER(@Username);"; // LOWER ensures case-insensitive search

                    using (var cmd = new NpgsqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@Username", request.Username);

                        using (var reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                // Assign values to variables outside the block
                                scId = reader.GetInt32(0);
                                dbUsername = reader.GetString(1);
                                dbPassword = reader.GetString(2);
                                firstName = reader.GetString(3);
                            }
                        }
                    }
                }
                                // Assign values to variables outside the block
                                scId = reader.GetInt32(0);
                                dbUsername = reader.GetString(1);
                                dbPassword = reader.GetString(2);
                                firstName = reader.GetString(3);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "System authentication barrier encountered.", error = ex.Message });
            }

            // 2. Evaluate Step-by-Step Security States (Now perfectly reachable!)

            // Step 1: If dbUsername remains null, the database found no matching record
            if (string.IsNullOrEmpty(dbUsername))
            {
                return NotFound(new { message = "Unknown Username" });
            }

            // Step 2: Username matched, now check if plain text password matches
            if (dbPassword != request.Password)
            {
                return Unauthorized(new { message = "Wrong Password" });
            }

            // Step 3: Success! Everything balances out beautifully
            return Ok(new {
                status = "Success",
                message = $"Welcome Back, {firstName}!",
                username = dbUsername,
                userId = scId
            });

            // 2. Evaluate Step-by-Step Security States (Now perfectly reachable!)

            // Step 1: If dbUsername remains null, the database found no matching record
            if (string.IsNullOrEmpty(dbUsername))
            {
                return NotFound(new { message = "Unknown Username" });
            }

            // Step 2: Username matched, now check if plain text password matches
            if (dbPassword != request.Password)
            {
                return Unauthorized(new { message = "Wrong Password" });
            }

            // Step 3: Success! Everything balances out beautifully
            return Ok(new {
                status = "Success",
                message = $"Welcome Back, {firstName}!",
                username = dbUsername,
                userId = scId
            });
        }
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

    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
