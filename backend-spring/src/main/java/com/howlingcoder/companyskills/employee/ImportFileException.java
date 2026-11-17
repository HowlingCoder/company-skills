package com.howlingcoder.companyskills.employee;

/**
 * The file as a whole cannot be imported: the controller answers 400.
 */
class ImportFileException extends RuntimeException {
    ImportFileException(String message) {
        super(message);
    }
}
