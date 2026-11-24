using System.Text.Json;
using CompanySkills.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace CompanySkills.Tests;

/// <summary>
/// One Postgres container for the whole test run. The schema is built through the
/// migrations, so the tests cover them too.
/// </summary>
public class DatabaseFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:18").Build();

    public string ConnectionString => _container.GetConnectionString();

    /// <summary>The JSON settings of the API, for reading responses into the app's records.</summary>
    public JsonSerializerOptions ApiJsonOptions { get; } = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    /// <summary>The app, pointed at the test database.</summary>
    public WebApplicationFactory<Program> Api { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        await using var db = CreateContext();
        await db.Database.MigrateAsync();
        Api = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.UseSetting("ConnectionStrings:Default", ConnectionString));
    }

    public async Task DisposeAsync()
    {
        await Api.DisposeAsync();
        await _container.DisposeAsync();
    }

    public AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options);
}

[CollectionDefinition(Name)]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture>
{
    public const string Name = "database";
}

/// <summary>
/// Base for tests that talk to the database: every test runs in a transaction
/// that is rolled back afterwards, like the session fixture in the Python tests.
/// </summary>
[Collection(DatabaseCollection.Name)]
public abstract class DatabaseTest(DatabaseFixture fixture) : IAsyncLifetime
{
    protected AppDbContext Db { get; } = fixture.CreateContext();

    public Task InitializeAsync() => Db.Database.BeginTransactionAsync();

    public async Task DisposeAsync()
    {
        await Db.Database.RollbackTransactionAsync();
        await Db.DisposeAsync();
    }

    /// <summary>Random suffix, so test data never collides.</summary>
    protected static string Unique(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    /// <summary>Saves and returns the name of the constraint that the database rejected.</summary>
    protected async Task<string?> SaveAndGetViolatedConstraint()
    {
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
        return Assert.IsType<Npgsql.PostgresException>(error.InnerException).ConstraintName;
    }
}
