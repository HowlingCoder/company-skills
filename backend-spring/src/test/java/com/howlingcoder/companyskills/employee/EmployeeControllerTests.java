package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.TestcontainersConfiguration;
import com.howlingcoder.companyskills.assignment.SkillAssignment;
import com.howlingcoder.companyskills.skill.Skill;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Port of backend/tests/test_employees.py.
 * Every test runs in a transaction that is rolled back afterwards. The setup is
 * flushed and the persistence context cleared, so the request loads everything
 * through the repository query instead of reusing the objects created here.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EmployeeControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @PersistenceContext
    private EntityManager entityManager;

    private Skill addSkill(String name, String alias, OffsetDateTime deletedAt) {
        Skill skill = new Skill();
        skill.setName(name);
        skill.setAlias(alias);
        skill.setDeletedAt(deletedAt);
        entityManager.persist(skill);
        return skill;
    }

    private Skill addSkill(String name) {
        return addSkill(name, null, null);
    }

    private Employee addEmployee(
            String firstname, String lastname, OffsetDateTime deletedAt, Map<Skill, Integer> skills) {
        Employee employee = new Employee();
        employee.setFirstname(firstname);
        employee.setLastname(lastname);
        employee.setEmail((firstname + "." + lastname + "@example.com").toLowerCase());
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

    private Employee addEmployee(String firstname, Map<Skill, Integer> skills) {
        return addEmployee(firstname, "Muster", null, skills);
    }

    private ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
        entityManager.flush();
        entityManager.clear();
        return mockMvc.perform(request).andExpect(status().isOk());
    }

    private ResultActions getEmployees() throws Exception {
        return perform(get("/employees"));
    }

    private ResultActions searchEmployees(String q) throws Exception {
        return perform(get("/employees").param("q", q));
    }

    private ResultActions searchSkills(String... skills) throws Exception {
        return perform(get("/employees").param("skills", skills));
    }

    @Test
    void withoutParametersReturnsAllActiveEmployeesSortedByNameIgnoringCase() throws Exception {
        addEmployee("Zoe", "Adler", null, Map.of());
        addEmployee("Ben", "Zimmer", null, Map.of());
        addEmployee("anna", "Adler", null, Map.of());
        addEmployee("Gone", "Adler", OffsetDateTime.now(), Map.of());

        getEmployees().andExpect(jsonPath("$[*].firstname", contains("anna", "Zoe", "Ben")));
    }

    @Test
    void employeeCarriesOwnDataAndSkillsSortedByLevel() throws Exception {
        Skill low = addSkill("low", "lo", null);
        Skill high = addSkill("high");
        Employee employee = addEmployee("Max", Map.of(low, 2, high, 5));

        // STRICT: field names, nulls and array order must match exactly. One employee
        // with two skills must stay one entry despite the join fetch.
        getEmployees().andExpect(content().json("""
                [{
                  "id": "%s",
                  "firstname": "Max",
                  "lastname": "Muster",
                  "email": "max.muster@example.com",
                  "age": 30,
                  "skills": [
                    {"skill_id": "%s", "name": "high", "alias": null,
                     "proficiency_level": 5, "matched": false},
                    {"skill_id": "%s", "name": "low", "alias": "lo",
                     "proficiency_level": 2, "matched": false}
                  ]
                }]
                """.formatted(employee.getId(), high.getId(), low.getId()), JsonCompareMode.STRICT));
    }

    @Test
    void employeeWithoutSkillsHasAnEmptySkillList() throws Exception {
        addEmployee("Max", Map.of());

        getEmployees().andExpect(jsonPath("$[0].skills", empty()));
    }

    @Test
    void skillsWithTheSameLevelAreSortedByNameIgnoringCase() throws Exception {
        addEmployee("Max", Map.of(
                addSkill("b-skill"), 3,
                addSkill("A-skill"), 3,
                addSkill("z-skill"), 5,
                addSkill("c-skill"), 3));

        getEmployees().andExpect(jsonPath(
                "$[0].skills[*].name", contains("z-skill", "A-skill", "b-skill", "c-skill")));
    }

    // Email of Maximilian is maximilian.mustermann@example.com
    @ParameterizedTest
    @ValueSource(strings = {"maxi", "STERM", "milian.must", "mil musterm"})
    void qMatchesSubstringsOfFirstnameLastnameAndEmail(String q) throws Exception {
        addEmployee("Maximilian", "Mustermann", null, Map.of());
        addEmployee("Erika", "Beispiel", null, Map.of());

        searchEmployees(q).andExpect(jsonPath("$[*].firstname", contains("Maximilian")));
    }

    @Test
    void everyWordInQMustMatch() throws Exception {
        addEmployee("Maximilian", "Mustermann", null, Map.of());
        addEmployee("Erika", "Beispiel", null, Map.of());

        // With OR between the words, both employees would be returned
        searchEmployees("maxi beispiel").andExpect(jsonPath("$", empty()));
    }

    @Test
    void blankQReturnsAllActiveEmployees() throws Exception {
        addEmployee("Max", Map.of());

        searchEmployees("   ").andExpect(jsonPath("$[*].firstname", contains("Max")));
    }

    @Test
    void wildcardCharactersInQAreMatchedLiterally() throws Exception {
        addEmployee("Max", Map.of());

        searchEmployees("M_x").andExpect(jsonPath("$", empty()));
        searchEmployees("M%").andExpect(jsonPath("$", empty()));
    }

    @Test
    void skillTermIsAnExactCaseInsensitiveMatchOnNameOrAlias() throws Exception {
        addEmployee("Plain", Map.of(addSkill("C"), 3));
        addEmployee("Sharp", Map.of(addSkill("C#", "csharp", null), 3));

        searchSkills("c").andExpect(jsonPath("$[*].firstname", contains("Plain")));
        searchSkills("CSHARP").andExpect(jsonPath("$[*].firstname", contains("Sharp")));
    }

    @Test
    void starIsAWildcardAndLikeCharactersAreLiteral() throws Exception {
        addEmployee("Plain", Map.of(addSkill("C"), 3));
        addEmployee("Sharp", Map.of(addSkill("C#"), 3));

        searchSkills("c*").andExpect(jsonPath("$[*].firstname", contains("Plain", "Sharp")));
        searchSkills("c%").andExpect(jsonPath("$", empty()));
        searchSkills("c_").andExpect(jsonPath("$", empty()));
    }

    @Test
    void skillMatchAndRequiresEveryTermOrOnlyOne() throws Exception {
        Skill python = addSkill("python");
        Skill docker = addSkill("docker");
        addEmployee("Both", Map.of(python, 3, docker, 3));
        addEmployee("Docker", Map.of(docker, 3));
        addEmployee("None", Map.of());

        searchSkills("python", "docker")
                .andExpect(jsonPath("$[*].firstname", contains("Both")));
        perform(get("/employees").param("skills", "python", "docker").param("skill_match", "or"))
                .andExpect(jsonPath("$[*].firstname", contains("Both", "Docker")));
    }

    @Test
    void minLevelAppliesToEverySkillTerm() throws Exception {
        Skill python = addSkill("python");
        Skill docker = addSkill("docker");
        addEmployee("Expert", Map.of(python, 4, docker, 5));
        addEmployee("Mixed", Map.of(python, 4, docker, 2));

        perform(get("/employees").param("skills", "python", "docker").param("min_level", "4"))
                .andExpect(jsonPath("$[*].firstname", contains("Expert")));
        perform(get("/employees").param("skills", "python", "docker").param("min_level", "4")
                .param("skill_match", "or"))
                .andExpect(jsonPath("$[*].firstname", contains("Expert", "Mixed")));
    }

    @Test
    void minLevelWithoutSkillsNeedsOneSkillAtThatLevel() throws Exception {
        Skill python = addSkill("python");
        addEmployee("Senior", Map.of(python, 4));
        addEmployee("Junior", Map.of(python, 3));
        addEmployee("None", Map.of());

        perform(get("/employees").param("min_level", "4"))
                .andExpect(jsonPath("$[*].firstname", contains("Senior")));
    }

    @Test
    void qAndSkillsAreCombinedWithAnd() throws Exception {
        Skill python = addSkill("python");
        addEmployee("Max", Map.of(python, 3));
        addEmployee("Erika", Map.of(python, 3));
        addEmployee("Maximus", Map.of());

        perform(get("/employees").param("q", "max").param("skills", "python"))
                .andExpect(jsonPath("$[*].firstname", contains("Max")));
    }

    @Test
    void matchedMarksTheSkillsThatSatisfyTheSearch() throws Exception {
        addEmployee("Max", Map.of(addSkill("python"), 5, addSkill("docker"), 2, addSkill("java"), 4));

        // Skills are sorted by level: python 5, java 4, docker 2
        perform(get("/employees").param("skills", "python", "docker")
                .param("skill_match", "or").param("min_level", "3"))
                .andExpect(jsonPath("$[0].skills[*].name", contains("python", "java", "docker")))
                .andExpect(jsonPath("$[0].skills[*].matched", contains(true, false, false)));
    }

    @Test
    void softDeletedSkillsAreNotSearched() throws Exception {
        addEmployee("Max", Map.of(addSkill("gone", null, OffsetDateTime.now()), 3));

        searchSkills("gone").andExpect(jsonPath("$", empty()));
    }

    @ParameterizedTest
    @CsvSource({"min_level, 0", "min_level, 6", "min_level, high", "skill_match, xor"})
    void invalidParametersAreRejected(String name, String value) throws Exception {
        mockMvc.perform(get("/employees").param(name, value))
                .andExpect(status().is(422));
    }

    @Test
    void softDeletedSkillsAreNotReturned() throws Exception {
        addEmployee("Max", Map.of(
                addSkill("active"), 2,
                addSkill("gone", null, OffsetDateTime.now()), 5));

        getEmployees().andExpect(jsonPath("$[0].skills[*].name", contains("active")));
    }
}
