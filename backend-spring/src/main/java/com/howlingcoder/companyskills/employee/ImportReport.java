package com.howlingcoder.companyskills.employee;

import java.util.List;

public record ImportReport(
        int importedCount,
        int failedCount,
        List<ImportedRow> imported,
        List<RowError> errors
) {
    /**
     * One valid CSV row; only the user's own data, no ids.
     */
    public record ImportedRow(String lastname, String firstname, String email, int age) {
    }

    public record RowError(int line, String message) {
    }
}
