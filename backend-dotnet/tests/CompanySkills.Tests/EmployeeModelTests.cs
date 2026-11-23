using CompanySkills.Assignments;
using CompanySkills.Employees;
using CompanySkills.Skills;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Tests;

/// <summary>
/// Spec for round 2 (written by the user): Employee, SkillAssignment, their
/// configuration and the AddEmployees migration. Ported from backend/tests/test_models.py.
/// </summary>
public class EmployeeModelTests(DatabaseFixture fixture) : DatabaseTest(fixture)
{
    private static Employee MakeEmployee(string? email = null, int age = 36) => new()
    {
        Firstname = "Ada",
        Lastname = "Lovelace",
        Email = email ?? $"{Unique("ada")}@example.com",
        Age = age,
    };

    [Fact]
    public async Task Employee_timestamps_are_equal_on_insert()
    {
        var employee = MakeEmployee();
        Db.Employees.Add(employee);
        await Db.SaveChangesAsync();
        await Db.Entry(employee).ReloadAsync();

        Assert.Equal(employee.CreatedAt, employee.UpdatedAt);
        Assert.Null(employee.DeletedAt);
        Assert.Empty(employee.SkillAssignments);
    }

    [Fact]
    public async Task Employee_email_is_unique()
    {
        var email = $"{Unique("ada")}@example.com";
        Db.Employees.Add(MakeEmployee(email));
        await Db.SaveChangesAsync();

        Db.Employees.Add(MakeEmployee(email));

        Assert.Equal("uq_employee_email", await SaveAndGetViolatedConstraint());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Employee_age_must_be_positive(int age)
    {
        Db.Employees.Add(MakeEmployee(age: age));

        Assert.Equal("ck_employee_age_positive", await SaveAndGetViolatedConstraint());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public async Task Proficiency_level_must_be_between_1_and_5(int level)
    {
        var employee = MakeEmployee();
        employee.SkillAssignments.Add(new SkillAssignment
        {
            Skill = new Skill { Name = Unique("Skill") },
            ProficiencyLevel = level,
        });
        Db.Employees.Add(employee);

        Assert.Equal("ck_skill_assignment_proficiency_level_range", await SaveAndGetViolatedConstraint());
    }

    [Fact]
    public async Task Employee_has_one_assignment_per_skill()
    {
        var employee = MakeEmployee();
        var skill = new Skill { Name = Unique("Skill") };
        employee.SkillAssignments.Add(new SkillAssignment { Skill = skill, ProficiencyLevel = 3 });
        Db.Employees.Add(employee);
        await Db.SaveChangesAsync();

        employee.SkillAssignments.Add(new SkillAssignment { Skill = skill, ProficiencyLevel = 5 });

        Assert.Equal("uq_skill_assignment_employee_id", await SaveAndGetViolatedConstraint());
    }

    [Fact]
    public async Task Removing_an_assignment_from_the_employee_deletes_it()
    {
        var employee = MakeEmployee();
        var skill = new Skill { Name = Unique("Skill") };
        employee.SkillAssignments.Add(new SkillAssignment { Skill = skill, ProficiencyLevel = 3 });
        Db.Employees.Add(employee);
        await Db.SaveChangesAsync();

        employee.SkillAssignments.Clear();
        await Db.SaveChangesAsync();

        Assert.Equal(0, await Db.SkillAssignments.CountAsync(a => a.SkillId == skill.Id));
    }
}
