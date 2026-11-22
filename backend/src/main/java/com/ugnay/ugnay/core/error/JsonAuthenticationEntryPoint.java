package com.ugnay.ugnay.core.error;

import java.io.IOException;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.ugnay.ugnay.core.JwtFilter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * 401 for a protected endpoint reached without a valid session. Without this, Spring Security answers an
 * anonymous request with 403, and the frontend could not tell "signed out" from "not allowed".
 *
 * {@code SESSION_EXPIRED} when a session token was sent but refused (expired, tampered, or issued before a
 * password change — see {@link JwtFilter}); {@code UNAUTHORIZED} when no token was sent at all.
 */
@Slf4j
@Component
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ErrorResponseWriter writer;

    public JsonAuthenticationEntryPoint(ErrorResponseWriter writer) {
        this.writer = writer;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        ErrorCode code = Boolean.TRUE.equals(request.getAttribute(JwtFilter.TOKEN_REJECTED_ATTRIBUTE))
            ? ErrorCode.SESSION_EXPIRED
            : ErrorCode.UNAUTHORIZED;
        log.debug("HTTP 401 {} {} {}", code, request.getMethod(), request.getRequestURI());
        writer.write(request, response, code, code.defaultMessage());
    }
}
