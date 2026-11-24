using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using CompanySkills.Employees;

namespace CompanySkills.Tests;

/// <summary>Port of backend-spring EmployeeSkillsControllerTests.</summary>
public class EmployeeSkillsTests(DatabaseFixture fixture) : IntegrationTest(fixture)
{
    private Task<HttpResponseMessage> PutSkills(Guid employeeId, params (Guid SkillId, int Level)[] levels) =>
        PutBody(employeeId, new JsonObject
        {
            ["skills"] = new JsonArray(levels.Select(l => (JsonNode)new JsonObject
            {
                ["skill_id"] = l.SkillId,
                ["proficiency_level"] = l.Level,
            }).ToArray()),
        }.ToJsonString());

    private Task<HttpResponseMessage> PutBody(Guid employeeId, string json) =>
        Client.PutAsync($"/employees/{employeeId}/skills", new StringContent(json, Encoding.UTF8, "application/json"));

    [Fact]
    public async Task Put_adds_changes_and_removes_in_one_request()
    {
        var kept = await AddSkill("kept");
        var removed = await AddSkill("removed");
        var added = await AddSkill("added", alias: "new");
        var employee = await AddEmployee(new() { [kept] = 2, [removed] = 3 });

        var response = await PutSkills(employee.Id, (kept.Id, 5), (added.Id, 1));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<EmployeeResponse>(Fixture.ApiJsonOptions);
        Assert.Equal(employee.Id, body!.Id);
        Assert.Equal(
        [
            new EmployeeSkillResponse(kept.Id, "kept", null, 5, false),
            new EmployeeSkillResponse(added.Id, "added", "new", 1, false),
        ], body.Skills);
        Assert.Equal(new() { [kept.Id] = 5, [added.Id] = 1 }, await StoredLevels(employee));
    }

    [Fact]
    public async Task Put_with_empty_list_removes_all_skills()
    {
        var employee = await AddEmployee(new() { [await AddSkill("skill")] = 2 });

        var response = await PutSkills(employee.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await Json(response))["skills"]!.AsArray());
        Assert.Empty(await StoredLevels(employee));
    }

    [Fact]
    public async Task Put_does_not_touch_other_employees()
    {
        var skill = await AddSkill("skill");
        var employee = await AddEmployee(new() { [skill] = 2 });
        var other = await AddEmployee(new() { [skill] = 4 });

        Assert.Equal(HttpStatusCode.OK, (await PutSkills(employee.Id)).StatusCode);

        Assert.Equal(new() { [skill.Id] = 4 }, await StoredLevels(other));
    }

    [Fact]
    public async Task Put_keeps_assignments_of_soft_deleted_skills()
    {
        var hidden = await AddSkill("hidden", deleted: true);
        var employee = await AddEmployee(new() { [hidden] = 3 });

        var response = await PutSkills(employee.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await Json(response))["skills"]!.AsArray());
        Assert.Equal(new() { [hidden.Id] = 3 }, await StoredLevels(employee));
    }

    [Fact]
    public async Task Put_for_unknown_employee_is_404()
    {
        var skill = await AddSkill("skill");

        Assert.Equal(HttpStatusCode.NotFound, (await PutSkills(Guid.NewGuid(), (skill.Id, 3))).StatusCode);
    }

    [Fact]
    public async Task Put_for_soft_deleted_employee_is_404()
    {
        var skill = await AddSkill("skill");
        var employee = await AddEmployee(deleted: true);

        Assert.Equal(HttpStatusCode.NotFound, (await PutSkills(employee.Id, (skill.Id, 3))).StatusCode);
        Assert.Empty(await StoredLevels(employee));
    }

    [Fact]
    public async Task Put_with_unknown_skill_is_404_and_writes_nothing()
    {
        var existing = await AddSkill("existing");
        var added = await AddSkill("new");
        var employee = await AddEmployee(new() { [existing] = 2 });
        var unknown = Guid.NewGuid();

        var response = await PutSkills(employee.Id, (added.Id, 4), (unknown, 3));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains(unknown.ToString(), (string)(await Json(response))["detail"]!);
        Assert.Equal(new() { [existing.Id] = 2 }, await StoredLevels(employee));
    }

    [Fact]
    public async Task Put_with_soft_deleted_skill_is_404()
    {
        var deleted = await AddSkill("deleted", deleted: true);
        var employee = await AddEmployee();

        Assert.Equal(HttpStatusCode.NotFound, (await PutSkills(employee.Id, (deleted.Id, 3))).StatusCode);
        Assert.Empty(await StoredLevels(employee));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public async Task Put_with_level_out_of_range_is_422(int level)
    {
        var skill = await AddSkill("skill");
        var employee = await AddEmployee(new() { [skill] = 2 });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await PutSkills(employee.Id, (skill.Id, level))).StatusCode);
        Assert.Equal(new() { [skill.Id] = 2 }, await StoredLevels(employee));
    }

    [Fact]
    public async Task Put_with_same_skill_twice_is_422()
    {
        var skill = await AddSkill("skill");
        var employee = await AddEmployee();

        var response = await PutSkills(employee.Id, (skill.Id, 3), (skill.Id, 3));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Empty(await StoredLevels(employee));
    }

    [Theory]
    [InlineData("""{"skills": [{"skill_id": "not-a-uuid", "proficiency_level": 3}]}""")]
    [InlineData("""{"skills": [{"skill_id": "6f1c5e1e-0000-4000-8000-000000000000"}]}""")]
    [InlineData("""{"skills": [null]}""")]
    [InlineData("""{"skills": null}""")]
    [InlineData("{}")]
    [InlineData("not json")]
    public async Task Put_with_malformed_body_is_422(string json)
    {
        var employee = await AddEmployee();

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await PutBody(employee.Id, json)).StatusCode);
    }

    [Fact]
    public async Task Put_with_malformed_employee_id_is_422()
    {
        var response = await PutBody(Guid.Empty, "{}");
        var malformed = await Client.PutAsync("/employees/not-a-uuid/skills",
            new StringContent("""{"skills": []}""", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, malformed.StatusCode);
    }
}
