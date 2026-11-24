using System.Net;
using System.Text.Json.Nodes;

namespace CompanySkills.Tests;

/// <summary>Port of backend-spring SkillControllerTests.</summary>
public class SkillEndpointTests(DatabaseFixture fixture) : IntegrationTest(fixture)
{
    private async Task<List<string?>> SkillNames(string query) =>
        Strings(await Json(await Client.GetAsync($"/skills{query}")), "name");

    [Fact]
    public async Task Without_q_returns_all_active_skills_sorted_by_name_ignoring_case()
    {
        await AddSkill("B-sort");
        await AddSkill("a-sort");
        await AddSkill("c-sort");

        var response = await Client.GetAsync("/skills");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["a-sort", "B-sort", "c-sort"], Strings(await Json(response), "name"));
    }

    [Fact]
    public async Task Response_contains_only_the_catalog_fields()
    {
        var skill = await AddSkill("fields", "fl", "A test skill");

        var body = await Json(await Client.GetAsync("/skills?q=fields"));

        var expected = JsonNode.Parse($$"""
            [{"id": "{{skill.Id}}", "name": "fields", "alias": "fl", "description": "A test skill"}]
            """);
        Assert.True(JsonNode.DeepEquals(expected, body), body.ToJsonString());
    }

    [Fact]
    public async Task Q_matches_a_substring_of_the_name_case_insensitively()
    {
        await AddSkill("JavaScript");

        Assert.Equal(["JavaScript"], await SkillNames("?q=VAscr"));
    }

    [Fact]
    public async Task Q_matches_the_alias()
    {
        await AddSkill("Kubernetes", "K8s");

        Assert.Equal(["Kubernetes"], await SkillNames("?q=k8s"));
    }

    [Fact]
    public async Task Q_is_trimmed()
    {
        await AddSkill("Kubernetes");

        Assert.Equal(["Kubernetes"], await SkillNames("?q=%20%20kube%20%20"));
    }

    [Fact]
    public async Task Soft_deleted_skills_are_not_returned()
    {
        await AddSkill("active-deleted");
        await AddSkill("gone-deleted", deleted: true);

        Assert.Equal(["active-deleted"], await SkillNames("?q=deleted"));
    }

    [Fact]
    public async Task Wildcard_characters_in_q_are_matched_literally()
    {
        foreach (var name in new[] { "100%done", "100xdone", "under_score", "underxscore", @"back\slash", "backxslash" })
        {
            await AddSkill(name);
        }

        Assert.Equal(["100%done"], await SkillNames("?q=" + Uri.EscapeDataString("%done")));
        Assert.Equal(["under_score"], await SkillNames("?q=_score"));
        Assert.Equal([@"back\slash"], await SkillNames("?q=" + Uri.EscapeDataString(@"\slash")));
    }

    [Fact]
    public async Task Q_without_match_returns_an_empty_list()
    {
        var response = await Client.GetAsync("/skills?q=no-such-skill");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await Json(response)).AsArray());
    }
}
