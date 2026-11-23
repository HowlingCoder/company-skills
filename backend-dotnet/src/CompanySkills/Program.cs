using System.Text.Json;
using CompanySkills.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// The API contract uses snake_case (skill_id, proficiency_level), like the other backends.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

// Liveness check, no database access.
app.MapGet("/health", () => new HealthResponse("ok"));

app.Run();

internal record HealthResponse(string Status);

// Makes the entry point visible to WebApplicationFactory in the test project.
public partial class Program;
