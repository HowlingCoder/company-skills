using System.Text;
using CompanySkills.Csv;
using CompanySkills.Data;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Skills;

/// <summary>How many skills were new and how many were already in the catalog.</summary>
public record SeedResult(int Inserted, int AlreadyPresent);

/// <summary>
/// Fills the skill catalog from a CSV file (columns name, alias, description).
/// Port of backend/src/skill_management/seed.py.
/// </summary>
public class SkillSeeder(AppDbContext db)
{
    private record SeedRow(string Name, string? Alias, string? Description);

    /// <summary>
    /// Inserts the skills that are not in the catalog yet. Existing skills are matched by
    /// lower(name) and left untouched, including soft-deleted ones.
    /// </summary>
    /// <exception cref="InvalidDataException">The file is invalid; nothing is inserted.</exception>
    /// <exception cref="FileNotFoundException">The file does not exist.</exception>
    public async Task<SeedResult> SeedAsync(string path, CancellationToken ct = default)
    {
        var rows = ReadSkills(path, await File.ReadAllTextAsync(path, Encoding.UTF8, ct));

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var inserted = 0;
        foreach (var row in rows)
        {
            inserted += await db.Database.ExecuteSqlAsync($"""
                insert into skill (id, name, alias, description)
                values (gen_random_uuid(), {row.Name}, cast({row.Alias} as text), cast({row.Description} as text))
                on conflict ((lower(name))) do nothing
                """, ct);
        }

        await transaction.CommitAsync(ct);
        return new SeedResult(inserted, rows.Count - inserted);
    }

    /// <summary>Reads the seed file; any invalid row rejects the whole file.</summary>
    private static List<SeedRow> ReadSkills(string path, string text)
    {
        var records = CsvReader.Read(text.TrimStart('﻿'), ',').Where(r => !r.IsBlank).ToList();
        var headers = records.FirstOrDefault()?.Fields.Select(h => h.Trim()).ToList() ?? [];
        if (!headers.Contains("name"))
        {
            throw new InvalidDataException($"{path}: missing required column 'name'");
        }

        return records.Skip(1).Select(record =>
        {
            string? Value(string column)
            {
                var index = headers.IndexOf(column);
                var value = index >= 0 && index < record.Fields.Count ? record.Fields[index].Trim() : "";
                return value.Length == 0 ? null : value;
            }

            var name = Value("name") ?? throw new InvalidDataException($"{path}: line {record.Line} has no name");
            return new SeedRow(name, Value("alias"), Value("description"));
        }).ToList();
    }
}
