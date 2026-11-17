package com.howlingcoder.companyskills.skill;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

/**
 * Seeds the skill catalog on startup, but only if skills.seed-file is set
 * (the seed-skills command of the Python backend). A failing seed stops the start.
 */
@Component
@ConditionalOnProperty("skills.seed-file")
class SkillSeedRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SkillSeedRunner.class);

    private final SkillSeeder seeder;
    private final Path seedFile;

    SkillSeedRunner(SkillSeeder seeder, @Value("${skills.seed-file}") String seedFile) {
        this.seeder = seeder;
        // A String, not a Path: Spring reads a relative Path value as a resource path and rejects "../"
        this.seedFile = Path.of(seedFile);
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        SkillSeeder.SeedResult result = seeder.seed(seedFile);
        log.info("Seed: inserted {} skills, {} already present", result.inserted(), result.alreadyPresent());
    }
}
