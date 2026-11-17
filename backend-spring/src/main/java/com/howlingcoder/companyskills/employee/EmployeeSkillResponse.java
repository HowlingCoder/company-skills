package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.assignment.SkillAssignment;

import java.util.UUID;

/**
 * One skill of an employee. {@code matched} marks the skills that satisfied the current skill search.
 */
public record EmployeeSkillResponse(UUID skillId, String name, String alias, int proficiencyLevel, boolean matched) {

    static EmployeeSkillResponse from(SkillAssignment assignment, boolean matched) {
        return new EmployeeSkillResponse(
                assignment.getSkill().getId(),
                assignment.getSkill().getName(),
                assignment.getSkill().getAlias(),
                assignment.getProficiencyLevel(),
                matched);
    }
}
