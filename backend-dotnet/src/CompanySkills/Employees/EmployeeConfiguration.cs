using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanySkills.Employees;

public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable(t => t.HasCheckConstraint("ck_employee_age_positive", "age > 0"));
        builder.HasIndex(e => e.Email).IsUnique().HasDatabaseName("uq_employee_email");
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        builder.Property(e => e.UpdatedAt).HasDefaultValueSql("now()");

        // Required relationship: an assignment removed from the list is deleted (hard delete).
        builder.HasMany(e => e.SkillAssignments)
            .WithOne(a => a.Employee)
            .HasForeignKey(a => a.EmployeeId)
            .HasConstraintName("fk_skill_assignment_employee_id_employee");
    }
}
