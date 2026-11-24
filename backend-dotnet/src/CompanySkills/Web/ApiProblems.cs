using Microsoft.AspNetCore.Http.HttpResults;

namespace CompanySkills.Web;

/// <summary>
/// Error responses as {"detail": "..."} (RFC 9457 problem details), the field the frontend reads.
/// </summary>
public static class ApiProblems
{
    public static ProblemHttpResult NotFound(string detail) => TypedResults.Problem(detail, statusCode: 404);

    public static ProblemHttpResult BadRequest(string detail) => TypedResults.Problem(detail, statusCode: 400);

    /// <summary>The shape of the input is wrong, e.g. a level outside 1-5.</summary>
    public static ProblemHttpResult Unprocessable(string detail) => TypedResults.Problem(detail, statusCode: 422);
}
