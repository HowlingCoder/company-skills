using System.Linq.Expressions;
using CompanySkills.Assignments;
using CompanySkills.Data;
using CompanySkills.Web;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Employees;

public static class EmployeeSearchEndpoints
{
    public static void MapEmployeeSearchEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/employees", ListEmployees);

    /// <summary>
    /// Employee overview and search. q matches every word in name or email; skills and
    /// min_level filter by skill (skill_match decides whether all or any term must match).
    /// </summary>
    private static async Task<Results<Ok<List<EmployeeResponse>>, ProblemHttpResult>> ListEmployees(
        AppDbContext db,
        string? q,
        string[]? skills,
        [FromQuery(Name = "skill_match")] string? skillMatch,
        [FromQuery(Name = "min_level")] int? minLevel,
        CancellationToken ct)
    {
        skillMatch ??= "and";
        if (skillMatch is not ("and" or "or"))
        {
            return ApiProblems.Unprocessable("skill_match must be and or or");
        }

        if (minLevel is { } level && !ProficiencyLevel.IsValid(level))
        {
            return ApiProblems.Unprocessable(ProficiencyLevel.Message);
        }

        var words = (q ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        var patterns = (skills ?? [])
            .Select(term => term.Trim())
            .Where(term => term.Length > 0)
            .Select(ToSkillPattern)
            .ToList();
        var skillSearch = patterns.Count > 0 || minLevel is not null;

        var query = db.Employees
            .Include(e => e.SkillAssignments).ThenInclude(a => a.Skill)
            .Where(e => e.DeletedAt == null);
        query = FilterByWords(query, words);
        if (skillSearch)
        {
            query = FilterBySkills(query, patterns, matchAll: skillMatch == "and", minLevel);
        }

        var employees = await query
            .OrderBy(e => e.Lastname.ToLower()).ThenBy(e => e.Firstname.ToLower())
            .AsSplitQuery()
            .ToListAsync(ct);

        var matchedIds = skillSearch
            ? await FindMatchedAssignmentIds(db, employees.Select(e => e.Id).ToList(), patterns, minLevel, ct)
            : null;

        return TypedResults.Ok(employees.Select(e => EmployeeResponse.From(e, matchedIds)).ToList());
    }

    /// <summary>
    /// A skill term as an ILIKE pattern: LIKE characters are escaped, then the user's * becomes %.
    /// Without *, the pattern is an exact (case-insensitive) match, so "c" does not find C#.
    /// </summary>
    private static string ToSkillPattern(string term) => Like.Escape(term).Replace("*", "%");

    /// <summary>Every word is a substring of firstname, lastname or email, ignoring case.</summary>
    private static IQueryable<Employee> FilterByWords(IQueryable<Employee> query, string[] words)
    {
        var patterns = words.Select(w => $"%{Like.Escape(w)}%").ToArray();

        return query.Where(e => patterns.All(p =>
            EF.Functions.ILike(e.Firstname, p) || EF.Functions.ILike(e.Lastname, p) || EF.Functions.ILike(e.Email, p)));
    }

    /// <summary>
    /// matchAll: one EXISTS per pattern (each may be satisfied by a different skill).
    /// Otherwise one EXISTS for all patterns together.
    /// </summary>
    private static IQueryable<Employee> FilterBySkills(IQueryable<Employee> query, List<string> patterns,
        bool matchAll, int? minLevel)
    {
        if (matchAll && patterns.Count > 0)
        {
            foreach (var pattern in patterns)
            {
                var matches = AssignmentMatches([pattern], minLevel);
                query = query.Where(e => e.SkillAssignments.AsQueryable().Any(matches));
            }

            return query;
        }

        var anyMatches = AssignmentMatches(patterns, minLevel);
        return query.Where(e => e.SkillAssignments.AsQueryable().Any(anyMatches));
    }

    /// <summary>
    /// The skill is active, its name or alias matches one of the patterns (none: any skill)
    /// and the level is at least minLevel (null: any level).
    /// </summary>
    private static Expression<Func<SkillAssignment, bool>> AssignmentMatches(List<string> patterns, int? minLevel)
    {
        return assignment => assignment.Skill.DeletedAt == null && (patterns.Count == 0 || patterns.Any(
            p => EF.Functions.ILike(assignment.Skill.Name, p) || (assignment.Skill.Alias != null && EF.Functions.ILike(assignment.Skill.Alias, p)))) && (minLevel == null || assignment.ProficiencyLevel >= minLevel);

    }


    /// <summary>Ids of the assignments that satisfy the search, so the response can mark them as matched.</summary>
    private static async Task<IReadOnlySet<Guid>> FindMatchedAssignmentIds(AppDbContext db, List<Guid> employeeIds,
        List<string> patterns, int? minLevel, CancellationToken ct)
    {
        var ids = await db.SkillAssignments
            .Where(a => employeeIds.Contains(a.EmployeeId))
            .Where(AssignmentMatches(patterns, minLevel))
            .Select(a => a.Id)
            .ToListAsync(ct);
        return ids.ToHashSet();
    }
}
