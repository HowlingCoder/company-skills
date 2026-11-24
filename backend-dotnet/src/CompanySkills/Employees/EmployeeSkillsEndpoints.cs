using CompanySkills.Assignments;
using CompanySkills.Data;
using CompanySkills.Web;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Employees;

public record SkillLevel(Guid SkillId, int ProficiencyLevel);

public record EmployeeSkillsUpdate(List<SkillLevel> Skills);

public static class EmployeeSkillsEndpoints
{
    public static void MapEmployeeSkillsEndpoints(this IEndpointRouteBuilder app) =>
        app.MapPut("/employees/{employeeId}/skills", SetEmployeeSkills);

    /// <summary>
    /// Replaces the skills of an employee: missing ones are removed, new ones added, the rest updated.
    /// </summary>
    private static async Task<Results<Ok<EmployeeResponse>, ProblemHttpResult>> SetEmployeeSkills(
        Guid employeeId, EmployeeSkillsUpdate body, AppDbContext db, CancellationToken ct)
    {
        if (Validate(body) is { } problem)
        {
            return ApiProblems.Unprocessable(problem);
        }

        var employee = await db.Employees
            .Include(e => e.SkillAssignments).ThenInclude(a => a.Skill)
            .SingleOrDefaultAsync(e => e.Id == employeeId && e.DeletedAt == null, ct);
        if (employee is null)
        {
            return ApiProblems.NotFound("Employee not found");
        }

        // skill id -> requested level, in request order
        var levels = new OrderedDictionary<Guid, int>();
        foreach (var item in body.Skills)
        {
            levels.Add(item.SkillId, item.ProficiencyLevel);
        }

        var ids = levels.Keys.ToList();
        var known = await db.Skills
            .Where(s => ids.Contains(s.Id) && s.DeletedAt == null)
            .ToDictionaryAsync(s => s.Id, ct);
        var unknown = ids.Where(id => !known.ContainsKey(id)).ToList();
        if (unknown.Count > 0)
        {
            return ApiProblems.NotFound($"Skills not found: {string.Join(", ", unknown)}");
        }

        foreach (var assignment in employee.SkillAssignments.ToList())
        {
            // Assignments of soft-deleted skills are invisible in the UI: keep them
            if (assignment.Skill.DeletedAt is not null)
            {
                continue;
            }

            if (levels.Remove(assignment.SkillId, out var level))
            {
                assignment.ProficiencyLevel = level;
            }
            else
            {
                // Required relationship: removing it from the list deletes the row
                employee.SkillAssignments.Remove(assignment);
            }
        }

        // What is left has no assignment yet
        foreach (var (skillId, level) in levels)
        {
            employee.SkillAssignments.Add(new SkillAssignment { Skill = known[skillId], ProficiencyLevel = level });
        }

        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(EmployeeResponse.From(employee));
    }

    private static string? Validate(EmployeeSkillsUpdate body)
    {
        // Nullable annotations are not enforced for list items by the JSON reader
        if (body.Skills.Any(item => item is null))
        {
            return "skills must not contain null";
        }

        if (body.Skills.Any(item => !ProficiencyLevel.IsValid(item.ProficiencyLevel)))
        {
            return ProficiencyLevel.Message;
        }

        return body.Skills.DistinctBy(item => item.SkillId).Count() != body.Skills.Count
            ? "Each skill may only be listed once"
            : null;
    }
}
