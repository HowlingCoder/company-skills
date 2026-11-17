package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.employee.ImportReport.ImportedRow;
import com.howlingcoder.companyskills.employee.ImportReport.RowError;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Port of backend/src/skill_management/employee_import.py.
 */
@Component
class EmployeeCsvParser {
    private static final List<String> REQUIRED_COLUMNS = List.of("lastname", "firstname", "email", "age");
    // Unicode: Python's \s also matches non-ASCII whitespace
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+", Pattern.UNICODE_CHARACTER_CLASS);
    // Longest address SMTP can deliver to (RFC 5321). Also keeps the pattern fast
    private static final int MAX_EMAIL_LENGTH = 254;
    private static final int MAX_AGE = 150;

    /**
     * A valid row with the line it starts on.
     */
    record ParsedRow(int line, ImportedRow row) {
    }

    record ParseResult(List<ParsedRow> rows, List<RowError> errors) {
    }

    /**
     * Reads an employee CSV into valid rows and row errors, both with line numbers.
     * Line numbers match a spreadsheet: the header is line 1.
     *
     * @throws ImportFileException if the file is empty, unreadable or lacks a required column
     */
    ParseResult parse(byte[] content) {
        String text = decode(content);
        if (text.indexOf('\u0000') >= 0) {
            throw new ImportFileException("File is not a text file");
        }

        String headerLine = text.lines().filter(line -> !line.isBlank()).findFirst()
                .orElseThrow(() -> new ImportFileException("File is empty"));

        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setDelimiter(detectDelimiter(headerLine))
                // Blank lines stay records, so every line belongs to one record and line numbers add up
                .setIgnoreEmptyLines(false)
                .get();

        List<ParsedRow> rows = new ArrayList<>();
        List<RowError> errors = new ArrayList<>();
        Map<String, Integer> firstLineByEmail = new HashMap<>();

        try (CSVParser parser = CSVParser.builder().setReader(new StringReader(text)).setFormat(format).get()) {
            Iterator<CSVRecord> records = parser.iterator();
            List<String> headers = readHeaders(records);
            checkRequiredColumns(headers);
            // The iterator reads one record ahead, so the line number is only read right after hasNext():
            // it is then the last line of the record that next() returns. Every line is a record
            // (blank lines too), so a record starts on the line after the previous one ended.
            int previousEndLine = (int) parser.getCurrentLineNumber();

            while (true) {
                // A quoted field can span lines; report the line the row starts on
                int line = previousEndLine + 1;
                CSVRecord record;
                try {
                    if (!records.hasNext()) {
                        break;
                    }
                    previousEndLine = (int) parser.getCurrentLineNumber();
                    record = records.next();
                } catch (UncheckedIOException | IllegalStateException error) {
                    // The parser cannot continue after a broken row
                    errors.add(new RowError(line, "Unreadable row: " + error.getMessage()));
                    break;
                }

                if (record.stream().allMatch(String::isBlank)) {
                    continue;
                }
                if (record.size() != headers.size()) {
                    errors.add(new RowError(line, "Unreadable row: expected " + headers.size()
                            + " columns, found " + record.size()));
                    continue;
                }
                validate(record, headers, line, firstLineByEmail, rows, errors);
            }
        } catch (IOException error) {
            throw new ImportFileException("File is not a readable CSV file");
        }
        return new ParseResult(rows, errors);
    }

    private static String decode(byte[] content) {
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(content))
                    .toString();
            // Strip the BOM of an Excel export
            return text.startsWith("﻿") ? text.substring(1) : text;
        } catch (CharacterCodingException error) {
            throw new ImportFileException("File is not UTF-8 encoded text");
        }
    }

    private static char detectDelimiter(String headerLine) {
        long semicolons = headerLine.chars().filter(c -> c == ';').count();
        long commas = headerLine.chars().filter(c -> c == ',').count();
        return semicolons > commas ? ';' : ',';
    }

    private static List<String> readHeaders(Iterator<CSVRecord> records) {
        try {
            while (records.hasNext()) {
                CSVRecord record = records.next();
                if (!record.stream().allMatch(String::isBlank)) {
                    return record.stream().map(EmployeeCsvParser::normalizeHeader).toList();
                }
            }
        } catch (UncheckedIOException | IllegalStateException error) {
            throw new ImportFileException("File is not a readable CSV file");
        }
        throw new ImportFileException("File is empty");
    }

    private static String normalizeHeader(String header) {
        return header.strip().toLowerCase(Locale.ROOT).replace("-", "");
    }

    private static void checkRequiredColumns(List<String> headers) {
        List<String> missing = REQUIRED_COLUMNS.stream().filter(column -> !headers.contains(column)).toList();
        if (!missing.isEmpty()) {
            throw new ImportFileException("Missing required columns: " + String.join(", ", missing));
        }
    }

    private static void validate(CSVRecord record, List<String> headers, int line,
                                 Map<String, Integer> firstLineByEmail,
                                 List<ParsedRow> rows, List<RowError> errors) {
        String lastname = value(record, headers, "lastname").strip();
        String firstname = value(record, headers, "firstname").strip();
        // Lowercase: the email is the upsert key and the unique constraint is case-sensitive
        String email = value(record, headers, "email").strip().toLowerCase(Locale.ROOT);
        String age = value(record, headers, "age").strip();

        List<String> problems = new ArrayList<>();
        if (lastname.isEmpty()) {
            problems.add("lastname is required");
        }
        if (firstname.isEmpty()) {
            problems.add("firstname is required");
        }
        if (email.length() > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.matcher(email).matches()) {
            problems.add("email is not a valid email address");
        }
        Integer ageNumber = parseAge(age);
        if (ageNumber == null) {
            problems.add("age must be a whole number between 1 and " + MAX_AGE);
        }
        if (!problems.isEmpty()) {
            errors.add(new RowError(line, String.join("; ", problems)));
            return;
        }

        Integer firstLine = firstLineByEmail.get(email);
        if (firstLine != null) {
            errors.add(new RowError(line, "Duplicate email " + email + ": already used in line " + firstLine));
            return;
        }
        firstLineByEmail.put(email, line);
        rows.add(new ParsedRow(line, new ImportedRow(lastname, firstname, email, ageNumber)));
    }

    // The header may list a column twice; the last one wins, like dict(zip(...)) in Python
    private static String value(CSVRecord record, List<String> headers, String column) {
        return record.get(headers.lastIndexOf(column));
    }

    private static Integer parseAge(String value) {
        // ASCII only: Character.isDigit also accepts digits of other scripts
        if (value.isEmpty() || value.length() > 3 || !value.chars().allMatch(c -> c >= '0' && c <= '9')) {
            return null;
        }
        int age = Integer.parseInt(value);
        return age >= 1 && age <= MAX_AGE ? age : null;
    }
}
