package com.ugnay.ugnay.core.error;

import org.springframework.http.HttpStatus;

/**
 * Stable, machine-readable error identifiers sent to clients as {@code code}. Each carries the HTTP status it is
 * returned with and a default message that is safe to show to any user. The frontend maps codes to messages, so
 * renaming a code is a breaking change; add new ones instead.
 */
public enum ErrorCode {

    // 400
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "The request could not be processed. Please check your input and try again."),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Please check your input and try again."),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "The request body is missing or malformed."),
    MISSING_PARAMETER(HttpStatus.BAD_REQUEST, "A required request parameter is missing."),
    SECURITY_VERIFICATION_FAILED(HttpStatus.BAD_REQUEST, "Security verification failed. Please try again."),
    // 401
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Please sign in to continue."),
    SESSION_EXPIRED(HttpStatus.UNAUTHORIZED, "Your session has expired. Please sign in again."),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid email or password."),
    AUTHENTICATION_FAILED(HttpStatus.UNAUTHORIZED, "Sign-in failed. Please try again."),
    // 403
    FORBIDDEN(HttpStatus.FORBIDDEN, "You do not have permission to perform this action."),
    // 404 / 405 / 406 / 409 / 413 / 415
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "The requested resource could not be found."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "This action is not supported."),
    NOT_ACCEPTABLE(HttpStatus.NOT_ACCEPTABLE, "The requested response format is not supported."),
    RESOURCE_CONFLICT(HttpStatus.CONFLICT, "This action conflicts with an existing record."),
    SCHEDULE_CONFLICT(HttpStatus.CONFLICT, "Another post is already scheduled within 30 minutes of this time."),
    PAYLOAD_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "The uploaded content is too large."),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "This content type is not supported."),
    // 423 / 428 / 429
    OPERATION_NOT_ALLOWED(HttpStatus.LOCKED, "This action is not allowed in the current state."),
    ACCOUNT_LOCKED(HttpStatus.LOCKED, "Too many failed attempts. Please try again later."),
    PRECONDITION_REQUIRED(HttpStatus.PRECONDITION_REQUIRED, "A required step has not been completed yet."),
    FACEBOOK_CONNECTION_REQUIRED(HttpStatus.PRECONDITION_REQUIRED, "Connect a Facebook Page first."),
    RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please wait before trying again."),
    AI_QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS,
        "The AI assistant has reached its usage limit for now. Please wait a moment and try again."),
    // 5xx
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again later."),
    DATABASE_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong while processing your data. Please try again later."),
    EXTERNAL_SERVICE_ERROR(HttpStatus.BAD_GATEWAY, "An external service returned an unexpected response. Please try again."),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "The service is temporarily unavailable. Please try again in a moment."),
    EXTERNAL_SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE,
        "An external service is temporarily unavailable. Please try again in a moment."),
    DATABASE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "The service is temporarily unavailable. Please try again in a moment."),
    EXTERNAL_SERVICE_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "An external service took too long to respond. Please try again.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }

    /** The generic code for a status that carries no more specific meaning (e.g. a {@code ResponseStatusException}). */
    public static ErrorCode forStatus(int status) {
        return switch (status) {
            case 400 -> BAD_REQUEST;
            case 401 -> UNAUTHORIZED;
            case 403 -> FORBIDDEN;
            case 404 -> RESOURCE_NOT_FOUND;
            case 405 -> METHOD_NOT_ALLOWED;
            case 406 -> NOT_ACCEPTABLE;
            case 409 -> RESOURCE_CONFLICT;
            case 413 -> PAYLOAD_TOO_LARGE;
            case 415 -> UNSUPPORTED_MEDIA_TYPE;
            case 423 -> OPERATION_NOT_ALLOWED;
            case 428 -> PRECONDITION_REQUIRED;
            case 429 -> RATE_LIMIT_EXCEEDED;
            case 502 -> EXTERNAL_SERVICE_ERROR;
            case 503 -> SERVICE_UNAVAILABLE;
            case 504 -> EXTERNAL_SERVICE_TIMEOUT;
            default -> status >= 500 ? INTERNAL_SERVER_ERROR : BAD_REQUEST;
        };
    }
}
