using Microsoft.AspNetCore.Mvc;
using Npgsql;
using KusinaFlows.Services;

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

            try
            {
                using (var conn = _dbService.GetConnection())
                {
                    conn.Open();

                    // Query our STOCK CONTROLLER table using escaped quotes to handle the spaces cleanly
                    string sql = @"
                        SELECT ""SC_ID"", ""Username"", ""Password"", ""FirstName"" 
                        FROM public.""STOCK CONTROLLER"" 
                        WHERE ""Username"" = @Username;";

                    using (var cmd = new NpgsqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@Username", request.Username);

                        using (var reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                int scId = reader.GetInt32(0);
                                string dbUsername = reader.GetString(1);
                                string dbPassword = reader.GetString(2);
                                string firstName = reader.GetString(3);

                                // Check password (plain text match for now)
                                if (request.Password == dbPassword)
                                {
                                    return Ok(new {
                                        status = "Success",
                                        message = $"Maligayang pagbabalik, {firstName}!",
                                        username = dbUsername,
                                        userId = scId
                                    });
                                }
                            }
                        }
                    }
                }

                return Unauthorized(new { message = "Maling username o password." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "System authentication barrier encountered.", error = ex.Message });
            }
        }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}