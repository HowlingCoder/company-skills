using CompanySkills.Skills;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CompanySkills.Tests;

/// <summary>Port of backend-spring SkillSeederTests.</summary>
public class SkillSeederTests(DatabaseFixture fixture) : IntegrationTest(fixture), IDisposable
{
    private readonly string _tempDir = Directory.CreateTempSubdirectory("seed-").FullName;

    public void Dispose() => Directory.Delete(_tempDir, recursive: true);

    private static string SeedFile()
    {
        // The repository's seed file, found from the test's output directory upwards
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (!File.Exists(Path.Combine(dir.FullName, "NOTES.md")))
        {
            dir = dir.Parent ?? throw new InvalidOperationException("Repository root not found");
        }

        return Path.Combine(dir.FullName, "backend", "data", "skills.csv");
    }

    private async Task<string> WriteCsv(string content)
    {
        var path = Path.Combine(_tempDir, "skills.csv");
        await File.WriteAllTextAsync(path, content);
        return path;
    }

    private async Task<SeedResult> Seed(string path)
    {
        using var scope = Fixture.Api.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SkillSeeder>().SeedAsync(path);
    }

    private async Task<List<Skill>> StoredSkills()
    {
        await using var db = Fixture.CreateContext();
        return await db.Skills.OrderBy(s => s.Name).ToListAsync();
    }

    [Fact]
    public async Task Seed_file_fills_the_catalog()
    {
        var result = await Seed(SeedFile());

        Assert.Equal(100, result.Inserted + result.AlreadyPresent);
        Assert.Equal(100, (await StoredSkills()).Count);
    }

    [Fact]
    public async Task Seed_inserts_new_skills_trimmed_and_with_null_for_blank_fields()
    {
        var path = await WriteCsv("name,alias,description\n  Alpha ,al,Some description\nBeta,,\n");

        Assert.Equal(new SeedResult(2, 0), await Seed(path));

        var skills = await StoredSkills();
        Assert.Equal(("Alpha", "al", "Some description"), (skills[0].Name, skills[0].Alias, skills[0].Description));
        Assert.Equal(("Beta", null, null), (skills[1].Name, skills[1].Alias, skills[1].Description));
    }

    [Fact]
    public async Task Seed_strips_the_bom_of_an_excel_export()
    {
        var path = await WriteCsv("﻿name,alias\nAlpha,al\n");

        Assert.Equal(new SeedResult(1, 0), await Seed(path));
    }

    [Fact]
    public async Task Seed_is_idempotent_and_matches_names_ignoring_case()
    {
        var path = await WriteCsv("name\nAlpha\nALPHA\n");

        Assert.Equal(new SeedResult(1, 1), await Seed(path));
        Assert.Equal(new SeedResult(0, 2), await Seed(path));
        Assert.Single(await StoredSkills());
    }

    [Fact]
    public async Task Seed_leaves_existing_skills_untouched()
    {
        await AddSkill("alpha", alias: "keep", description: "keep");
        var path = await WriteCsv("name,alias,description\nAlpha,new,new\n");

        Assert.Equal(new SeedResult(0, 1), await Seed(path));

        var skill = Assert.Single(await StoredSkills());
        Assert.Equal(("alpha", "keep", "keep"), (skill.Name, skill.Alias, skill.Description));
    }

    [Fact]
    public async Task Seed_does_not_reactivate_soft_deleted_skills()
    {
        await AddSkill("alpha", deleted: true);
        var path = await WriteCsv("name\nAlpha\n");

        Assert.Equal(new SeedResult(0, 1), await Seed(path));

        Assert.NotNull(Assert.Single(await StoredSkills()).DeletedAt);
    }

    [Fact]
    public async Task Seed_rejects_file_without_name_column()
    {
        var path = await WriteCsv("alias,description\npy,x\n");

        var error = await Assert.ThrowsAsync<InvalidDataException>(() => Seed(path));
        Assert.Contains("missing required column 'name'", error.Message);
    }

    [Fact]
    public async Task Seed_rejects_the_whole_file_on_an_empty_name()
    {
        var path = await WriteCsv("name,alias\nAlpha,\n ,x\n");

        var error = await Assert.ThrowsAsync<InvalidDataException>(() => Seed(path));
        Assert.Contains("line 3 has no name", error.Message);
        Assert.Empty(await StoredSkills());
    }

    [Fact]
    public async Task Seed_fails_for_a_missing_file()
    {
        await Assert.ThrowsAsync<FileNotFoundException>(() => Seed(Path.Combine(_tempDir, "missing.csv")));
    }
}
