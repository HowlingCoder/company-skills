namespace CompanySkills.Assignments;

public static class ProficiencyLevel
{
    public const int Min = 1;
    public const int Max = 5;
    public const string Message = "proficiency_level must be between 1 and 5";

    public static bool IsValid(int level) => level is >= Min and <= Max;
}
