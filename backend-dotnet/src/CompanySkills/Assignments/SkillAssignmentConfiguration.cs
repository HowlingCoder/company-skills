using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanySkills.Assignments;

public class SkillAssignmentConfiguration : IEntityTypeConfiguration<SkillAssignment>
{
    public void Configure(EntityTypeBuilder<SkillAssignment> builder)
    {
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_skill_assignment_proficiency_level_range",
            "proficiency_level >= 1 AND proficiency_level <= 5"));
        builder.HasIndex(a => new { a.EmployeeId, a.SkillId })
            .IsUnique()
            .HasDatabaseName("uq_skill_assignment_employee_id");
        builder.HasIndex(a => a.SkillId).HasDatabaseName("ix_skill_assignment_skill_id");
        builder.Property(a => a.CreatedAt).HasDefaultValueSql("now()");
        builder.Property(a => a.UpdatedAt).HasDefaultValueSql("now()");

        builder.HasOne(a => a.Skill)
            .WithMany()
            .HasForeignKey(a => a.SkillId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_skill_assignment_skill_id_skill");
    }
}
