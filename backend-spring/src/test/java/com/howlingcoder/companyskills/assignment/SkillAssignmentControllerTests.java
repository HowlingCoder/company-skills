package com.howlingcoder.companyskills.assignment;

import com.howlingcoder.companyskills.TestcontainersConfiguration;
import com.howlingcoder.companyskills.employee.Employee;
import com.howlingcoder.companyskills.skill.Skill;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Port of the POST /skill-assignments/bulk tests in backend/tests/test_skill_assignments.py.
 * Same approach as EmployeeSkillsControllerTests: flush and clear before the request,
 * read the stored state back with a fresh query.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SkillAssignmentControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @PersistenceContext
    private EntityManager entityManager;

    private Skill addSkill(OffsetDateTime deletedAt) {
        Skill skill = new Skill();
        skill.setName("skill-" + UUID.randomUUID());
        skill.setDeletedAt(deletedAt);
        entityManager.persist(skill);
        return skill;
    }

    private Skill addSkill() {
        return addSkill(null);
    }

    private Employee addEmployee(OffsetDateTime deletedAt, Map<Skill, Integer> skills) {
        Employee employee = new Employee();
        employee.setFirstname("Max");
        employee.setLastname("Muster");
        employee.setEmail(UUID.randomUUID() + "@example.com");
        employee.setAge(30);
        employee.setDeletedAt(deletedAt);
        skills.forEach((skill, level) -> {
            SkillAssignment assignment = new SkillAssignment();
            assignment.setEmployee(employee);
            assignment.setSkill(skill);
            assignment.setProficiencyLevel(level);
            employee.getSkillAssignments().add(assignment);
        });
        entityManager.persist(employee);
        return employee;
    }

    private Employee addEmployee(Map<Skill, Integer> skills) {
        return addEmployee(null, skills);
    }

    private Employee addEmployee() {
        return addEmployee(null, Map.of());
    }

    /**
     * Assignments as they are in the database: skill id -> level.
     */
    private Map<UUID, Integer> storedLevels(Employee employee) {
        entityManager.flush();
        entityManager.clear();
        List<Object[]> rows = entityManager.createQuery("""
                select a.skill.id, a.proficiencyLevel from SkillAssignment a
                where a.employee.id = :id
                """, Object[].class).setParameter("id", employee.getId()).getResultList();
        return rows.stream().collect(Collectors.toMap(r -> (UUID) r[0], r -> (Integer) r[1]));
    }

    private ResultActions bulk(List<UUID> employeeIds, UUID skillId, int level, String onConflict)
            throws Exception {
        String ids = employeeIds.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(","));
        MockHttpServletRequestBuilder request = post("/skill-assignments/bulk")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"employee_ids": [%s], "skill_id": "%s", "proficiency_level": %d}
                        """.formatted(ids, skillId, level));
        if (onConflict != null) {
            request.param("on_conflict", onConflict);
        }
        entityManager.flush();
        entityManager.clear();
        return mockMvc.perform(request);
    }

    private ResultActions bulk(List<Employee> employees, Skill skill, int level, String onConflict)
            throws Exception {
        return bulk(employees.stream().map(Employee::getId).toList(), skill.getId(), level, onConflict);
    }

    private ResultActions bulk(List<Employee> employees, Skill skill, int level) throws Exception {
        return bulk(employees, skill, level, null);
    }

    @Test
    void bulkCreatesAnAssignmentForEachEmployee() throws Exception {
        Skill skill = addSkill();
        Employee first = addEmployee();
        Employee second = addEmployee();

        bulk(List.of(first, second), skill, 3)
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"created": ["%s", "%s"], "updated": [], "skipped": []}
                        """.formatted(first.getId(), second.getId()), JsonCompareMode.STRICT));

        assertThat(storedLevels(first)).isEqualTo(Map.of(skill.getId(), 3));
        assertThat(storedLevels(second)).isEqualTo(Map.of(skill.getId(), 3));
    }

    @Test
    void bulkSkipsExistingLevelsByDefault() throws Exception {
        Skill skill = addSkill();
        Employee hasSkill = addEmployee(Map.of(skill, 5));
        Employee newcomer = addEmployee();

        bulk(List.of(hasSkill, newcomer), skill, 2)
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"created": ["%s"], "updated": [], "skipped": ["%s"]}
                        """.formatted(newcomer.getId(), hasSkill.getId()), JsonCompareMode.STRICT));

        assertThat(storedLevels(hasSkill)).isEqualTo(Map.of(skill.getId(), 5));
        assertThat(storedLevels(newcomer)).isEqualTo(Map.of(skill.getId(), 2));
    }

    @Test
    void bulkOverwritesExistingLevelsOnRequest() throws Exception {
        Skill skill = addSkill();
        Employee hasSkill = addEmployee(Map.of(skill, 5));
        Employee newcomer = addEmployee();

        bulk(List.of(hasSkill, newcomer), skill, 2, "overwrite")
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"created": ["%s"], "updated": ["%s"], "skipped": []}
                        """.formatted(newcomer.getId(), hasSkill.getId()), JsonCompareMode.STRICT));

        assertThat(storedLevels(hasSkill)).isEqualTo(Map.of(skill.getId(), 2));
    }

    @Test
    void bulkProcessesARepeatedEmployeeOnce() throws Exception {
        Skill skill = addSkill();
        Employee employee = addEmployee();

        bulk(List.of(employee, employee), skill, 3)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created[*]").value(employee.getId().toString()));

        assertThat(storedLevels(employee)).isEqualTo(Map.of(skill.getId(), 3));
    }

    @Test
    void bulkWithUnknownSkillIs404() throws Exception {
        Employee employee = addEmployee();

        bulk(List.of(employee.getId()), UUID.randomUUID(), 3, null).andExpect(status().isNotFound());

        assertThat(storedLevels(employee)).isEmpty();
    }

    @Test
    void bulkWithSoftDeletedSkillIs404() throws Exception {
        Skill deleted = addSkill(OffsetDateTime.now());
        Employee employee = addEmployee();

        bulk(List.of(employee), deleted, 3).andExpect(status().isNotFound());

        assertThat(storedLevels(employee)).isEmpty();
    }

    @Test
    void bulkWithUnknownEmployeeIs404AndWritesNothing() throws Exception {
        Skill skill = addSkill();
        Employee employee = addEmployee();
        Employee deleted = addEmployee(OffsetDateTime.now(), Map.of());

        bulk(List.of(employee, deleted), skill, 3)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail", containsString(deleted.getId().toString())));

        assertThat(storedLevels(employee)).isEmpty();
    }

    @Test
    void bulkWithInvalidInputIs422() throws Exception {
        Skill skill = addSkill();
        Employee employee = addEmployee();

        bulk(List.of(), skill, 3).andExpect(status().is(422));
        bulk(List.of(employee), skill, 6).andExpect(status().is(422));
        bulk(List.of(employee), skill, 3, "merge").andExpect(status().is(422));

        assertThat(storedLevels(employee)).isEmpty();
    }
}
