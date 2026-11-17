package com.howlingcoder.companyskills.assignment;

import com.howlingcoder.companyskills.employee.Employee;
import com.howlingcoder.companyskills.employee.EmployeeRepository;
import com.howlingcoder.companyskills.skill.Skill;
import com.howlingcoder.companyskills.skill.SkillRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
class SkillAssignmentController {
    private final SkillAssignmentRepository skillAssignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final SkillRepository skillRepository;

    SkillAssignmentController(SkillAssignmentRepository skillAssignmentRepository,
                              EmployeeRepository employeeRepository,
                              SkillRepository skillRepository) {
        this.skillAssignmentRepository = skillAssignmentRepository;
        this.employeeRepository = employeeRepository;
        this.skillRepository = skillRepository;
    }

    /**
     * Assign one skill to many employees; existing levels are kept by default.
     */
    @PostMapping("/skill-assignments/bulk")
    @Transactional
    public BulkAssignmentResult bulkAssignSkill(
            @Valid @RequestBody BulkAssignmentRequest body,
            @RequestParam(name = "on_conflict", defaultValue = "skip")
            @Pattern(regexp = "skip|overwrite") String onConflict
    ) {
        Skill skill = skillRepository.findById(body.skillId())
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Skill not found"));

        // A repeated employee is processed once, in request order
        List<UUID> employeeIds = new ArrayList<>(new LinkedHashSet<>(body.employeeIds()));

        Map<UUID, Employee> employees = employeeRepository.findByIdInAndDeletedAtIsNull(employeeIds).stream()
                .collect(Collectors.toMap(Employee::getId, Function.identity()));
        List<String> unknown = employeeIds.stream()
                .filter(id -> !employees.containsKey(id))
                .map(UUID::toString)
                .toList();
        if (!unknown.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Employees not found: " + String.join(", ", unknown));
        }

        // The frontend preview is not trusted: conflicts are checked here
        Map<UUID, SkillAssignment> existing = skillAssignmentRepository
                .findBySkillIdAndEmployeeIdIn(skill.getId(), employeeIds).stream()
                .collect(Collectors.toMap(a -> a.getEmployee().getId(), Function.identity()));

        List<UUID> created = new ArrayList<>();
        List<UUID> updated = new ArrayList<>();
        List<UUID> skipped = new ArrayList<>();
        List<SkillAssignment> newAssignments = new ArrayList<>();

        for (UUID employeeId : employeeIds) {
            SkillAssignment assignment = existing.get(employeeId);
            if (assignment == null) {
                SkillAssignment fresh = new SkillAssignment();
                fresh.setEmployee(employees.get(employeeId));
                fresh.setSkill(skill);
                fresh.setProficiencyLevel(body.proficiencyLevel());
                newAssignments.add(fresh);
                created.add(employeeId);
            } else if (onConflict.equals("overwrite")) {
                assignment.setProficiencyLevel(body.proficiencyLevel());
                updated.add(employeeId);
            } else {
                skipped.add(employeeId);
            }
        }
        skillAssignmentRepository.saveAll(newAssignments);

        return new BulkAssignmentResult(created, updated, skipped);
    }
}
