using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using CompanySkills.Skills;

namespace CompanySkills.Tests;

/// <summary>
/// Spec for round 4 (written by the user): GET /employees.
/// Port of backend-spring EmployeeControllerTests.
/// </summary>
public class EmployeeSearchTests(DatabaseFixture fixture) : IntegrationTest(fixture)
{
    private Task AddPerson(string firstname, string lastname = "Muster", Dictionary<Skill, int>? skills = null,
        bool deleted = false) =>
        AddEmployee(skills, deleted, firstname, $"{firstname}.{lastname}@example.com".ToLowerInvariant(), lastname);

    private async Task<JsonArray> Search(string query = "")
    {
        var response = await Client.GetAsync($"/employees{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await Json(response)).AsArray();
    }

    private async Task<List<string?>> Firstnames(string query = "") => Strings(await Search(query), "firstname");

    [Fact]
    public async Task Without_parameters_returns_all_active_employees_sorted_by_name_ignoring_case()
    {
        await AddPerson("Zoe", "Adler");
        await AddPerson("Ben", "Zimmer");
        await AddPerson("anna", "Adler");
        await AddPerson("Gone", "Adler", deleted: true);

        Assert.Equal(["anna", "Zoe", "Ben"], await Firstnames());
    }

    [Fact]
    public async Task Employee_carries_own_data_and_skills_sorted_by_level()
    {
        var low = await AddSkill("low", alias: "lo");
        var high = await AddSkill("high");
        await AddPerson("Max", skills: new() { [low] = 2, [high] = 5 });

        var body = await Search();

        var id = (string)body[0]!["id"]!;
        var expected = JsonNode.Parse($$"""
            [{
              "id": "{{id}}",
              "firstname": "Max",
              "lastname": "Muster",
              "email": "max.muster@example.com",
              "age": 30,
              "skills": [
                {"skill_id": "{{high.Id}}", "name": "high", "alias": null, "proficiency_level": 5, "matched": false},
                {"skill_id": "{{low.Id}}", "name": "low", "alias": "lo", "proficiency_level": 2, "matched": false}
              ]
            }]
            """);
        Assert.True(JsonNode.DeepEquals(expected, body), body.ToJsonString());
    }

    [Fact]
    public async Task Employee_without_skills_has_an_empty_skill_list()
    {
        await AddPerson("Max");

        Assert.Empty((await Search())[0]!["skills"]!.AsArray());
    }

    [Fact]
    public async Task Skills_with_the_same_level_are_sorted_by_name_ignoring_case()
    {
        await AddPerson("Max", skills: new()
        {
            [await AddSkill("b-skill")] = 3,
            [await AddSkill("A-skill")] = 3,
            [await AddSkill("z-skill")] = 5,
            [await AddSkill("c-skill")] = 3,
        });

        Assert.Equal(["z-skill", "A-skill", "b-skill", "c-skill"], Strings((await Search())[0]!["skills"], "name"));
    }

    // Email of Maximilian is maximilian.mustermann@example.com
    [Theory]
    [InlineData("maxi")]
    [InlineData("STERM")]
    [InlineData("milian.must")]
    [InlineData("mil musterm")]
    public async Task Q_matches_substrings_of_firstname_lastname_and_email(string q)
    {
        await AddPerson("Maximilian", "Mustermann");
        await AddPerson("Erika", "Beispiel");

        Assert.Equal(["Maximilian"], await Firstnames($"?q={Uri.EscapeDataString(q)}"));
    }

    [Fact]
    public async Task Every_word_in_q_must_match()
    {
        await AddPerson("Maximilian", "Mustermann");
        await AddPerson("Erika", "Beispiel");

        // With OR between the words, both employees would be returned
        Assert.Empty(await Firstnames("?q=maxi%20beispiel"));
    }

    [Fact]
    public async Task Blank_q_returns_all_active_employees()
    {
        await AddPerson("Max");

        Assert.Equal(["Max"], await Firstnames("?q=%20%20%20"));
    }

    [Fact]
    public async Task Wildcard_characters_in_q_are_matched_literally()
    {
        await AddPerson("Max");

        Assert.Empty(await Firstnames("?q=M_x"));
        Assert.Empty(await Firstnames("?q=M%25"));
    }

    [Fact]
    public async Task Skill_term_is_an_exact_case_insensitive_match_on_name_or_alias()
    {
        await AddPerson("Plain", skills: new() { [await AddSkill("C")] = 3 });
        await AddPerson("Sharp", skills: new() { [await AddSkill("C#", alias: "csharp")] = 3 });

        Assert.Equal(["Plain"], await Firstnames("?skills=c"));
        Assert.Equal(["Sharp"], await Firstnames("?skills=CSHARP"));
    }

    [Fact]
    public async Task Star_is_a_wildcard_and_like_characters_are_literal()
    {
        await AddPerson("Plain", skills: new() { [await AddSkill("C")] = 3 });
        await AddPerson("Sharp", skills: new() { [await AddSkill("C#")] = 3 });

        Assert.Equal(["Plain", "Sharp"], await Firstnames("?skills=c*"));
        Assert.Empty(await Firstnames("?skills=c%25"));
        Assert.Empty(await Firstnames("?skills=c_"));
    }

    [Fact]
    public async Task Skill_match_and_requires_every_term_or_only_one()
    {
        var python = await AddSkill("python");
        var docker = await AddSkill("docker");
        await AddPerson("Both", skills: new() { [python] = 3, [docker] = 3 });
        await AddPerson("Docker", skills: new() { [docker] = 3 });
        await AddPerson("None");

        Assert.Equal(["Both"], await Firstnames("?skills=python&skills=docker"));
        Assert.Equal(["Both", "Docker"], await Firstnames("?skills=python&skills=docker&skill_match=or"));
    }

    [Fact]
    public async Task Min_level_applies_to_every_skill_term()
    {
        var python = await AddSkill("python");
        var docker = await AddSkill("docker");
        await AddPerson("Expert", skills: new() { [python] = 4, [docker] = 5 });
        await AddPerson("Mixed", skills: new() { [python] = 4, [docker] = 2 });

        Assert.Equal(["Expert"], await Firstnames("?skills=python&skills=docker&min_level=4"));
        Assert.Equal(["Expert", "Mixed"], await Firstnames("?skills=python&skills=docker&min_level=4&skill_match=or"));
    }

    [Fact]
    public async Task Min_level_without_skills_needs_one_skill_at_that_level()
    {
        var python = await AddSkill("python");
        await AddPerson("Senior", skills: new() { [python] = 4 });
        await AddPerson("Junior", skills: new() { [python] = 3 });
        await AddPerson("None");

        Assert.Equal(["Senior"], await Firstnames("?min_level=4"));
    }

    [Fact]
    public async Task Q_and_skills_are_combined_with_and()
    {
        var python = await AddSkill("python");
        await AddPerson("Max", skills: new() { [python] = 3 });
        await AddPerson("Erika", skills: new() { [python] = 3 });
        await AddPerson("Maximus");

        Assert.Equal(["Max"], await Firstnames("?q=max&skills=python"));
    }

    [Fact]
    public async Task Matched_marks_the_skills_that_satisfy_the_search()
    {
        await AddPerson("Max", skills: new()
        {
            [await AddSkill("python")] = 5,
            [await AddSkill("docker")] = 2,
            [await AddSkill("java")] = 4,
        });

        var skills = (await Search("?skills=python&skills=docker&skill_match=or&min_level=3"))[0]!["skills"]!.AsArray();

        // Skills are sorted by level: python 5, java 4, docker 2
        Assert.Equal(["python", "java", "docker"], Strings(skills, "name"));
        Assert.Equal([true, false, false], skills.Select(s => (bool)s!["matched"]!));
    }

    [Fact]
    public async Task Soft_deleted_skills_are_not_searched()
    {
        await AddPerson("Max", skills: new() { [await AddSkill("gone", deleted: true)] = 3 });

        Assert.Empty(await Firstnames("?skills=gone"));
    }

    [Fact]
    public async Task Soft_deleted_skills_are_not_returned()
    {
        await AddPerson("Max", skills: new()
        {
            [await AddSkill("active")] = 2,
            [await AddSkill("gone", deleted: true)] = 5,
        });

        Assert.Equal(["active"], Strings((await Search())[0]!["skills"], "name"));
    }

    [Theory]
    [InlineData("min_level=0")]
    [InlineData("min_level=6")]
    [InlineData("min_level=high")]
    [InlineData("skill_match=xor")]
    public async Task Invalid_parameters_are_rejected(string query)
    {
        var response = await Client.GetAsync($"/employees?{query}");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task Imported_employees_appear_in_the_overview()
    {
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes("lastname,firstname,email,age\nMuster,Max,max@x.io,30\n"));
        await Client.PostAsync("/employees/import", new MultipartFormDataContent { { file, "file", "employees.csv" } });

        var body = await Search("?q=max@x.io");

        Assert.Equal(["Max"], Strings(body, "firstname"));
        Assert.Empty(body[0]!["skills"]!.AsArray());
    }
}
