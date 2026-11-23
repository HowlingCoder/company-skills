using CompanySkills.Data;
using CompanySkills.Employees;
using CompanySkills.Skills;

namespace CompanySkills.Assignments;

public class SkillAssignment : ITimestamped
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public Guid SkillId { get; set; }
    public Skill Skill { get; set; } = null!;
    public int ProficiencyLevel { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
