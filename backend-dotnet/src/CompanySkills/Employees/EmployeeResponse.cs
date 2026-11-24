namespace CompanySkills.Employees;

/// <summary>One skill of an employee. Matched marks the skills that satisfied the current skill search.</summary>
public record EmployeeSkillResponse(Guid SkillId, string Name, string? Alias, int ProficiencyLevel, bool Matched);

public record EmployeeResponse(
    Guid Id,
    string Firstname,
    string Lastname,
    string Email,
    int Age,
    List<EmployeeSkillResponse> Skills)
{
    /// <param name="employee">With SkillAssignments and their Skill loaded.</param>
    /// <param name="matchedAssignmentIds">Assignments that satisfied the skill search; none outside a search.</param>
    public static EmployeeResponse From(Employee employee, IReadOnlySet<Guid>? matchedAssignmentIds = null)
    {
        // Assignments of soft-deleted skills are invisible; best level first, then by name
        var skills = employee.SkillAssignments
            .Where(a => a.Skill.DeletedAt == null)
            .Select(a => new EmployeeSkillResponse(a.Skill.Id, a.Skill.Name, a.Skill.Alias, a.ProficiencyLevel,
                matchedAssignmentIds?.Contains(a.Id) ?? false))
            .OrderByDescending(s => s.ProficiencyLevel)
            .ThenBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new EmployeeResponse(employee.Id, employee.Firstname, employee.Lastname, employee.Email,
            employee.Age, skills);
    }
}
