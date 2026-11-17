package com.howlingcoder.companyskills.skill;

import org.springframework.data.jpa.repository.query.EscapeCharacter;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
class SkillController {
    private final SkillRepository skillRepository;

    SkillController(SkillRepository skillRepository) {
        this.skillRepository = skillRepository;
    }

    /**
     * Skill catalog for the autocomplete; q is a substring of name or alias.
     */
    @GetMapping("/skills")
    public List<SkillResponse> listSkills(@RequestParam(defaultValue = "") String q) {
        String term = EscapeCharacter.DEFAULT.escape(q.strip());

        return skillRepository.search(term).stream().map(SkillResponse::from).toList();
    }
}
