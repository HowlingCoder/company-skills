using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using CompanySkills.Employees;
using Microsoft.EntityFrameworkCore;

namespace CompanySkills.Tests;

/// <summary>Port of backend-spring EmployeeImportControllerTests.</summary>
public class EmployeeImportTests(DatabaseFixture fixture) : IntegrationTest(fixture)
{
    private async Task<HttpResponseMessage> Upload(byte[] content)
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new("text/csv");
        return await Client.PostAsync("/employees/import", new MultipartFormDataContent { { file, "file", "employees.csv" } });
    }

    private Task<HttpResponseMessage> Upload(string content) => Upload(Encoding.UTF8.GetBytes(content));

    /// <summary>All employees in the database as "lastname firstname email age", sorted by email.</summary>
    private async Task<List<string>> Stored()
    {
        await using var db = Fixture.CreateContext();
        return (await db.Employees.OrderBy(e => e.Email).ToListAsync())
            .Select(e => $"{e.Lastname} {e.Firstname} {e.Email} {e.Age}")
            .ToList();
    }

    private static List<RowError> Errors(JsonNode body) =>
        body["errors"]!.AsArray().Select(e => new RowError((int)e!["line"]!, (string)e["message"]!)).ToList();

    [Fact]
    public async Task Imports_valid_rows_and_reports_only_the_users_own_data()
    {
        var response = await Upload("""
            Lastname,Firstname,E-Mail,Age,Address
            Muster,Max,max@example.com,30,Main Street 1
            Adler,Anna,anna@example.com,41,Side Street 2

            """);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var expected = JsonNode.Parse("""
            {
              "imported_count": 2,
              "failed_count": 0,
              "imported": [
                {"lastname": "Muster", "firstname": "Max", "email": "max@example.com", "age": 30},
                {"lastname": "Adler", "firstname": "Anna", "email": "anna@example.com", "age": 41}
              ],
              "errors": []
            }
            """);
        var body = await Json(response);
        Assert.True(JsonNode.DeepEquals(expected, body), body.ToJsonString());
        Assert.Equal(["Adler Anna anna@example.com 41", "Muster Max max@example.com 30"], await Stored());
    }

    [Fact]
    public async Task Excel_export_with_semicolons_and_bom_is_imported()
    {
        var response = await Upload("﻿Lastname;Firstname;E-Mail;Age;Address\r\n"
                                    + "Müller;Zoë;zoe@example.com;28;Main Street 1, Munich\r\n");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["Müller Zoë zoe@example.com 28"], await Stored());
    }

    [Fact]
    public async Task Headers_are_matched_regardless_of_case_whitespace_and_order()
    {
        var response = await Upload(" AGE , e-mail ,FIRSTNAME, LastName \n30,max@example.com,Max,Muster\n");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["Muster Max max@example.com 30"], await Stored());
    }

    [Fact]
    public async Task Existing_employee_is_updated_by_email_ignoring_case()
    {
        var employee = await AddEmployee(email: "max@example.com");

        var body = await Json(await Upload("lastname,firstname,email,age\nMeier,Maximilian, MAX@Example.com ,31\n"));

        Assert.Equal(1, (int)body["imported_count"]!);
        Assert.Equal(["Meier Maximilian max@example.com 31"], await Stored());
        await using var db = Fixture.CreateContext();
        Assert.Equal(employee.Id, (await db.Employees.SingleAsync()).Id);
    }

    [Fact]
    public async Task Invalid_rows_are_reported_with_their_line_and_valid_rows_still_imported()
    {
        var response = await Upload("""
            lastname,firstname,email,age
            Muster,Max,max@example.com,30
            Alt,Ada,ada@example.com,abc
            Null,Nora,nora@example.com,0
            ,Otto,otto@example.com,40
            Kein,Karl,not-an-email,40
            Short,Sam,sam@example.com
            Ende,Eva,eva@example.com,50

            """);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await Json(response);
        Assert.Equal(2, (int)body["imported_count"]!);
        Assert.Equal(5, (int)body["failed_count"]!);
        Assert.Equal(
        [
            new RowError(3, "age must be a whole number between 1 and 150"),
            new RowError(4, "age must be a whole number between 1 and 150"),
            new RowError(5, "lastname is required"),
            new RowError(6, "email is not a valid email address"),
            new RowError(7, "Unreadable row: expected 4 columns, found 3"),
        ], Errors(body));
        Assert.Equal(["Ende Eva eva@example.com 50", "Muster Max max@example.com 30"], await Stored());
    }

    [Fact]
    public async Task Email_longer_than_254_characters_is_rejected()
    {
        const string domain = "@example.com";
        var longest = new string('a', 254 - domain.Length) + domain;
        var tooLong = "a" + longest;

        var body = await Json(await Upload($"lastname,firstname,email,age\nLang,Lea,{longest},30\nZu,Zoe,{tooLong},30\n"));

        Assert.Equal([longest], Strings(body["imported"], "email"));
        Assert.Equal([new RowError(3, "email is not a valid email address")], Errors(body));
    }

    [Fact]
    public async Task Row_with_several_problems_reports_all_of_them()
    {
        var body = await Json(await Upload("lastname,firstname,email,age\n,,nobody,-1\n"));

        Assert.Equal(
        [
            new RowError(2, "lastname is required; firstname is required; email is not a valid email address; "
                            + "age must be a whole number between 1 and 150"),
        ], Errors(body));
    }

    [Fact]
    public async Task Duplicate_email_in_file_keeps_first_occurrence()
    {
        var body = await Json(await Upload("""
            lastname,firstname,email,age
            Muster,Max,max@example.com,30
            Other,Otto,MAX@example.com,40

            """));

        Assert.Equal(1, (int)body["imported_count"]!);
        Assert.Equal([new RowError(3, "Duplicate email max@example.com: already used in line 2")], Errors(body));
        Assert.Equal(["Muster Max max@example.com 30"], await Stored());
    }

    [Fact]
    public async Task Soft_deleted_employee_is_neither_updated_nor_reactivated()
    {
        var employee = await AddEmployee(deleted: true, firstname: "Gone", email: "gone@example.com");

        var response = await Upload("lastname,firstname,email,age\nNew,Name,gone@example.com,44\n");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await Json(response);
        Assert.Empty(body["imported"]!.AsArray());
        Assert.Equal([new RowError(2, "Employee gone@example.com was deleted and is not reactivated")], Errors(body));
        await using var db = Fixture.CreateContext();
        var reloaded = await db.Employees.SingleAsync(e => e.Id == employee.Id);
        Assert.Equal("Gone", reloaded.Firstname);
        Assert.NotNull(reloaded.DeletedAt);
    }

    [Fact]
    public async Task Line_numbers_count_blank_lines_and_multiline_fields()
    {
        var body = await Json(await Upload("lastname,firstname,email,age,address\n"
                                           + "\n"
                                           + "Muster,Max,max@example.com,30,\"Main Street 1\nMunich\"\n"
                                           + "Bad,Row,nobody,30,\n"));

        Assert.Equal(1, (int)body["imported_count"]!);
        Assert.Equal([5], Errors(body).Select(e => e.Line));
    }

    [Fact]
    public async Task Broken_quoting_stops_reading_and_is_reported()
    {
        var body = await Json(await Upload("lastname,firstname,email,age\n"
                                           + "Muster,Max,max@example.com,30\n"
                                           + "\"Open,Ada,ada@example.com,40\n"));

        Assert.Equal(1, (int)body["imported_count"]!);
        Assert.Equal([3], Errors(body).Select(e => e.Line));
        Assert.StartsWith("Unreadable row", Errors(body)[0].Message);
    }

    [Fact]
    public async Task Header_without_data_rows_returns_empty_report()
    {
        var response = await Upload("lastname,firstname,email,age\n");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var expected = JsonNode.Parse("""{"imported_count": 0, "failed_count": 0, "imported": [], "errors": []}""");
        Assert.True(JsonNode.DeepEquals(expected, await Json(response)));
    }

    public static TheoryData<byte[], string> UnusableFiles() => new()
    {
        { [], "File is empty" },
        { Encoding.UTF8.GetBytes("\n  \n"), "File is empty" },
        { Encoding.UTF8.GetBytes("lastname,firstname,age\nMuster,Max,30\n"), "Missing required columns: email" },
        { Encoding.UTF8.GetBytes("name;mail\nMax;max@example.com\n"), "Missing required columns: lastname, firstname, email, age" },
        { [.. Encoding.BigEndianUnicode.GetPreamble(), .. Encoding.BigEndianUnicode.GetBytes("lastname,firstname,email,age\n")], "File is not UTF-8" },
        { [(byte)'P', (byte)'K', 3, 4, 0, 0, 0], "File is not a text file" },
    };

    [Theory]
    [MemberData(nameof(UnusableFiles))]
    public async Task Unusable_file_is_rejected_as_a_whole(byte[] content, string detail)
    {
        var response = await Upload(content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.StartsWith(detail, (string)(await Json(response))["detail"]!);
    }

    [Fact]
    public async Task Rejected_file_imports_nothing()
    {
        var response = await Upload("lastname,firstname,email\nMuster,Max,max@x.io\n");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(await Stored());
    }

    [Fact]
    public async Task Request_that_is_not_multipart_is_a_client_error()
    {
        var response = await Client.PostAsync("/employees/import", null);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task Request_without_file_is_a_client_error()
    {
        var withoutBoundary = new ByteArrayContent([]);
        withoutBoundary.Headers.ContentType = new("multipart/form-data");

        var response = await Client.PostAsync("/employees/import", withoutBoundary);
        var withoutFilePart = await Client.PostAsync("/employees/import",
            new MultipartFormDataContent { { new StringContent("x"), "other" } });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, withoutFilePart.StatusCode);
    }
}
