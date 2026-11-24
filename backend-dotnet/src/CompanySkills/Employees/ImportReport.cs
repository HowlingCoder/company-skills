namespace CompanySkills.Employees;

/// <summary>One valid CSV row; only the user's own data, no ids.</summary>
public record ImportedRow(string Lastname, string Firstname, string Email, int Age);

public record RowError(int Line, string Message);

public record ImportReport(int ImportedCount, int FailedCount, List<ImportedRow> Imported, List<RowError> Errors);
