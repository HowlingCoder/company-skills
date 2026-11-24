using CompanySkills.Data;
using CompanySkills.Web;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Assignments;

public record BulkAssignmentRequest(List<Guid> EmployeeIds, Guid SkillId, int ProficiencyLevel);

public record BulkAssignmentResult(List<Guid> Created, List<Guid> Updated, List<Guid> Skipped);

public static class SkillAssignmentEndpoints
{
    public static void MapSkillAssignmentEndpoints(this IEndpointRouteBuilder app) =>
        app.MapPost("/skill-assignments/bulk", BulkAssignSkill);

    /// <summary>Assign one skill to many employees; existing levels are kept by default.</summary>
    private static async Task<Results<Ok<BulkAssignmentResult>, ProblemHttpResult>> BulkAssignSkill(
        BulkAssignmentRequest body,
        [FromQuery(Name = "on_conflict")] string? onConflict,
        AppDbContext db,
        CancellationToken ct)
    {
        onConflict ??= "skip";
        if (onConflict is not ("skip" or "overwrite"))
        {
            return ApiProblems.Unprocessable("on_conflict must be skip or overwrite");
        }

        if (body.EmployeeIds.Count == 0)
        {
            return ApiProblems.Unprocessable("employee_ids must not be empty");
        }

        if (!ProficiencyLevel.IsValid(body.ProficiencyLevel))
        {
            return ApiProblems.Unprocessable(ProficiencyLevel.Message);
        }

        var skill = await db.Skills.SingleOrDefaultAsync(s => s.Id == body.SkillId && s.DeletedAt == null, ct);
        if (skill is null)
        {
            return ApiProblems.NotFound("Skill not found");
        }

        // A repeated employee is processed once, in request order
        var employeeIds = body.EmployeeIds.Distinct().ToList();

        var activeIds = await db.Employees
            .Where(e => employeeIds.Contains(e.Id) && e.DeletedAt == null)
            .Select(e => e.Id)
            .ToListAsync(ct);
        var unknown = employeeIds.Except(activeIds).ToList();
        if (unknown.Count > 0)
        {
            return ApiProblems.NotFound($"Employees not found: {string.Join(", ", unknown)}");
        }

        // The frontend preview is not trusted: conflicts are checked here
        var existing = await db.SkillAssignments
            .Where(a => a.SkillId == skill.Id && employeeIds.Contains(a.EmployeeId))
            .ToDictionaryAsync(a => a.EmployeeId, ct);

        var result = new BulkAssignmentResult([], [], []);
        foreach (var employeeId in employeeIds)
        {
            if (!existing.TryGetValue(employeeId, out var assignment))
            {
                db.SkillAssignments.Add(new SkillAssignment
                {
                    EmployeeId = employeeId,
                    SkillId = skill.Id,
                    ProficiencyLevel = body.ProficiencyLevel,
                });
                result.Created.Add(employeeId);
            }
            else if (onConflict == "overwrite")
            {
                assignment.ProficiencyLevel = body.ProficiencyLevel;
                result.Updated.Add(employeeId);
            }
            else
            {
                result.Skipped.Add(employeeId);
            }
        }

        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(result);
    }
}
