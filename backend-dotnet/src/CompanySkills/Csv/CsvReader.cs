using System.Text;

namespace CompanySkills.Csv;

/// <summary>One CSV record and the line it starts on (1-based, like a spreadsheet).</summary>
public record CsvRecord(int Line, IReadOnlyList<string> Fields)
{
    public bool IsBlank => Fields.All(string.IsNullOrWhiteSpace);
}

/// <summary>The text is not valid CSV from <see cref="Line"/> on; reading cannot continue.</summary>
public class CsvFormatException(int line, string message) : Exception(message)
{
    public int Line { get; } = line;
}

/// <summary>
/// Minimal RFC 4180 reader: quoted fields may contain the delimiter, line breaks and
/// doubled quotes. Blank lines are returned as records, so every line belongs to one
/// record and line numbers add up.
/// </summary>
public static class CsvReader
{
    public static IEnumerable<CsvRecord> Read(string text, char delimiter)
    {
        var position = 0;
        var line = 1;
        var field = new StringBuilder();

        while (position < text.Length)
        {
            var startLine = line;
            var fields = new List<string>();

            while (true)
            {
                if (position < text.Length && text[position] == '"')
                {
                    position++;
                    while (true)
                    {
                        if (position >= text.Length)
                        {
                            throw new CsvFormatException(startLine, "quoted field is not closed");
                        }

                        var c = text[position++];
                        if (c != '"')
                        {
                            if (c == '\n')
                            {
                                line++;
                            }

                            field.Append(c);
                        }
                        else if (position < text.Length && text[position] == '"')
                        {
                            field.Append('"');
                            position++;
                        }
                        else
                        {
                            break;
                        }
                    }

                    if (position < text.Length && text[position] != delimiter && text[position] is not ('\r' or '\n'))
                    {
                        throw new CsvFormatException(startLine, "unexpected character after a quoted field");
                    }
                }
                else
                {
                    while (position < text.Length && text[position] != delimiter && text[position] is not ('\r' or '\n'))
                    {
                        field.Append(text[position++]);
                    }
                }

                fields.Add(field.ToString());
                field.Clear();

                if (position >= text.Length)
                {
                    break;
                }

                if (text[position] == delimiter)
                {
                    position++;
                    continue;
                }

                // Line break: \r\n, \n or \r
                if (text[position] == '\r' && position + 1 < text.Length && text[position + 1] == '\n')
                {
                    position++;
                }

                position++;
                line++;
                break;
            }

            yield return new CsvRecord(startLine, fields);
        }
    }
}
