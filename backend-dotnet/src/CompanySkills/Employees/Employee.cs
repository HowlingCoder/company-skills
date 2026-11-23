using CompanySkills.Assignments;
using CompanySkills.Data;

namespace CompanySkills.Employees;

public class Employee : ITimestamped
{
    public Guid Id { get; set; }
    public required string Firstname { get; set; }
    public required string Lastname { get; set; }
    public required string Email { get; set; }
    public int Age { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<SkillAssignment> SkillAssignments { get; set; } = [];
}
