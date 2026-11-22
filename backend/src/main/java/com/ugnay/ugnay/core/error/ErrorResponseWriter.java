package com.ugnay.ugnay.core.error;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Writes an {@link ApiErrorResponse} straight to the servlet response. Used where Spring MVC's exception handling
 * does not apply: servlet filters (rate limiting) and Spring Security's authentication / access-denied handlers.
 */
@Component
public class ErrorResponseWriter {

    private final ObjectMapper objectMapper;

    public ErrorResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletRequest request, HttpServletResponse response, ErrorCode code, String message)
            throws IOException {
        write(request, response, code, message, Map.of());
    }

    public void write(HttpServletRequest request, HttpServletResponse response, ErrorCode code, String message,
                      Map<String, String> headers) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.resetBuffer();
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        headers.forEach(response::setHeader);
        objectMapper.writeValue(response.getOutputStream(), ApiErrorResponse.of(code, message, null, request));
    }
}
