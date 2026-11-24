using System.Text;
using System.Text.RegularExpressions;
using CompanySkills.Csv;

namespace CompanySkills.Employees;

/// <summary>The file as a whole cannot be imported: the endpoint answers 400.</summary>
public class ImportFileException(string message) : Exception(message);

/// <summary>A valid row with the line it starts on.</summary>
public record ParsedRow(int Line, ImportedRow Row);

public record ParseResult(List<ParsedRow> Rows, List<RowError> Errors);

/// <summary>Port of backend/src/skill_management/employee_import.py.</summary>
public static partial class EmployeeCsvParser
{
    private static readonly string[] RequiredColumns = ["lastname", "firstname", "email", "age"];

    // Longest address SMTP can deliver to (RFC 5321). Also keeps the pattern fast
    private const int MaxEmailLength = 254;
    private const int MaxAge = 150;

    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    [GeneratedRegex(@"\A[^@\s]+@[^@\s]+\.[^@\s]+\z")]
    private static partial Regex EmailPattern();

    /// <summary>
    /// Reads an employee CSV into valid rows and row errors, both with line numbers.
    /// Line numbers match a spreadsheet: the header is line 1.
    /// </summary>
    /// <exception cref="ImportFileException">The file is empty, unreadable or lacks a required column.</exception>
    public static ParseResult Parse(byte[] content)
    {
        var text = Decode(content);
        if (text.Contains('\0'))
        {
            throw new ImportFileException("File is not a text file");
        }

        var headerLine = text.Split('\r', '\n').FirstOrDefault(line => !string.IsNullOrWhiteSpace(line))
                         ?? throw new ImportFileException("File is empty");

        var rows = new List<ParsedRow>();
        var errors = new List<RowError>();
        var firstLineByEmail = new Dictionary<string, int>();

        using var records = CsvReader.Read(text, DetectDelimiter(headerLine)).GetEnumerator();
        var headers = ReadHeaders(records);
        CheckRequiredColumns(headers);

        while (true)
        {
            try
            {
                if (!records.MoveNext())
                {
                    break;
                }
            }
            catch (CsvFormatException error)
            {
                // The reader cannot continue after a broken row
                errors.Add(new RowError(error.Line, $"Unreadable row: {error.Message}"));
                break;
            }

            var record = records.Current;
            if (record.IsBlank)
            {
                continue;
            }

            if (record.Fields.Count != headers.Count)
            {
                errors.Add(new RowError(record.Line,
                    $"Unreadable row: expected {headers.Count} columns, found {record.Fields.Count}"));
                continue;
            }

            Validate(record, headers, firstLineByEmail, rows, errors);
        }

        return new ParseResult(rows, errors);
    }

    private static string Decode(byte[] content)
    {
        try
        {
            // Strip the BOM of an Excel export
            return StrictUtf8.GetString(content).TrimStart('﻿');
        }
        catch (DecoderFallbackException)
        {
            throw new ImportFileException("File is not UTF-8 encoded text");
        }
    }

    private static char DetectDelimiter(string headerLine) =>
        headerLine.Count(c => c == ';') > headerLine.Count(c => c == ',') ? ';' : ',';

    private static List<string> ReadHeaders(IEnumerator<CsvRecord> records)
    {
        try
        {
            while (records.MoveNext())
            {
                if (!records.Current.IsBlank)
                {
                    return records.Current.Fields.Select(NormalizeHeader).ToList();
                }
            }
        }
        catch (CsvFormatException)
        {
            throw new ImportFileException("File is not a readable CSV file");
        }

        throw new ImportFileException("File is empty");
    }

    private static string NormalizeHeader(string header) => header.Trim().ToLowerInvariant().Replace("-", "");

    private static void CheckRequiredColumns(List<string> headers)
    {
        var missing = RequiredColumns.Where(column => !headers.Contains(column)).ToList();
        if (missing.Count > 0)
        {
            throw new ImportFileException($"Missing required columns: {string.Join(", ", missing)}");
        }
    }

    private static void Validate(CsvRecord record, List<string> headers, Dictionary<string, int> firstLineByEmail,
        List<ParsedRow> rows, List<RowError> errors)
    {
        // The header may list a column twice; the last one wins, like dict(zip(...)) in Python
        string Value(string column) => record.Fields[headers.LastIndexOf(column)].Trim();

        var lastname = Value("lastname");
        var firstname = Value("firstname");
        // Lowercase: the email is the upsert key and the unique constraint is case-sensitive
        var email = Value("email").ToLowerInvariant();
        var age = ParseAge(Value("age"));

        var problems = new List<string>();
        if (lastname.Length == 0)
        {
            problems.Add("lastname is required");
        }

        if (firstname.Length == 0)
        {
            problems.Add("firstname is required");
        }

        if (email.Length > MaxEmailLength || !EmailPattern().IsMatch(email))
        {
            problems.Add("email is not a valid email address");
        }

        if (age is null)
        {
            problems.Add($"age must be a whole number between 1 and {MaxAge}");
        }

        if (problems.Count > 0)
        {
            errors.Add(new RowError(record.Line, string.Join("; ", problems)));
            return;
        }

        if (firstLineByEmail.TryGetValue(email, out var firstLine))
        {
            errors.Add(new RowError(record.Line, $"Duplicate email {email}: already used in line {firstLine}"));
            return;
        }

        firstLineByEmail[email] = record.Line;
        rows.Add(new ParsedRow(record.Line, new ImportedRow(lastname, firstname, email, age!.Value)));
    }

    private static int? ParseAge(string value)
    {
        // ASCII digits only: char.IsDigit also accepts digits of other scripts
        if (value.Length is 0 or > 3 || !value.All(char.IsAsciiDigit))
        {
            return null;
        }

        var age = int.Parse(value);
        return age is >= 1 and <= MaxAge ? age : null;
    }
}
