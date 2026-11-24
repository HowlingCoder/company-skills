using System.Net.Http.Json;
using System.Text.Json.Nodes;
using CompanySkills.Assignments;
using CompanySkills.Data;
using CompanySkills.Employees;
using CompanySkills.Skills;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Tests;

/// <summary>
/// Base for tests that call the API. Requests run in the app's own DbContext, so a
/// rollback like in <see cref="DatabaseTest"/> is not possible: the tables are emptied
/// before each test instead. Tests of the collection run one after another.
/// </summary>
[Collection(DatabaseCollection.Name)]
public abstract class IntegrationTest(DatabaseFixture fixture) : IAsyncLifetime
{
    protected DatabaseFixture Fixture { get; } = fixture;
    protected HttpClient Client { get; } = fixture.Api.CreateClient();

    public async Task InitializeAsync()
    {
        await using var db = Fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("truncate skill_assignment, employee, skill");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    protected async Task<Skill> AddSkill(string name, string? alias = null, string? description = null,
        bool deleted = false)
    {
        await using var db = Fixture.CreateContext();
        var skill = new Skill
        {
            Name = name,
            Alias = alias,
            Description = description,
            DeletedAt = deleted ? DateTimeOffset.UtcNow : null,
        };
        db.Skills.Add(skill);
        await db.SaveChangesAsync();
        return skill;
    }

    protected async Task<Employee> AddEmployee(Dictionary<Skill, int>? skills = null, bool deleted = false,
        string firstname = "Max", string? email = null)
    {
        await using var db = Fixture.CreateContext();
        var employee = new Employee
        {
            Firstname = firstname,
            Lastname = "Muster",
            Email = email ?? $"{Guid.NewGuid()}@example.com",
            Age = 30,
            DeletedAt = deleted ? DateTimeOffset.UtcNow : null,
            SkillAssignments = (skills ?? []).Select(pair =>
                new SkillAssignment { SkillId = pair.Key.Id, ProficiencyLevel = pair.Value }).ToList(),
        };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();
        return employee;
    }

    /// <summary>Assignments as they are in the database: skill id -> level.</summary>
    protected async Task<Dictionary<Guid, int>> StoredLevels(Employee employee)
    {
        await using var db = Fixture.CreateContext();
        return await db.SkillAssignments
            .Where(a => a.EmployeeId == employee.Id)
            .ToDictionaryAsync(a => a.SkillId, a => a.ProficiencyLevel);
    }

    protected static async Task<JsonNode> Json(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonNode>())!;

    protected static List<string?> Strings(JsonNode? array, string property) =>
        array!.AsArray().Select(item => (string?)item![property]).ToList();
}
