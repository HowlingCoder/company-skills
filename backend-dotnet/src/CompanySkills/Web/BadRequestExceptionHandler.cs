using Microsoft.AspNetCore.Diagnostics;

namespace CompanySkills.Web;

/// <summary>
/// ASP.NET Core answers input it cannot bind (malformed JSON, a missing required field,
/// "not-a-uuid" for a Guid) with 400. The frontend and the other backends use 422 for that,
/// so it is mapped here. Other statuses (e.g. 413 for a too large body) stay as they are.
/// </summary>
internal sealed class BadRequestExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not BadHttpRequestException badRequest)
        {
            return false;
        }

        var status = badRequest.StatusCode == StatusCodes.Status400BadRequest
            ? StatusCodes.Status422UnprocessableEntity
            : badRequest.StatusCode;
        context.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = { Status = status, Detail = "Invalid request" },
        });
    }
}
