package com.howlingcoder.companyskills.skill;

import com.howlingcoder.companyskills.TestcontainersConfiguration;
import com.howlingcoder.companyskills.skill.SkillSeeder.SeedResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Port of backend/tests/test_seed.py. Every test runs in a transaction that is
 * rolled back afterwards.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class SkillSeederTests {
    private static final Path SEED_FILE = Path.of("../backend/data/skills.csv");

    @Autowired
    private SkillSeeder seeder;

    @Autowired
    private SkillRepository skillRepository;

    @TempDir
    Path tempDir;

    private Path writeCsv(String content) throws IOException {
        return Files.writeString(tempDir.resolve("skills.csv"), content, StandardCharsets.UTF_8);
    }

    @Test
    void seedFileFillsTheCatalog() throws IOException {
        SeedResult result = seeder.seed(SEED_FILE);

        assertThat(result.inserted() + result.alreadyPresent()).isEqualTo(100);
        assertThat(skillRepository.count()).isEqualTo(100);
    }

    @Test
    void seedInsertsNewSkillsTrimmedAndWithNullForBlankFields() throws IOException {
        Path path = writeCsv("name,alias,description\n  Alpha ,al,Some description\nBeta,,\n");

        assertThat(seeder.seed(path)).isEqualTo(new SeedResult(2, 0));

        Skill alpha = skillRepository.search("alpha").getFirst();
        assertThat(alpha.getName()).isEqualTo("Alpha");
        assertThat(alpha.getAlias()).isEqualTo("al");
        assertThat(alpha.getDescription()).isEqualTo("Some description");
        Skill beta = skillRepository.search("beta").getFirst();
        assertThat(beta.getAlias()).isNull();
        assertThat(beta.getDescription()).isNull();
    }

    @Test
    void seedStripsTheBomOfAnExcelExport() throws IOException {
        Path path = writeCsv("﻿name,alias\nAlpha,al\n");

        assertThat(seeder.seed(path)).isEqualTo(new SeedResult(1, 0));
    }

    @Test
    void seedIsIdempotentAndMatchesNamesIgnoringCase() throws IOException {
        Path path = writeCsv("name\nAlpha\nALPHA\n");

        assertThat(seeder.seed(path)).isEqualTo(new SeedResult(1, 1));
        assertThat(seeder.seed(path)).isEqualTo(new SeedResult(0, 2));
        assertThat(skillRepository.count()).isEqualTo(1);
    }

    @Test
    void seedLeavesExistingSkillsUntouched() throws IOException {
        Skill existing = new Skill();
        existing.setName("alpha");
        existing.setAlias("keep");
        existing.setDescription("keep");
        skillRepository.saveAndFlush(existing);
        Path path = writeCsv("name,alias,description\nAlpha,new,new\n");

        assertThat(seeder.seed(path)).isEqualTo(new SeedResult(0, 1));

        Skill skill = skillRepository.search("alpha").getFirst();
        assertThat(skill.getName()).isEqualTo("alpha");
        assertThat(skill.getAlias()).isEqualTo("keep");
        assertThat(skill.getDescription()).isEqualTo("keep");
    }

    @Test
    void seedDoesNotReactivateSoftDeletedSkills() throws IOException {
        Skill deleted = new Skill();
        deleted.setName("alpha");
        deleted.setDeletedAt(OffsetDateTime.now());
        skillRepository.saveAndFlush(deleted);
        Path path = writeCsv("name\nAlpha\n");

        assertThat(seeder.seed(path)).isEqualTo(new SeedResult(0, 1));

        assertThat(skillRepository.count()).isEqualTo(1);
        assertThat(skillRepository.search("alpha")).isEmpty();
    }

    @Test
    void seedRejectsFileWithoutNameColumn() throws IOException {
        Path path = writeCsv("alias,description\npy,x\n");

        assertThatThrownBy(() -> seeder.seed(path))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("missing required column 'name'");
    }

    @Test
    void seedRejectsTheWholeFileOnAnEmptyName() throws IOException {
        Path path = writeCsv("name,alias\nAlpha,\n ,x\n");

        assertThatThrownBy(() -> seeder.seed(path))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("line 3 has no name");
        assertThat(skillRepository.count()).isZero();
    }

    @Test
    void seedFailsForAMissingFile() {
        assertThatThrownBy(() -> seeder.seed(tempDir.resolve("missing.csv")))
                .isInstanceOf(NoSuchFileException.class);
    }
}
