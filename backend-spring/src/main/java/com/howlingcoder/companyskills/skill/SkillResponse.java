package com.howlingcoder.companyskills.skill;

import java.util.UUID;

public record SkillResponse(
        UUID id,
        String name,
        String alias,
        String description
) {
    static SkillResponse from(Skill skill) {
        return new SkillResponse(skill.getId(), skill.getName(), skill.getAlias(), skill.getDescription());
    }
}
