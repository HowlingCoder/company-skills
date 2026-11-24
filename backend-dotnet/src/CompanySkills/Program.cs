using System.Text.Json;
using CompanySkills.Assignments;
using CompanySkills.Data;
using CompanySkills.Employees;
using CompanySkills.Skills;
using CompanySkills.Web;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // The API contract uses snake_case (skill_id, proficiency_level), like the other backends
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
    // A missing field or null for a non-nullable one is invalid input, not a silent default
    options.SerializerOptions.RespectRequiredConstructorParameters = true;
    options.SerializerOptions.RespectNullableAnnotations = true;
});

// Input that cannot be bound throws, so BadRequestExceptionHandler can answer 422
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<BadRequestExceptionHandler>();

// Resolved per request, so tests can point ConnectionStrings:Default at their own database
builder.Services.AddDbContext<AppDbContext>((services, options) =>
    options.UseNpgsql(services.GetRequiredService<IConfiguration>().GetConnectionString("Default")));
builder.Services.AddScoped<SkillSeeder>();

var app = builder.Build();

app.UseExceptionHandler();

// Liveness check, no database access.
app.MapGet("/health", () => new HealthResponse("ok"));
app.MapSkillEndpoints();
app.MapEmployeeSearchEndpoints();
app.MapEmployeeImportEndpoints();
app.MapEmployeeSkillsEndpoints();
app.MapSkillAssignmentEndpoints();

// Optional: apply the migrations on startup (the Docker image does), creates the database if missing
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
}

// Optional: seed the skill catalog on startup (inserts only, safe to repeat), e.g.
//   dotnet run --project src/CompanySkills -- --Skills:SeedFile=../backend/data/skills.csv
if (app.Configuration["Skills:SeedFile"] is { Length: > 0 } seedFile)
{
    using var scope = app.Services.CreateScope();
    var result = await scope.ServiceProvider.GetRequiredService<SkillSeeder>().SeedAsync(seedFile);
    app.Logger.LogInformation("Seed: inserted {Inserted} skills, {AlreadyPresent} already present",
        result.Inserted, result.AlreadyPresent);
}

await app.RunAsync();

internal record HealthResponse(string Status);

// Makes the entry point visible to WebApplicationFactory in the test project.
public partial class Program;
