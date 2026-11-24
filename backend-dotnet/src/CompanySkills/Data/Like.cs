namespace CompanySkills.Data;

public static class Like
{
    /// <summary>
    /// Escapes %, _ and the escape character itself, so user input in a LIKE pattern
    /// is matched literally. Use with "\" as escape character.
    /// </summary>
    public static string Escape(string value) =>
        value.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
}
