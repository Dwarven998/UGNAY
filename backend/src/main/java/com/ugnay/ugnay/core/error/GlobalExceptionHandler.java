package com.ugnay.ugnay.core.error;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.ugnay.ugnay.facebook.FacebookGraphException;
import com.ugnay.ugnay.facebook.FacebookInsightsClient;
import com.ugnay.ugnay.post.PostConflictDto;
import com.ugnay.ugnay.post.SchedulingConflictException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;

/**
 * The single place where exceptions thrown while handling a request become HTTP responses, all in the
 * {@link ApiErrorResponse} format. (Failures inside servlet filters — Spring Security, rate limiting — are
 * written by {@link JsonAuthenticationEntryPoint}, {@link JsonAccessDeniedHandler}, {@link ErrorResponseWriter}
 * and {@link ApiErrorController}.)
 *
 * Classification:
 * <ul>
 *   <li><b>Operational</b> — {@link ApiException} and its subclasses, {@link ResponseStatusException}, request
 *       binding/validation errors, Spring Security failures, known database conditions (duplicate, lock,
 *       unavailable) and third-party failures. Their status and safe message are returned; logged at DEBUG/WARN
 *       without a stack trace.</li>
 *   <li><b>Unexpected</b> — everything else, including {@code NullPointerException},
 *       {@code IllegalStateException}, {@code IllegalArgumentException} and {@code NoSuchElementException}: these
 *       signal programming defects and are <i>not</i> mapped to 4xx. The client gets a generic 500 with the trace
 *       id; the log gets an ERROR with the full (credential-scrubbed) stack trace.</li>
 * </ul>
 * Transactions are unaffected: these handlers run after the {@code @Transactional} method has already exited and
 * rolled back for any runtime exception.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // ───────────────────────── application exceptions ─────────────────────────

    /**
     * 409 for a scheduling conflict. The conflicting post's fields stay at the top level because the frontend
     * reads this body as a {@code PostConflict}; the standard fields are added next to them, except
     * {@code status}, which would clash with the post's own status.
     */
    @ExceptionHandler(SchedulingConflictException.class)
    public ResponseEntity<Map<String, Object>> handleSchedulingConflict(SchedulingConflictException ex,
                                                                        HttpServletRequest request) {
        logOperational(ex.getStatusCode().value(), ex.getCode(), request, ex.getReason());
        ApiErrorResponse standard = ApiErrorResponse.of(ex.getCode(), ex.getReason(), null, request);
        PostConflictDto conflict = ex.getConflict();
        Map<String, Object> body = new LinkedHashMap<>();
        if (conflict != null) {
            body.put("postId", conflict.postId());
            body.put("caption", conflict.caption());
            body.put("scheduledAt", conflict.scheduledAt());
            body.put("status", conflict.status());
            body.put("mediaUrl", conflict.mediaUrl());
        }
        body.put("code", standard.code());
        body.put("message", standard.message());
        body.put("error", standard.error());
        body.put("details", standard.details());
        body.put("timestamp", standard.timestamp());
        body.put("path", standard.path());
        body.put("traceId", standard.traceId());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        int status = ex.getStatusCode().value();
        if (ex instanceof ExternalServiceException) {
            logExternal(status, ex.getCode(), request, ex);
        } else if (status >= 500) {
            logUnexpected(status, ex.getCode(), request, ex);
        } else {
            logOperational(status, ex.getCode(), request, ex.getReason());
        }
        return respond(status, ex.getCode(), ex.getReason(), ex.getDetails(), ex.getHeaders(), request);
    }

    /**
     * Existing throw sites use {@code ResponseStatusException} with reasons written for the user; those reasons
     * are kept. A plain 500 gets the generic message instead, since its reason was never meant for users.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException ex,
                                                                 HttpServletRequest request) {
        int status = ex.getStatusCode().value();
        ErrorCode code = ErrorCode.forStatus(status);
        String message = status == 500 ? code.defaultMessage() : ex.getReason();
        if (status == 500) {
            logUnexpected(status, code, request, ex);
        } else if (status >= 500 || status == 429) {
            logExternal(status, code, request, ex);
        } else {
            logOperational(status, code, request, ex.getReason());
        }
        return respond(status, code, message, null, ex.getHeaders(), request);
    }

    // ───────────────────────── request binding & validation ─────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleBodyValidation(MethodArgumentNotValidException ex,
                                                                 HttpServletRequest request) {
        List<ApiErrorResponse.FieldErrorDetail> details = new ArrayList<>();
        String message = null;
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            details.add(new ApiErrorResponse.FieldErrorDetail(error.getField(), error.getDefaultMessage()));
            if (message == null && hasCustomMessage(error)) {
                message = error.getDefaultMessage();
            }
        }
        ex.getBindingResult().getGlobalErrors().forEach(error ->
            details.add(new ApiErrorResponse.FieldErrorDetail(error.getObjectName(), error.getDefaultMessage())));
        logOperational(400, ErrorCode.VALIDATION_ERROR, request, fieldsOf(details));
        return respond(400, ErrorCode.VALIDATION_ERROR, message, details, null, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException ex,
                                                                      HttpServletRequest request) {
        List<ApiErrorResponse.FieldErrorDetail> details = new ArrayList<>();
        String message = null;
        for (ConstraintViolation<?> violation : ex.getConstraintViolations()) {
            details.add(new ApiErrorResponse.FieldErrorDetail(lastNode(violation.getPropertyPath().toString()),
                violation.getMessage()));
            if (message == null && isCustomTemplate(violation.getMessageTemplate())) {
                message = violation.getMessage();
            }
        }
        logOperational(400, ErrorCode.VALIDATION_ERROR, request, fieldsOf(details));
        return respond(400, ErrorCode.VALIDATION_ERROR, message, details, null, request);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodValidation(HandlerMethodValidationException ex,
                                                                   HttpServletRequest request) {
        List<ApiErrorResponse.FieldErrorDetail> details = new ArrayList<>();
        ex.getParameterValidationResults().forEach(result -> result.getResolvableErrors().forEach(error ->
            details.add(new ApiErrorResponse.FieldErrorDetail(result.getMethodParameter().getParameterName(),
                error.getDefaultMessage()))));
        logOperational(400, ErrorCode.VALIDATION_ERROR, request, fieldsOf(details));
        return respond(400, ErrorCode.VALIDATION_ERROR, null, details, null, request);
    }

    /** Unreadable JSON. Names the offending field when Jackson knows it, never echoes the parser message. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadable(HttpMessageNotReadableException ex,
                                                             HttpServletRequest request) {
        String field = null;
        if (ex.getCause() instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()) {
            field = mapping.getPath().stream()
                .map(ref -> ref.getFieldName() != null ? ref.getFieldName() : "[" + ref.getIndex() + "]")
                .collect(Collectors.joining("."));
        }
        String message = field != null ? "The request contains an invalid value for '" + field + "'." : null;
        List<ApiErrorResponse.FieldErrorDetail> details = field != null
            ? List.of(new ApiErrorResponse.FieldErrorDetail(field, "Invalid value"))
            : List.of();
        logOperational(400, ErrorCode.MALFORMED_REQUEST, request, field);
        return respond(400, ErrorCode.MALFORMED_REQUEST, message, details, null, request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingParameter(MissingServletRequestParameterException ex,
                                                                   HttpServletRequest request) {
        String name = ex.getParameterName();
        logOperational(400, ErrorCode.MISSING_PARAMETER, request, name);
        return respond(400, ErrorCode.MISSING_PARAMETER, "Missing required parameter '" + name + "'.",
            List.of(new ApiErrorResponse.FieldErrorDetail(name, "Required")), null, request);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingPart(MissingServletRequestPartException ex,
                                                              HttpServletRequest request) {
        String name = ex.getRequestPartName();
        logOperational(400, ErrorCode.MISSING_PARAMETER, request, name);
        return respond(400, ErrorCode.MISSING_PARAMETER, "Missing required part '" + name + "'.",
            List.of(new ApiErrorResponse.FieldErrorDetail(name, "Required")), null, request);
    }

    /** Missing header, cookie or path variable. */
    @ExceptionHandler(ServletRequestBindingException.class)
    public ResponseEntity<ApiErrorResponse> handleBinding(ServletRequestBindingException ex,
                                                          HttpServletRequest request) {
        logOperational(400, ErrorCode.BAD_REQUEST, request, ex.getClass().getSimpleName());
        return respond(400, ErrorCode.BAD_REQUEST, null, null, null, request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                               HttpServletRequest request) {
        String name = ex.getName();
        logOperational(400, ErrorCode.VALIDATION_ERROR, request, name);
        return respond(400, ErrorCode.VALIDATION_ERROR, "Invalid value for '" + name + "'.",
            List.of(new ApiErrorResponse.FieldErrorDetail(name, "Invalid value")), null, request);
    }

    // ───────────────────────── routing & protocol ─────────────────────────

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ApiErrorResponse> handleNoResource(Exception ex, HttpServletRequest request) {
        logOperational(404, ErrorCode.RESOURCE_NOT_FOUND, request, null);
        return respond(404, ErrorCode.RESOURCE_NOT_FOUND, null, null, null, request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMethod(HttpRequestMethodNotSupportedException ex,
                                                         HttpServletRequest request) {
        logOperational(405, ErrorCode.METHOD_NOT_ALLOWED, request, ex.getMethod());
        return respond(405, ErrorCode.METHOD_NOT_ALLOWED, null, null, ex.getHeaders(), request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMediaType(HttpMediaTypeNotSupportedException ex,
                                                            HttpServletRequest request) {
        logOperational(415, ErrorCode.UNSUPPORTED_MEDIA_TYPE, request, null);
        return respond(415, ErrorCode.UNSUPPORTED_MEDIA_TYPE, null, null, ex.getHeaders(), request);
    }

    /** No body: the client accepts no format we could write it in. */
    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<Void> handleNotAcceptable(HttpMediaTypeNotAcceptableException ex, HttpServletRequest request) {
        logOperational(406, ErrorCode.NOT_ACCEPTABLE, request, null);
        return ResponseEntity.status(HttpStatus.NOT_ACCEPTABLE).build();
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleUploadSize(MaxUploadSizeExceededException ex,
                                                             HttpServletRequest request) {
        logOperational(413, ErrorCode.PAYLOAD_TOO_LARGE, request, null);
        return respond(413, ErrorCode.PAYLOAD_TOO_LARGE, null, null, null, request);
    }

    @ExceptionHandler(AsyncRequestTimeoutException.class)
    public ResponseEntity<ApiErrorResponse> handleAsyncTimeout(AsyncRequestTimeoutException ex,
                                                               HttpServletRequest request) {
        log.warn("HTTP 503 SERVICE_UNAVAILABLE {}: async request timed out", where(request));
        return respond(503, ErrorCode.SERVICE_UNAVAILABLE, null, null, null, request);
    }

    /** The client went away mid-response; there is nobody to answer. */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleClientGone(AsyncRequestNotUsableException ex, HttpServletRequest request) {
        log.debug("Client disconnected before the response was written: {}", where(request));
    }

    // ───────────────────────── security (thrown inside controllers/services) ─────────────────────────

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleAuthentication(AuthenticationException ex,
                                                                 HttpServletRequest request) {
        logOperational(401, ErrorCode.UNAUTHORIZED, request, null);
        return respond(401, ErrorCode.UNAUTHORIZED, null, null, null, request);
    }

    /** Signed-in user denied → 403; anonymous caller → 401, like the security filter chain. */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(
            org.springframework.security.access.AccessDeniedException ex, HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean anonymous = auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken;
        ErrorCode code = anonymous ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN;
        logOperational(code.status().value(), code, request, null);
        return respond(code.status().value(), code, null, null, null, request);
    }

    // ───────────────────────── database ─────────────────────────

    /** Unique/foreign-key/not-null violations. Only the constraint name is logged (the SQL message holds values). */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleIntegrity(DataIntegrityViolationException ex,
                                                            HttpServletRequest request) {
        log.warn("HTTP 409 RESOURCE_CONFLICT {}: data integrity violation (constraint={})", where(request),
            constraintName(ex));
        return respond(409, ErrorCode.RESOURCE_CONFLICT, null, null, null, request);
    }

    @ExceptionHandler(ConcurrencyFailureException.class)
    public ResponseEntity<ApiErrorResponse> handleConcurrency(ConcurrencyFailureException ex,
                                                              HttpServletRequest request) {
        log.warn("HTTP 409 RESOURCE_CONFLICT {}: concurrent update ({})", where(request), ex.getClass().getSimpleName());
        return respond(409, ErrorCode.RESOURCE_CONFLICT,
            "This record was changed by someone else at the same time. Please reload and try again.", null, null, request);
    }

    /** The database cannot be reached or did not answer in time. */
    @ExceptionHandler({DataAccessResourceFailureException.class, CannotCreateTransactionException.class,
        QueryTimeoutException.class, TransientDataAccessResourceException.class})
    public ResponseEntity<ApiErrorResponse> handleDatabaseUnavailable(Exception ex, HttpServletRequest request) {
        log.error("HTTP 503 DATABASE_UNAVAILABLE {}: {} (root cause: {})", where(request),
            ex.getClass().getSimpleName(), LogSanitizer.describe(NestedExceptionUtils.getMostSpecificCause(ex)));
        return respond(503, ErrorCode.DATABASE_UNAVAILABLE, null, null, null, request);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiErrorResponse> handleDataAccess(DataAccessException ex, HttpServletRequest request) {
        logUnexpected(500, ErrorCode.DATABASE_ERROR, request, ex);
        return respond(500, ErrorCode.DATABASE_ERROR, null, null, null, request);
    }

    // ───────────────────────── third-party failures that escaped their client ─────────────────────────

    @ExceptionHandler(FacebookGraphException.class)
    public ResponseEntity<ApiErrorResponse> handleFacebookGraph(FacebookGraphException ex, HttpServletRequest request) {
        ErrorCode code = ex.isTimeout() ? ErrorCode.EXTERNAL_SERVICE_TIMEOUT
            : ex.isUnavailable() ? ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE
            : ErrorCode.EXTERNAL_SERVICE_ERROR;
        logExternal(code.status().value(), code, request, ex);
        return respond(code.status().value(), code, facebookMessage(code), null, null, request);
    }

    @ExceptionHandler(FacebookInsightsClient.GraphException.class)
    public ResponseEntity<ApiErrorResponse> handleInsightsGraph(FacebookInsightsClient.GraphException ex,
                                                                HttpServletRequest request) {
        logExternal(502, ErrorCode.EXTERNAL_SERVICE_ERROR, request, ex);
        return respond(502, ErrorCode.EXTERNAL_SERVICE_ERROR, facebookMessage(ErrorCode.EXTERNAL_SERVICE_ERROR),
            null, null, request);
    }

    /** An HTTP answer from a third party that no client translated. Its message embeds the request URL: never returned. */
    @ExceptionHandler(WebClientResponseException.class)
    public ResponseEntity<ApiErrorResponse> handleUpstreamResponse(WebClientResponseException ex,
                                                                   HttpServletRequest request) {
        ErrorCode code = ex.getStatusCode().is5xxServerError()
            ? ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE : ErrorCode.EXTERNAL_SERVICE_ERROR;
        logExternal(code.status().value(), code, request, ex);
        return respond(code.status().value(), code, null, null, null, request);
    }

    @ExceptionHandler({WebClientRequestException.class, RestClientException.class})
    public ResponseEntity<ApiErrorResponse> handleUpstreamUnreachable(Exception ex, HttpServletRequest request) {
        logExternal(503, ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE, request, ex);
        return respond(503, ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE, null, null, null, request);
    }

    // ───────────────────────── everything else: a defect ─────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        logUnexpected(500, ErrorCode.INTERNAL_SERVER_ERROR, request, ex);
        return respond(500, ErrorCode.INTERNAL_SERVER_ERROR, null, null, null, request);
    }

    // ───────────────────────── helpers ─────────────────────────

    private static ResponseEntity<ApiErrorResponse> respond(int status, ErrorCode code, String message,
                                                            List<ApiErrorResponse.FieldErrorDetail> details,
                                                            HttpHeaders headers, HttpServletRequest request) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status);
        if (headers != null && !headers.isEmpty()) {
            builder.headers(headers);
        }
        return builder.body(ApiErrorResponse.of(status, code, message, details, request));
    }

    private static String facebookMessage(ErrorCode code) {
        return switch (code) {
            case EXTERNAL_SERVICE_TIMEOUT -> "Facebook took too long to respond. Please try again.";
            case EXTERNAL_SERVICE_UNAVAILABLE -> "Facebook could not be reached. Please try again in a moment.";
            default -> "Facebook could not complete the request. Please try again.";
        };
    }

    /** Expected client-side problems: DEBUG, except 403 and 429 which may indicate probing or abuse. */
    private static void logOperational(int status, ErrorCode code, HttpServletRequest request, String detail) {
        String safeDetail = detail == null ? "" : ": " + LogSanitizer.redact(detail);
        if (status == 403 || status == 429) {
            log.warn("HTTP {} {} {}{}", status, code, where(request), safeDetail);
        } else {
            log.debug("HTTP {} {} {}{}", status, code, where(request), safeDetail);
        }
    }

    /** A third party failed: recoverable, WARN without a stack trace, cause chain redacted. */
    private static void logExternal(int status, ErrorCode code, HttpServletRequest request, Throwable ex) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(ex);
        log.warn("HTTP {} {} {}: {}{}", status, code, where(request), LogSanitizer.describe(ex),
            root != ex ? " (root cause: " + LogSanitizer.describe(root) + ")" : "");
    }

    /** A defect or infrastructure failure: ERROR with the full stack trace, messages scrubbed of credentials. */
    private static void logUnexpected(int status, ErrorCode code, HttpServletRequest request, Throwable ex) {
        log.error("HTTP {} {} {}: unexpected {}", status, code, where(request), ex.getClass().getName(),
            LogSanitizer.scrub(ex));
    }

    /** Method and path only: the query string can carry tokens. */
    private static String where(HttpServletRequest request) {
        return request.getMethod() + " " + ApiErrorResponse.pathOf(request);
    }

    private static String fieldsOf(List<ApiErrorResponse.FieldErrorDetail> details) {
        return details.stream().map(ApiErrorResponse.FieldErrorDetail::field).distinct()
            .collect(Collectors.joining(", ", "invalid fields [", "]"));
    }

    /** True when the constraint declares its own message (written for users) rather than the library default. */
    private static boolean hasCustomMessage(FieldError error) {
        if (error.contains(ConstraintViolation.class)) {
            return isCustomTemplate(error.unwrap(ConstraintViolation.class).getMessageTemplate());
        }
        return false;
    }

    private static boolean isCustomTemplate(String template) {
        return template != null && !template.startsWith("{jakarta.validation.")
            && !template.startsWith("{org.hibernate.validator.");
    }

    private static String lastNode(String propertyPath) {
        int dot = propertyPath.lastIndexOf('.');
        return dot >= 0 ? propertyPath.substring(dot + 1) : propertyPath;
    }

    private static String constraintName(DataIntegrityViolationException ex) {
        Throwable current = ex;
        while (current != null) {
            if (current instanceof org.hibernate.exception.ConstraintViolationException hibernate) {
                return hibernate.getConstraintName();
            }
            current = current.getCause() == current ? null : current.getCause();
        }
        return "unknown";
    }
}
