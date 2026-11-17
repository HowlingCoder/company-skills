package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.employee.EmployeeCsvParser.ParseResult;
import com.howlingcoder.companyskills.employee.EmployeeCsvParser.ParsedRow;
import com.howlingcoder.companyskills.employee.ImportReport.ImportedRow;
import com.howlingcoder.companyskills.employee.ImportReport.RowError;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
class EmployeeImportController {
    private final EmployeeRepository employeeRepository;
    private final EmployeeCsvParser csvParser;

    EmployeeImportController(EmployeeRepository employeeRepository, EmployeeCsvParser csvParser) {
        this.employeeRepository = employeeRepository;
        this.csvParser = csvParser;
    }

    /**
     * Upsert employees from a CSV by email; invalid rows end up in the report.
     */
    @PostMapping("/employees/import")
    @Transactional
    public ImportReport importEmployees(@RequestParam("file") MultipartFile file) throws IOException {
        ParseResult parsed;
        try {
            parsed = csvParser.parse(file.getBytes());
        } catch (ImportFileException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage());
        }

        // Existing employees by lowercase email; this includes soft-deleted ones (see the loop below)
        List<String> emails = parsed.rows().stream().map(r -> r.row().email()).toList();
        Map<String, Employee> existing = emails.isEmpty() ? Map.of()
                : employeeRepository.findByLowerEmailIn(emails).stream()
                .collect(Collectors.toMap(e -> e.getEmail().toLowerCase(Locale.ROOT), Function.identity(), (a, b) -> a));

        List<RowError> errors = new ArrayList<>(parsed.errors());
        List<ImportedRow> imported = new ArrayList<>();
        List<Employee> created = new ArrayList<>();

        for (ParsedRow parsedRow : parsed.rows()) {
            ImportedRow row = parsedRow.row();
            Employee employee = existing.get(row.email());
            if (employee == null) {
                employee = new Employee();
                created.add(employee);
            } else if (employee.getDeletedAt() != null) {
                errors.add(new RowError(parsedRow.line(),
                        "Employee " + row.email() + " was deleted and is not reactivated"));
                continue;
            }
            // For an existing employee this is a plain update: Hibernate writes it on commit
            employee.setLastname(row.lastname());
            employee.setFirstname(row.firstname());
            employee.setEmail(row.email());
            employee.setAge(row.age());
            imported.add(row);
        }
        employeeRepository.saveAll(created);

        errors.sort(Comparator.comparingInt(RowError::line));
        return new ImportReport(imported.size(), errors.size(), imported, errors);
    }
}
