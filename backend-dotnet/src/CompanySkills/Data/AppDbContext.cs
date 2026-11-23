using System.Text.RegularExpressions;
using CompanySkills.Assignments;
using CompanySkills.Employees;
using CompanySkills.Skills;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Data;

public partial class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<SkillAssignment> SkillAssignments => Set<SkillAssignment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Picks up every IEntityTypeConfiguration<T> in this project (e.g. SkillConfiguration).
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        UseSnakeCaseNames(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries<ITimestamped>())
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Same naming as the other backends: tables and columns in snake_case
    /// (SkillAssignment.ProficiencyLevel -> skill_assignment.proficiency_level).
    /// </summary>
    private static void UseSnakeCaseNames(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            var table = ToSnakeCase(entity.ClrType.Name);
            entity.SetTableName(table);
            entity.FindPrimaryKey()?.SetName($"pk_{table}");
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    private static string ToSnakeCase(string name) =>
        UpperCaseLetter().Replace(name, "_$1").ToLowerInvariant();

    [GeneratedRegex("(?<!^)([A-Z])")]
    private static partial Regex UpperCaseLetter();
}
