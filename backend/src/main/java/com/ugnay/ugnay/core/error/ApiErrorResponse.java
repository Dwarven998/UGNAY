package com.ugnay.ugnay.core.error;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;

/**
 * The body of every error response:
 * <pre>
 * {"status":"error","code":"RESOURCE_NOT_FOUND","message":"Post not found","error":"Not Found",
 *  "details":[],"timestamp":"2026-11-22T10:30:00Z","path":"/api/posts/…","traceId":"…"}
 * </pre>
 * {@code message} is always safe to show to the user. {@code error} (the HTTP reason phrase) is kept because the
 * frontend falls back to it. {@code path} never includes the query string, which may carry tokens.
 */
public record ApiErrorResponse(
    String status,
    String code,
    String message,
    String error,
    List<FieldErrorDetail> details,
    String timestamp,
    String path,
    String traceId
) {

    /** One invalid input: the field (or parameter) name and what is wrong with it. */
    public record FieldErrorDetail(String field, String message) {
    }

    public static ApiErrorResponse of(ErrorCode code, String message, List<FieldErrorDetail> details,
                                      HttpServletRequest request) {
        return of(code.status().value(), code, message, details, request);
    }

    public static ApiErrorResponse of(int status, ErrorCode code, String message, List<FieldErrorDetail> details,
                                      HttpServletRequest request) {
        HttpStatus resolved = HttpStatus.resolve(status);
        return new ApiErrorResponse(
            "error",
            code.name(),
            message == null || message.isBlank() ? code.defaultMessage() : message,
            resolved != null ? resolved.getReasonPhrase() : "Error",
            details == null ? List.of() : List.copyOf(details),
            Instant.now().toString(),
            pathOf(request),
            CorrelationIdFilter.currentTraceId(request)
        );
    }

    /** The original request path, also during an error dispatch to /error. */
    static String pathOf(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        Object original = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        return original instanceof String uri ? uri : request.getRequestURI();
    }
}
