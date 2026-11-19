package com.howlingcoder.companyskills.employee;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record EmployeeSkillsUpdate(@NotNull List<@NotNull @Valid SkillLevel> skills) {

    public record SkillLevel(
            @NotNull UUID skillId,
            @NotNull @Min(1) @Max(5) Integer proficiencyLevel
    ) {
    }

    @AssertTrue(message = "Each skill may only be listed once")
    boolean isUniqueSkills() {
        if (skills == null) {
            return true;
        }
        long distinct = skills.stream().filter(Objects::nonNull).map(SkillLevel::skillId).distinct().count();
        return distinct == skills.stream().filter(Objects::nonNull).count();
    }
}