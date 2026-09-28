package com.ugnay.ugnay.core;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Sends the reason of a {@link ResponseStatusException} to the client in Spring's usual error shape. Those
 * reasons are written for the user ("Couldn't load the image…"), and without this they only reach the
 * browser while DevTools is on the classpath, which turns {@code server.error.include-message} on.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException exception,
                                                                    HttpServletRequest request) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", exception.getStatusCode().value());
        body.put("error", status != null ? status.getReasonPhrase() : "Error");
        body.put("message", exception.getReason() != null ? exception.getReason() : "");
        body.put("path", request.getRequestURI());
        return ResponseEntity.status(exception.getStatusCode()).headers(exception.getHeaders()).body(body);
    }
}
