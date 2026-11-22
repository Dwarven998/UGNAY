package com.ugnay.ugnay.core.error;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

/**
 * Replaces Spring Boot's default {@code /error} endpoint so that failures outside Spring MVC — an exception thrown
 * by a servlet filter (e.g. the database being unreachable while {@code JwtFilter} loads the user) or a
 * container-level error — also answer in the {@link ApiErrorResponse} format, never with a stack trace or the
 * default "Whitelabel" body.
 */
@Slf4j
@RestController
public class ApiErrorController implements ErrorController {

    @RequestMapping("${server.error.path:${error.path:/error}}")
    public ResponseEntity<ApiErrorResponse> error(HttpServletRequest request) {
        Throwable error = request.getAttribute(RequestDispatcher.ERROR_EXCEPTION) instanceof Throwable t ? t : null;
        Object statusAttribute = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int status = statusAttribute instanceof Integer s ? s : 500;

        ErrorCode code;
        String message = null;
        Throwable cause = error == null ? null : unwrap(error);
        if (cause instanceof ApiException api) {
            code = api.getCode();
            status = api.getStatusCode().value();
            message = api.getReason();
        } else if (cause instanceof DataAccessResourceFailureException || cause instanceof CannotCreateTransactionException) {
            code = ErrorCode.DATABASE_UNAVAILABLE;
            status = code.status().value();
        } else {
            code = ErrorCode.forStatus(status);
        }

        String path = ApiErrorResponse.pathOf(request);
        if (status >= 500 && error != null) {
            log.error("HTTP {} {} {}: unhandled {} outside the MVC handlers", status, code, path,
                error.getClass().getName(), LogSanitizer.scrub(error));
        } else {
            log.debug("HTTP {} {} {} (error dispatch)", status, code, path);
        }
        return ResponseEntity.status(status).body(ApiErrorResponse.of(status, code, message, null, request));
    }

    private static Throwable unwrap(Throwable error) {
        Throwable current = error;
        // ServletException / NestedServletException wrappers carry the real exception as their cause.
        while (current instanceof jakarta.servlet.ServletException && current.getCause() != null) {
            current = current.getCause();
        }
        if (current instanceof ApiException) {
            return current;
        }
        Throwable root = NestedExceptionUtils.getMostSpecificCause(current);
        return current instanceof DataAccessResourceFailureException || current instanceof CannotCreateTransactionException
            ? current : root instanceof java.sql.SQLTransientConnectionException
                ? new DataAccessResourceFailureException("database unavailable") : current;
    }
}
