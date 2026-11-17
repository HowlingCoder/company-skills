package com.howlingcoder.companyskills.skill;

import com.howlingcoder.companyskills.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Port of backend/tests/test_skills.py. Every test runs in a transaction that is
 * rolled back afterwards; MockMvc requests run in the same thread, so they see the
 * uncommitted rows.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SkillControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SkillRepository skillRepository;

    private Skill addSkill(String name, String alias, String description, OffsetDateTime deletedAt) {
        Skill skill = new Skill();
        skill.setName(name);
        skill.setAlias(alias);
        skill.setDescription(description);
        skill.setDeletedAt(deletedAt);
        return skillRepository.saveAndFlush(skill);
    }

    private Skill addSkill(String name) {
        return addSkill(name, null, null, null);
    }

    private ResultActions getSkills(String q) throws Exception {
        return mockMvc.perform(get("/skills").param("q", q));
    }

    @Test
    void withoutQReturnsAllActiveSkillsSortedByNameIgnoringCase() throws Exception {
        addSkill("B-sort");
        addSkill("a-sort");
        addSkill("c-sort");

        mockMvc.perform(get("/skills"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("a-sort", "B-sort", "c-sort")));
    }

    @Test
    void responseContainsOnlyTheCatalogFields() throws Exception {
        Skill skill = addSkill("fields", "fl", "A test skill", null);

        getSkills("fields").andExpect(content().json("""
                [{"id": "%s", "name": "fields", "alias": "fl", "description": "A test skill"}]
                """.formatted(skill.getId()), JsonCompareMode.STRICT));
    }

    @Test
    void qMatchesASubstringOfTheNameCaseInsensitively() throws Exception {
        addSkill("JavaScript");

        getSkills("VAscr").andExpect(jsonPath("$[*].name", contains("JavaScript")));
    }

    @Test
    void qMatchesTheAlias() throws Exception {
        addSkill("Kubernetes", "K8s", null, null);

        getSkills("k8s").andExpect(jsonPath("$[*].name", contains("Kubernetes")));
    }

    @Test
    void qIsTrimmed() throws Exception {
        addSkill("Kubernetes");

        getSkills("  kube  ").andExpect(jsonPath("$[*].name", contains("Kubernetes")));
    }

    @Test
    void softDeletedSkillsAreNotReturned() throws Exception {
        addSkill("active-deleted");
        addSkill("gone-deleted", null, null, OffsetDateTime.now());

        getSkills("deleted").andExpect(jsonPath("$[*].name", contains("active-deleted")));
    }

    @Test
    void wildcardCharactersInQAreMatchedLiterally() throws Exception {
        addSkill("100%done");
        addSkill("100xdone");
        addSkill("under_score");
        addSkill("underxscore");
        addSkill("back\\slash");
        addSkill("backxslash");

        getSkills("%done").andExpect(jsonPath("$[*].name", contains("100%done")));
        getSkills("_score").andExpect(jsonPath("$[*].name", contains("under_score")));
        getSkills("\\slash").andExpect(jsonPath("$[*].name", contains("back\\slash")));
    }

    @Test
    void qWithoutMatchReturnsAnEmptyList() throws Exception {
        getSkills("no-such-skill")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", empty()));
    }
}
