package com.ugnay.ugnay.core.error;

import java.util.List;

import org.springframework.web.server.ResponseStatusException;

/**
 * Base of UGNAY's operational errors: expected failures with a known HTTP status, a stable {@link ErrorCode}
 * and a message that is safe to show to the user ({@link #getReason()}).
 *
 * It extends {@link ResponseStatusException} on purpose: code that already catches or asserts
 * {@code ResponseStatusException} (and reads {@code getStatusCode()} / {@code getReason()}) keeps working
 * unchanged when a throw site moves to a typed subclass.
 *
 * Never put internal details (SQL, URLs, tokens, exception messages from libraries) in the message; pass the
 * original exception as the cause instead, which is logged, not returned.
 */
public class ApiException extends ResponseStatusException {

    private final ErrorCode code;
    private final transient List<ApiErrorResponse.FieldErrorDetail> details;

    public ApiException(ErrorCode code) {
        this(code, null, null, List.of());
    }

    public ApiException(ErrorCode code, String message) {
        this(code, message, null, List.of());
    }

    public ApiException(ErrorCode code, String message, Throwable cause) {
        this(code, message, cause, List.of());
    }

    protected ApiException(ErrorCode code, String message, Throwable cause,
                           List<ApiErrorResponse.FieldErrorDetail> details) {
        super(code.status(), message == null || message.isBlank() ? code.defaultMessage() : message, cause);
        this.code = code;
        this.details = details == null ? List.of() : List.copyOf(details);
    }

    public ErrorCode getCode() {
        return code;
    }

    public List<ApiErrorResponse.FieldErrorDetail> getDetails() {
        return details;
    }
}
