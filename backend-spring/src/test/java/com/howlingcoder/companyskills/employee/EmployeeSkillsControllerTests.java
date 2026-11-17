package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.TestcontainersConfiguration;
import com.howlingcoder.companyskills.assignment.SkillAssignment;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Port of the PUT /employees/{id}/skills tests in backend/tests/test_skill_assignments.py.
 * The setup is flushed and the persistence context cleared before each request, and the
 * stored state is read back with a fresh query, so the tests see what is really in the
 * database and not what is still cached in memory.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EmployeeSkillsControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @PersistenceContext
    private EntityManager entityManager;

    private Skill addSkill(String name, String alias, OffsetDateTime deletedAt) {
        Skill skill = new Skill();
        skill.setName(name + "-" + UUID.randomUUID());
        skill.setAlias(alias);
        skill.setDeletedAt(deletedAt);
        entityManager.persist(skill);
        return skill;
    }

    private Skill addSkill(String name) {
        return addSkill(name, null, null);
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

    private ResultActions putSkills(UUID employeeId, Map<UUID, Integer> levels) throws Exception {
        String items = levels.entrySet().stream()
                .map(e -> """
                        {"skill_id": "%s", "proficiency_level": %d}""".formatted(e.getKey(), e.getValue()))
                .collect(Collectors.joining(","));
        return putBody(employeeId, "{\"skills\": [" + items + "]}");
    }

    private ResultActions putBody(UUID employeeId, String json) throws Exception {
        entityManager.flush();
        entityManager.clear();
        return mockMvc.perform(put("/employees/{id}/skills", employeeId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    @Test
    void putAddsChangesAndRemovesInOneRequest() throws Exception {
        Skill kept = addSkill("kept");
        Skill removed = addSkill("removed");
        Skill added = addSkill("added", "new", null);
        Employee employee = addEmployee(Map.of(kept, 2, removed, 3));

        putSkills(employee.getId(), Map.of(kept.getId(), 5, added.getId(), 1))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {
                          "id": "%s",
                          "skills": [
                            {"skill_id": "%s", "name": "%s", "alias": null,
                             "proficiency_level": 5, "matched": false},
                            {"skill_id": "%s", "name": "%s", "alias": "new",
                             "proficiency_level": 1, "matched": false}
                          ]
                        }
                        """.formatted(employee.getId(), kept.getId(), kept.getName(),
                        added.getId(), added.getName()), JsonCompareMode.LENIENT));

        assertThat(storedLevels(employee)).isEqualTo(Map.of(kept.getId(), 5, added.getId(), 1));
    }

    @Test
    void putWithEmptyListRemovesAllSkills() throws Exception {
        Employee employee = addEmployee(Map.of(addSkill("skill"), 2));

        putSkills(employee.getId(), Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skills").isEmpty());

        assertThat(storedLevels(employee)).isEmpty();
    }

    @Test
    void putDoesNotTouchOtherEmployees() throws Exception {
        Skill skill = addSkill("skill");
        Employee employee = addEmployee(Map.of(skill, 2));
        Employee other = addEmployee(Map.of(skill, 4));

        putSkills(employee.getId(), Map.of()).andExpect(status().isOk());

        assertThat(storedLevels(other)).isEqualTo(Map.of(skill.getId(), 4));
    }

    @Test
    void putKeepsAssignmentsOfSoftDeletedSkills() throws Exception {
        Skill hidden = addSkill("hidden", null, OffsetDateTime.now());
        Employee employee = addEmployee(Map.of(hidden, 3));

        putSkills(employee.getId(), Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skills").isEmpty());

        assertThat(storedLevels(employee)).isEqualTo(Map.of(hidden.getId(), 3));
    }

    @Test
    void putForUnknownEmployeeIs404() throws Exception {
        putSkills(UUID.randomUUID(), Map.of(addSkill("skill").getId(), 3))
                .andExpect(status().isNotFound());
    }

    @Test
    void putForSoftDeletedEmployeeIs404() throws Exception {
        Skill skill = addSkill("skill");
        Employee employee = addEmployee(OffsetDateTime.now(), Map.of());

        putSkills(employee.getId(), Map.of(skill.getId(), 3)).andExpect(status().isNotFound());

        assertThat(storedLevels(employee)).isEmpty();
    }

    @Test
    void putWithUnknownSkillIs404AndWritesNothing() throws Exception {
        Skill existing = addSkill("existing");
        Skill added = addSkill("new");
        Employee employee = addEmployee(Map.of(existing, 2));
        UUID unknown = UUID.randomUUID();

        Map<UUID, Integer> levels = new LinkedHashMap<>();
        levels.put(added.getId(), 4);
        levels.put(unknown, 3);

        putSkills(employee.getId(), levels)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail", containsString(unknown.toString())));

        assertThat(storedLevels(employee)).isEqualTo(Map.of(existing.getId(), 2));
    }

    @Test
    void putWithSoftDeletedSkillIs404() throws Exception {
        Skill deleted = addSkill("deleted", null, OffsetDateTime.now());
        Employee employee = addEmployee(Map.of());

        putSkills(employee.getId(), Map.of(deleted.getId(), 3)).andExpect(status().isNotFound());

        assertThat(storedLevels(employee)).isEmpty();
    }

    @Test
    void putWithLevelOutOfRangeIs422() throws Exception {
        Skill skill = addSkill("skill");
        Employee employee = addEmployee(Map.of(skill, 2));

        for (int level : new int[]{0, 6}) {
            putSkills(employee.getId(), Map.of(skill.getId(), level))
                    .andExpect(status().is(422));
        }

        assertThat(storedLevels(employee)).isEqualTo(Map.of(skill.getId(), 2));
    }

    @Test
    void putWithSameSkillTwiceIs422() throws Exception {
        Skill skill = addSkill("skill");
        Employee employee = addEmployee(Map.of());
        String item = """
                {"skill_id": "%s", "proficiency_level": 3}""".formatted(skill.getId());

        putBody(employee.getId(), "{\"skills\": [" + item + "," + item + "]}")
                .andExpect(status().is(422));

        assertThat(storedLevels(employee)).isEmpty();
    }

    @Test
    void putWithMalformedBodyIs422() throws Exception {
        Employee employee = addEmployee(Map.of());

        putBody(employee.getId(), "{\"skills\": [{\"skill_id\": \"not-a-uuid\", \"proficiency_level\": 3}]}")
                .andExpect(status().is(422));
        putBody(employee.getId(), "{}").andExpect(status().is(422));
    }
}
