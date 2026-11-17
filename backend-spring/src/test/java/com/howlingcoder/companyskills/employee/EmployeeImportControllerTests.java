package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Port of backend/tests/test_employee_import.py.
 * Every test runs in a transaction that is rolled back afterwards.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EmployeeImportControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EmployeeRepository employeeRepository;

    @PersistenceContext
    private EntityManager entityManager;

    private ResultActions upload(byte[] content) throws Exception {
        return mockMvc.perform(multipart("/employees/import")
                .file(new MockMultipartFile("file", "employees.csv", "text/csv", content)));
    }

    private ResultActions upload(String content) throws Exception {
        return upload(content.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * All employees in the database as "lastname firstname email age", sorted by email.
     */
    private List<String> stored() {
        entityManager.flush();
        entityManager.clear();
        return employeeRepository.findAll().stream()
                .sorted(java.util.Comparator.comparing(Employee::getEmail))
                .map(e -> "%s %s %s %d".formatted(e.getLastname(), e.getFirstname(), e.getEmail(), e.getAge()))
                .toList();
    }

    private Employee addEmployee(String firstname, String email, OffsetDateTime deletedAt) {
        Employee employee = new Employee();
        employee.setFirstname(firstname);
        employee.setLastname("Muster");
        employee.setEmail(email);
        employee.setAge(30);
        employee.setDeletedAt(deletedAt);
        entityManager.persist(employee);
        entityManager.flush();
        return employee;
    }

    @Test
    void importsValidRowsAndReportsOnlyTheUsersOwnData() throws Exception {
        upload("""
                Lastname,Firstname,E-Mail,Age,Address
                Muster,Max,max@example.com,30,Main Street 1
                Adler,Anna,anna@example.com,41,Side Street 2
                """)
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {
                          "imported_count": 2,
                          "failed_count": 0,
                          "imported": [
                            {"lastname": "Muster", "firstname": "Max", "email": "max@example.com", "age": 30},
                            {"lastname": "Adler", "firstname": "Anna", "email": "anna@example.com", "age": 41}
                          ],
                          "errors": []
                        }
                        """, JsonCompareMode.STRICT));

        assertThat(stored()).containsExactly(
                "Adler Anna anna@example.com 41",
                "Muster Max max@example.com 30");
    }

    @Test
    void importedEmployeesAppearInTheOverview() throws Exception {
        upload("lastname,firstname,email,age\nMuster,Max,max@x.io,30\n");
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(get("/employees").param("q", "max@x.io"))
                .andExpect(jsonPath("$[*].firstname", contains("Max")))
                .andExpect(jsonPath("$[0].skills").isEmpty());
    }

    @Test
    void excelExportWithSemicolonsAndBomIsImported() throws Exception {
        String csv = "﻿Lastname;Firstname;E-Mail;Age;Address\r\n"
                + "Müller;Zoë;zoe@example.com;28;Main Street 1, Munich\r\n";

        upload(csv).andExpect(status().isOk());

        assertThat(stored()).containsExactly("Müller Zoë zoe@example.com 28");
    }

    @Test
    void headersAreMatchedRegardlessOfCaseWhitespaceAndOrder() throws Exception {
        upload(" AGE , e-mail ,FIRSTNAME, LastName \n30,max@example.com,Max,Muster\n")
                .andExpect(status().isOk());

        assertThat(stored()).containsExactly("Muster Max max@example.com 30");
    }

    @Test
    void existingEmployeeIsUpdatedByEmailIgnoringCase() throws Exception {
        Employee employee = addEmployee("Max", "max@example.com", null);

        upload("lastname,firstname,email,age\nMeier,Maximilian, MAX@Example.com ,31\n")
                .andExpect(jsonPath("$.imported_count").value(1));

        assertThat(stored()).containsExactly("Meier Maximilian max@example.com 31");
        assertThat(employeeRepository.findAll()).extracting(Employee::getId).containsExactly(employee.getId());
    }

    @Test
    void invalidRowsAreReportedWithTheirLineAndValidRowsStillImported() throws Exception {
        upload("""
                lastname,firstname,email,age
                Muster,Max,max@example.com,30
                Alt,Ada,ada@example.com,abc
                Null,Nora,nora@example.com,0
                ,Otto,otto@example.com,40
                Kein,Karl,not-an-email,40
                Short,Sam,sam@example.com
                Ende,Eva,eva@example.com,50
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imported_count").value(2))
                .andExpect(jsonPath("$.failed_count").value(5))
                .andExpect(content().json("""
                        {"errors": [
                          {"line": 3, "message": "age must be a whole number between 1 and 150"},
                          {"line": 4, "message": "age must be a whole number between 1 and 150"},
                          {"line": 5, "message": "lastname is required"},
                          {"line": 6, "message": "email is not a valid email address"},
                          {"line": 7, "message": "Unreadable row: expected 4 columns, found 3"}
                        ]}
                        """, JsonCompareMode.LENIENT));

        assertThat(stored()).containsExactly(
                "Ende Eva eva@example.com 50",
                "Muster Max max@example.com 30");
    }

    @Test
    void emailLongerThan254CharactersIsRejected() throws Exception {
        String domain = "@example.com";
        String longest = "a".repeat(254 - domain.length()) + domain;
        String tooLong = "a" + longest;

        upload("lastname,firstname,email,age\nLang,Lea,%s,30\nZu,Zoe,%s,30\n".formatted(longest, tooLong))
                .andExpect(jsonPath("$.imported[*].email", contains(longest)))
                .andExpect(content().json("""
                        {"errors": [{"line": 3, "message": "email is not a valid email address"}]}
                        """, JsonCompareMode.LENIENT));
    }

    @Test
    void rowWithSeveralProblemsReportsAllOfThem() throws Exception {
        upload("lastname,firstname,email,age\n,,nobody,-1\n")
                .andExpect(content().json("""
                        {"errors": [{"line": 2, "message":
                          "lastname is required; firstname is required; email is not a valid email address; age must be a whole number between 1 and 150"}]}
                        """, JsonCompareMode.LENIENT));
    }

    @Test
    void duplicateEmailInFileKeepsFirstOccurrence() throws Exception {
        upload("""
                lastname,firstname,email,age
                Muster,Max,max@example.com,30
                Other,Otto,MAX@example.com,40
                """)
                .andExpect(jsonPath("$.imported_count").value(1))
                .andExpect(content().json("""
                        {"errors": [{"line": 3, "message": "Duplicate email max@example.com: already used in line 2"}]}
                        """, JsonCompareMode.LENIENT));

        assertThat(stored()).containsExactly("Muster Max max@example.com 30");
    }

    @Test
    void softDeletedEmployeeIsNeitherUpdatedNorReactivated() throws Exception {
        Employee employee = addEmployee("Gone", "gone@example.com", OffsetDateTime.now());

        upload("lastname,firstname,email,age\nNew,Name,gone@example.com,44\n")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imported").isEmpty())
                .andExpect(content().json("""
                        {"errors": [{"line": 2, "message": "Employee gone@example.com was deleted and is not reactivated"}]}
                        """, JsonCompareMode.LENIENT));

        entityManager.flush();
        entityManager.clear();
        Employee reloaded = employeeRepository.findById(employee.getId()).orElseThrow();
        assertThat(reloaded.getFirstname()).isEqualTo("Gone");
        assertThat(reloaded.getDeletedAt()).isNotNull();
    }

    @Test
    void lineNumbersCountBlankLinesAndMultilineFields() throws Exception {
        upload("lastname,firstname,email,age,address\n"
                + "\n"
                + "Muster,Max,max@example.com,30,\"Main Street 1\nMunich\"\n"
                + "Bad,Row,nobody,30,\n")
                .andExpect(jsonPath("$.imported_count").value(1))
                .andExpect(jsonPath("$.errors[*].line", contains(5)));
    }

    @Test
    void headerWithoutDataRowsReturnsEmptyReport() throws Exception {
        upload("lastname,firstname,email,age\n")
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"imported_count": 0, "failed_count": 0, "imported": [], "errors": []}
                        """, JsonCompareMode.STRICT));
    }

    static Stream<Arguments> unusableFiles() {
        return Stream.of(
                Arguments.of(new byte[0], "File is empty"),
                Arguments.of("\n  \n".getBytes(StandardCharsets.UTF_8), "File is empty"),
                Arguments.of("lastname,firstname,age\nMuster,Max,30\n".getBytes(StandardCharsets.UTF_8),
                        "Missing required columns: email"),
                Arguments.of("name;mail\nMax;max@example.com\n".getBytes(StandardCharsets.UTF_8),
                        "Missing required columns: lastname, firstname, email, age"),
                Arguments.of("lastname,firstname,email,age\n".getBytes(StandardCharsets.UTF_16),
                        "File is not UTF-8"),
                Arguments.of(new byte[]{'P', 'K', 3, 4, 0, 0, 0}, "File is not a text file"));
    }

    @ParameterizedTest
    @MethodSource("unusableFiles")
    void unusableFileIsRejectedAsAWhole(byte[] content, String detail) throws Exception {
        upload(content)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", startsWith(detail)));
    }

    @Test
    void rejectedFileImportsNothing() throws Exception {
        upload("lastname,firstname,email\nMuster,Max,max@x.io\n").andExpect(status().isBadRequest());

        assertThat(stored()).isEmpty();
    }

    @Test
    void requestThatIsNotMultipartIsAClientError() throws Exception {
        mockMvc.perform(post("/employees/import"))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    void requestWithoutFileIsAClientError() throws Exception {
        mockMvc.perform(post("/employees/import").contentType("multipart/form-data"))
                .andExpect(status().isUnprocessableContent());
    }
}
