package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.assignment.SkillAssignment;
import com.howlingcoder.companyskills.assignment.SkillAssignmentRepository;
import com.howlingcoder.companyskills.skill.Skill;
import com.howlingcoder.companyskills.skill.SkillRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.howlingcoder.companyskills.employee.EmployeeSpecifications.*;

@RestController
class EmployeeController {
    private final EmployeeRepository employeeRepository;
    private final SkillAssignmentRepository skillAssignmentRepository;
    private final SkillRepository skillRepository;

    EmployeeController(EmployeeRepository employeeRepository,
                       SkillAssignmentRepository skillAssignmentRepository,
                       SkillRepository skillRepository) {
        this.employeeRepository = employeeRepository;
        this.skillAssignmentRepository = skillAssignmentRepository;
        this.skillRepository = skillRepository;
    }

    /**
     * Employee overview and search. q matches every word in name or email; skills and
     * min_level filter by skill (skill_match decides whether all or any term must match).
     */
    @GetMapping("/employees")
    public List<EmployeeResponse> listEmployees(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) List<String> skills,
            @RequestParam(name = "skill_match", defaultValue = "and") @Pattern(regexp = "and|or") String skillMatch,
            @RequestParam(name = "min_level", required = false) @Min(1) @Max(5) Integer minLevel
    ) {
        List<Specification<Employee>> wordSpecs = Arrays.stream(q.split("\\s+"))
                .filter(w -> !w.isBlank())
                .map(EmployeeSpecifications::containsWord)
                .toList();

        Specification<Employee> spec = Specification.allOf(wordSpecs)
                .and(active())
                .and(withSkillsSortedByName());

        List<String> terms = skills == null ? List.of() : skills.stream()
                .map(String::strip)
                .filter(term -> !term.isEmpty())
                .toList();
        boolean skillSearch = !terms.isEmpty() || minLevel != null;

        if (!terms.isEmpty() && skillMatch.equals("and")) {
            // One EXISTS per term: each term may be satisfied by a different skill
            for (String term : terms) {
                spec = spec.and(hasMatchingAssignment(List.of(term), minLevel));
            }
        } else if (skillSearch) {
            spec = spec.and(hasMatchingAssignment(terms, minLevel));
        }

        List<Employee> employees = employeeRepository.findAll(spec);
        Set<UUID> matchedIds = skillSearch
                ? findMatchedAssignmentIds(employees, terms, minLevel)
                : Set.of();

        return employees.stream().map(e -> EmployeeResponse.from(e, matchedIds)).toList();
    }

    /**
     * Replaces the skills of an employee: missing ones are removed, new ones added, the rest updated.
     */
    @PutMapping("/employees/{employeeId}/skills")
    @Transactional
    public EmployeeResponse setEmployeeSkills(@PathVariable UUID employeeId,
                                              @Valid @RequestBody EmployeeSkillsUpdate body) {
        Employee employee = employeeRepository.findActiveWithSkills(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        // skill id -> requested level, in request order
        Map<UUID, Integer> levels = new LinkedHashMap<>();
        body.skills().forEach(item -> levels.put(item.skillId(), item.proficiencyLevel()));

        Map<UUID, Skill> known = skillRepository.findByIdInAndDeletedAtIsNull(levels.keySet()).stream()
                .collect(Collectors.toMap(Skill::getId, Function.identity()));
        List<String> unknown = levels.keySet().stream()
                .filter(id -> !known.containsKey(id))
                .map(UUID::toString)
                .toList();
        if (!unknown.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Skills not found: " + String.join(", ", unknown));
        }

        for (SkillAssignment assignment : List.copyOf(employee.getSkillAssignments())) {
            // Assignments of soft-deleted skills are invisible in the UI: keep them
            if (assignment.getSkill().getDeletedAt() != null) {
                continue;
            }
            Integer level = levels.remove(assignment.getSkill().getId());
            if (level == null) {
                // orphanRemoval turns this into a DELETE
                employee.getSkillAssignments().remove(assignment);
            } else {
                assignment.setProficiencyLevel(level);
            }
        }
        // What is left in the map has no assignment yet
        levels.forEach((skillId, level) -> {
            SkillAssignment assignment = new SkillAssignment();
            assignment.setEmployee(employee);
            assignment.setSkill(known.get(skillId));
            assignment.setProficiencyLevel(level);
            employee.getSkillAssignments().add(assignment);
        });

        // New assignments get their id on flush; EmployeeResponse needs it
        employeeRepository.flush();
        return EmployeeResponse.from(employee, Set.of());
    }

    /**
     * Ids of the assignments that satisfy the search, so the response can mark them as matched.
     */
    private Set<UUID> findMatchedAssignmentIds(List<Employee> employees, List<String> terms, Integer minLevel) {
        if (employees.isEmpty()) {
            return Set.of();
        }
        List<UUID> employeeIds = employees.stream().map(Employee::getId).toList();

        Specification<SkillAssignment> matches = (assignment, query, cb) -> cb.and(
                assignment.get("employee").get("id").in(employeeIds),
                assignmentMatches(cb, assignment, terms, minLevel));

        return skillAssignmentRepository.findAll(matches).stream()
                .map(SkillAssignment::getId)
                .collect(Collectors.toSet());
    }
}