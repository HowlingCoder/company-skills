package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.assignment.SkillAssignment;
import com.howlingcoder.companyskills.skill.Skill;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record EmployeeResponse(
        UUID id,
        String firstname,
        String lastname,
        String email,
        int age,
        List<EmployeeSkillResponse> skills
) {

    /**
     * @param matchedIds ids of the assignments that satisfied the skill search; empty outside a search
     */
    static EmployeeResponse from(Employee employee, Set<UUID> matchedIds) {
        // Assignments of soft-deleted skills are invisible; best level first, then by name
        List<EmployeeSkillResponse> skills = employee.getSkillAssignments().stream()
                .filter(assignment -> assignment.getSkill().getDeletedAt() == null)
                .map(assignment -> EmployeeSkillResponse.from(assignment, matchedIds.contains(assignment.getId())))
                .sorted(Comparator.comparingInt(EmployeeSkillResponse::proficiencyLevel).reversed()
                        .thenComparing(EmployeeSkillResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new EmployeeResponse(employee.getId(), employee.getFirstname(), employee.getLastname(),
                employee.getEmail(), employee.getAge(), skills);
    }
}
