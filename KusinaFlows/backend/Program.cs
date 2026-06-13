var builder = WebApplication.CreateBuilder(args);

// 1. ADD SERVICES TO THE CONTAINER (Must be ABOVE builder.Build())
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// Register the Authorization Services (THIS FIXES YOUR CRASH)
builder.Services.AddAuthorization();

// Add your CORS policy configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

// Register your custom Neon database service wrapper
builder.Services.AddSingleton<KusinaFlows.Services.DatabaseService>();

// ==========================================================
var app = builder.Build(); // The boundary line
// ==========================================================

// 2. CONFIGURE THE HTTP REQUEST PIPELINE (Must be BELOW builder.Build())
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

// Order matters here: Activate CORS first, then Authorization, then map endpoints
app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();