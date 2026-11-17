package com.howlingcoder.companyskills.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

/**
 * FastAPI answers invalid request input with 422, Spring with 400.
 * The frontend and the Python tests expect 422, so it is mapped here for all controllers.
 */
@RestControllerAdvice
class RequestValidationAdvice {

    // @Min, @Max, @Pattern on a @RequestParam failed, e.g. min_level=6
    @ExceptionHandler(HandlerMethodValidationException.class)
    ProblemDetail invalidParameter(HandlerMethodValidationException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, "Invalid request parameters");
    }

    // The value does not fit the Java type, e.g. min_level=high for an Integer
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ProblemDetail wrongType(MethodArgumentTypeMismatchException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, "Invalid value for " + ex.getName());
    }

    // @Valid on a @RequestBody failed, e.g. proficiency_level 6 or the same skill twice
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalidBody(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getAllErrors().stream()
                .map(error -> error instanceof FieldError field
                        ? field.getField() + ": " + field.getDefaultMessage()
                        : error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, detail);
    }

    // The body is not valid JSON or a value has the wrong type, e.g. skill_id is not a UUID
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail unreadableBody(HttpMessageNotReadableException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, "Invalid request body");
    }

    // A required @RequestParam or an uploaded file part is missing, e.g. POST /employees/import without "file"
    @ExceptionHandler({MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    ProblemDetail missingInput(Exception ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, "Required input is missing");
    }

    // The request is not multipart at all, e.g. a plain POST /employees/import without a body.
    // An upload over the size limit is a MultipartException too, but its own status: 413
    @ExceptionHandler(MultipartException.class)
    ProblemDetail notMultipart(MultipartException ex) {
        if (ex instanceof MaxUploadSizeExceededException) {
            return ProblemDetail.forStatusAndDetail(HttpStatus.CONTENT_TOO_LARGE, "File is too large");
        }
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, "Expected a multipart file upload");
    }

    // new ResponseStatusException(404, "...") in a controller: answer with {"detail": "..."}
    // like FastAPI's HTTPException, because the frontend reads that field
    @ExceptionHandler(ResponseStatusException.class)
    ProblemDetail responseStatus(ResponseStatusException ex) {
        return ex.getBody();
    }
}