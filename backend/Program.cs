var builder = WebApplication.CreateBuilder(args);

// 1. Tell C# you are building data controllers (APIs)
builder.Services.AddControllers();

// 2. Open up permissions so your local browser doesn't block incoming data
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500") // Default Live Server ports
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// 3. Activate routing, security checkpoints, and permissions
app.UseRouting();
app.UseCors("AllowFrontend");
app.UseAuthorization();

// 4. Map requests to your upcoming controller folders
app.MapControllers();

app.Run();