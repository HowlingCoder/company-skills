using CompanySkills.Data;
using CompanySkills.Web;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Employees;

public static class EmployeeImportEndpoints
{
    public static void MapEmployeeImportEndpoints(this IEndpointRouteBuilder app) =>
        app.MapPost("/employees/import", ImportEmployees);

    /// <summary>Upsert employees from a CSV by email; invalid rows end up in the report.</summary>
    private static async Task<Results<Ok<ImportReport>, ProblemHttpResult>> ImportEmployees(
        HttpRequest request, AppDbContext db, CancellationToken ct)
    {
        // Read by hand instead of binding IFormFile: a request without a (readable) file part
        // is a 422, like in the other backends, not a 400/415 from the framework
        if (!request.HasFormContentType)
        {
            return ApiProblems.Unprocessable("Expected a multipart file upload");
        }

        IFormFile? file;
        try
        {
            file = (await request.ReadFormAsync(ct)).Files.GetFile("file");
        }
        catch (InvalidDataException)
        {
            return ApiProblems.Unprocessable("Expected a multipart file upload");
        }

        if (file is null)
        {
            return ApiProblems.Unprocessable("Required input is missing");
        }

        using var content = new MemoryStream();
        await file.CopyToAsync(content, ct);

        ParseResult parsed;
        try
        {
            parsed = EmployeeCsvParser.Parse(content.ToArray());
        }
        catch (ImportFileException error)
        {
            return ApiProblems.BadRequest(error.Message);
        }

        // Existing employees by lowercase email; this includes soft-deleted ones (see the loop below)
        var emails = parsed.Rows.Select(r => r.Row.Email).ToList();
        var existing = (await db.Employees.Where(e => emails.Contains(e.Email.ToLower())).ToListAsync(ct))
            .DistinctBy(e => e.Email.ToLowerInvariant())
            .ToDictionary(e => e.Email.ToLowerInvariant());

        var errors = new List<RowError>(parsed.Errors);
        var imported = new List<ImportedRow>();

        foreach (var (line, row) in parsed.Rows)
        {
            if (!existing.TryGetValue(row.Email, out var employee))
            {
                employee = new Employee { Firstname = row.Firstname, Lastname = row.Lastname, Email = row.Email };
                db.Employees.Add(employee);
            }
            else if (employee.DeletedAt is not null)
            {
                errors.Add(new RowError(line, $"Employee {row.Email} was deleted and is not reactivated"));
                continue;
            }

            // For an existing employee this is a plain update: the change tracker writes it on save
            employee.Lastname = row.Lastname;
            employee.Firstname = row.Firstname;
            employee.Email = row.Email;
            employee.Age = row.Age;
            imported.Add(row);
        }

        await db.SaveChangesAsync(ct);

        return TypedResults.Ok(new ImportReport(imported.Count, errors.Count, imported,
            errors.OrderBy(e => e.Line).ToList()));
    }
}
