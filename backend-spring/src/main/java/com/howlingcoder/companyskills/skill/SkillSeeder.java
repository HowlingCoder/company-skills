package com.howlingcoder.companyskills.skill;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PushbackReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Port of backend/src/skill_management/seed.py: fills the skill catalog from a CSV file.
 */
@Component
public class SkillSeeder {
    private static final String INSERT = """
            insert into skill (id, name, alias, description)
            values (gen_random_uuid(), :name, cast(:alias as varchar), cast(:description as varchar))
            on conflict ((lower(name::text))) do nothing
            """;

    /**
     * How many skills were new and how many were already in the catalog.
     */
    public record SeedResult(int inserted, int alreadyPresent) {
    }

    private record SeedRow(String name, String alias, String description) {
    }

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Inserts the skills that are not in the catalog yet. Existing skills are matched by
     * lower(name) and left untouched, including soft-deleted ones.
     *
     * @throws IllegalArgumentException if the file is invalid; nothing is inserted then
     * @throws IOException              if the file cannot be read
     */
    @Transactional
    public SeedResult seed(Path path) throws IOException {
        List<SeedRow> rows = readSkills(path);

        int inserted = 0;
        for (SeedRow row : rows) {
            inserted += entityManager.createNativeQuery(INSERT)
                    .setParameter("name", row.name())
                    .setParameter("alias", row.alias())
                    .setParameter("description", row.description())
                    .executeUpdate();
        }
        return new SeedResult(inserted, rows.size() - inserted);
    }

    /**
     * Reads the seed file; any invalid row rejects the whole file.
     */
    private static List<SeedRow> readSkills(Path path) throws IOException {
        CSVFormat format = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).get();
        try (Reader reader = new InputStreamReader(Files.newInputStream(path), StandardCharsets.UTF_8);
             CSVParser parser = CSVParser.builder().setReader(skipBom(reader)).setFormat(format).get()) {
            if (!parser.getHeaderMap().containsKey("name")) {
                throw new IllegalArgumentException(path + ": missing required column 'name'");
            }
            List<SeedRow> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                String name = value(record, "name");
                if (name == null) {
                    throw new IllegalArgumentException(
                            path + ": line " + parser.getCurrentLineNumber() + " has no name");
                }
                rows.add(new SeedRow(name, value(record, "alias"), value(record, "description")));
            }
            return rows;
        }
    }

    /**
     * The trimmed value of a column, or null if it is missing or blank.
     */
    private static String value(CSVRecord record, String column) {
        if (!record.isSet(column)) {
            return null;
        }
        String value = record.get(column).strip();
        return value.isEmpty() ? null : value;
    }

    // The BOM of an Excel export would end up in the first header name
    private static Reader skipBom(Reader reader) throws IOException {
        PushbackReader pushback = new PushbackReader(reader, 1);
        int first = pushback.read();
        if (first != -1 && first != '﻿') {
            pushback.unread(first);
        }
        return pushback;
    }
}
