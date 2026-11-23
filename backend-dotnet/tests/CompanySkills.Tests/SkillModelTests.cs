using CompanySkills.Skills;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Tests;

public class SkillModelTests(DatabaseFixture fixture) : DatabaseTest(fixture)
{
    [Fact]
    public async Task Skill_timestamps_are_equal_on_insert()
    {
        var skill = new Skill { Name = Unique("Skill") };
        Db.Skills.Add(skill);
        await Db.SaveChangesAsync();
        await Db.Entry(skill).ReloadAsync();

        Assert.Equal(skill.CreatedAt, skill.UpdatedAt);
        Assert.Null(skill.DeletedAt);
    }

    [Fact]
    public async Task Skill_update_moves_updated_at()
    {
        var skill = new Skill { Name = Unique("Skill") };
        Db.Skills.Add(skill);
        await Db.SaveChangesAsync();
        await Db.Entry(skill).ReloadAsync();

        skill.Alias = "changed";
        await Db.SaveChangesAsync();

        Assert.True(skill.UpdatedAt > skill.CreatedAt);
    }

    [Fact]
    public async Task Skill_name_is_unique_case_insensitively()
    {
        var name = Unique("Skill");
        Db.Skills.Add(new Skill { Name = name });
        await Db.SaveChangesAsync();

        Db.Skills.Add(new Skill { Name = name.ToLowerInvariant() });

        Assert.Equal("uq_skill_name_lower", await SaveAndGetViolatedConstraint());
    }

    [Fact]
    public async Task Migrations_match_the_model()
    {
        Assert.False(Db.Database.HasPendingModelChanges());
        Assert.Empty(await Db.Database.GetPendingMigrationsAsync());
    }
}
