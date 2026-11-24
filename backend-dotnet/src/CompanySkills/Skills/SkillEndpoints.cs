using CompanySkills.Data;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Skills;

public record SkillResponse(Guid Id, string Name, string? Alias, string? Description);

public static class SkillEndpoints
{
    public static void MapSkillEndpoints(this IEndpointRouteBuilder app) => app.MapGet("/skills", ListSkills);

    /// <summary>Skill catalog for the autocomplete; q is a substring of name or alias.</summary>
    private static async Task<List<SkillResponse>> ListSkills(AppDbContext db, string? q, CancellationToken ct)
    {
        var pattern = $"%{Like.Escape((q ?? "").Trim())}%";

        return await db.Skills
            .Where(s => s.DeletedAt == null
                        && (EF.Functions.ILike(s.Name, pattern, @"\")
                            || (s.Alias != null && EF.Functions.ILike(s.Alias, pattern, @"\"))))
            .OrderBy(s => s.Name.ToLower())
            .Select(s => new SkillResponse(s.Id, s.Name, s.Alias, s.Description))
            .ToListAsync(ct);
    }
}
