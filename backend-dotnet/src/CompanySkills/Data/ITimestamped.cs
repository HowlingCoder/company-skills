namespace CompanySkills.Data;

/// <summary>
/// Entities with created_at and updated_at. The database fills both on insert;
/// <see cref="AppDbContext"/> sets UpdatedAt on every update.
/// </summary>
public interface ITimestamped
{
    DateTimeOffset CreatedAt { get; }
    DateTimeOffset UpdatedAt { get; set; }
}
