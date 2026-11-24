using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using CompanySkills.Employees;

namespace CompanySkills.Tests;

/// <summary>Port of backend-spring SkillAssignmentControllerTests.</summary>
public class SkillAssignmentTests(DatabaseFixture fixture) : IntegrationTest(fixture)
{
    private Task<HttpResponseMessage> Bulk(IEnumerable<Guid> employeeIds, Guid skillId, int level,
        string? onConflict = null)
    {
        var json = new JsonObject
        {
            ["employee_ids"] = new JsonArray(employeeIds.Select(id => (JsonNode)id.ToString()).ToArray()),
            ["skill_id"] = skillId,
            ["proficiency_level"] = level,
        }.ToJsonString();
        var query = onConflict is null ? "" : $"?on_conflict={onConflict}";
        return Client.PostAsync($"/skill-assignments/bulk{query}", new StringContent(json, Encoding.UTF8, "application/json"));
    }

    private static Guid[] Ids(params Employee[] employees) => employees.Select(e => e.Id).ToArray();

    private static async Task AssertResult(HttpResponseMessage response, Guid[] created, Guid[] updated, Guid[] skipped)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await Json(response);
        List<string?> Names(Guid[] ids) => ids.Select(id => (string?)id.ToString()).ToList();
        List<string?> Values(string key) => body[key]!.AsArray().Select(n => (string?)n).ToList();
        Assert.Equal(Names(created), Values("created"));
        Assert.Equal(Names(updated), Values("updated"));
        Assert.Equal(Names(skipped), Values("skipped"));
    }

    [Fact]
    public async Task Bulk_creates_an_assignment_for_each_employee()
    {
        var skill = await AddSkill("skill");
        var first = await AddEmployee();
        var second = await AddEmployee();

        await AssertResult(await Bulk(Ids(first, second), skill.Id, 3), Ids(first, second), [], []);

        Assert.Equal(new() { [skill.Id] = 3 }, await StoredLevels(first));
        Assert.Equal(new() { [skill.Id] = 3 }, await StoredLevels(second));
    }

    [Fact]
    public async Task Bulk_skips_existing_levels_by_default()
    {
        var skill = await AddSkill("skill");
        var hasSkill = await AddEmployee(new() { [skill] = 5 });
        var newcomer = await AddEmployee();

        await AssertResult(await Bulk(Ids(hasSkill, newcomer), skill.Id, 2), Ids(newcomer), [], Ids(hasSkill));

        Assert.Equal(new() { [skill.Id] = 5 }, await StoredLevels(hasSkill));
        Assert.Equal(new() { [skill.Id] = 2 }, await StoredLevels(newcomer));
    }

    [Fact]
    public async Task Bulk_overwrites_existing_levels_on_request()
    {
        var skill = await AddSkill("skill");
        var hasSkill = await AddEmployee(new() { [skill] = 5 });
        var newcomer = await AddEmployee();

        await AssertResult(await Bulk(Ids(hasSkill, newcomer), skill.Id, 2, "overwrite"),
            Ids(newcomer), Ids(hasSkill), []);

        Assert.Equal(new() { [skill.Id] = 2 }, await StoredLevels(hasSkill));
    }

    [Fact]
    public async Task Bulk_processes_a_repeated_employee_once()
    {
        var skill = await AddSkill("skill");
        var employee = await AddEmployee();

        await AssertResult(await Bulk(Ids(employee, employee), skill.Id, 3), Ids(employee), [], []);

        Assert.Equal(new() { [skill.Id] = 3 }, await StoredLevels(employee));
    }

    [Fact]
    public async Task Bulk_with_unknown_skill_is_404()
    {
        var employee = await AddEmployee();

        Assert.Equal(HttpStatusCode.NotFound, (await Bulk(Ids(employee), Guid.NewGuid(), 3)).StatusCode);
        Assert.Empty(await StoredLevels(employee));
    }

    [Fact]
    public async Task Bulk_with_soft_deleted_skill_is_404()
    {
        var deleted = await AddSkill("deleted", deleted: true);
        var employee = await AddEmployee();

        Assert.Equal(HttpStatusCode.NotFound, (await Bulk(Ids(employee), deleted.Id, 3)).StatusCode);
        Assert.Empty(await StoredLevels(employee));
    }

    [Fact]
    public async Task Bulk_with_unknown_employee_is_404_and_writes_nothing()
    {
        var skill = await AddSkill("skill");
        var employee = await AddEmployee();
        var deleted = await AddEmployee(deleted: true);

        var response = await Bulk(Ids(employee, deleted), skill.Id, 3);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains(deleted.Id.ToString(), (string)(await Json(response))["detail"]!);
        Assert.Empty(await StoredLevels(employee));
    }

    [Fact]
    public async Task Bulk_with_invalid_input_is_422()
    {
        var skill = await AddSkill("skill");
        var employee = await AddEmployee();

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Bulk([], skill.Id, 3)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Bulk(Ids(employee), skill.Id, 6)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Bulk(Ids(employee), skill.Id, 3, "merge")).StatusCode);
        Assert.Empty(await StoredLevels(employee));
    }
}
