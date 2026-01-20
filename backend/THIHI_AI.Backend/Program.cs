using THIHI_AI.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Đăng ký HttpClient cho các services
builder.Services.AddHttpClient<VectorImportService>();
builder.Services.AddHttpClient<VectorSearchService>();

// Đăng ký Services
builder.Services.AddScoped<VectorImportService>();
builder.Services.AddScoped<VectorSearchService>();
builder.Services.AddScoped<PdfProcessingService>();

// Cấu hình CORS cho frontend Angular (http://localhost:4200)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularDevClient", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Thêm Controllers
builder.Services.AddControllers();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Chỉ dùng HTTPS redirection khi có HTTPS endpoint được cấu hình
// Khi chạy với profile "http" (chỉ port 5000), bỏ qua để tránh lỗi redirect
var urls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? 
           app.Configuration["Urls"] ?? 
           app.Configuration["applicationUrl"] ?? "";
if (urls.Contains("https://", StringComparison.OrdinalIgnoreCase))
{
    app.UseHttpsRedirection();
}

// Bật CORS
app.UseCors("AllowAngularDevClient");

// Map Controllers
app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
