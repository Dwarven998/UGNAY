package com.ugnay.ugnay.core.error;

import java.io.IOException;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/** 403 in the standard error format for a signed-in user whom Spring Security denies access. */
@Slf4j
@Component
public class JsonAccessDeniedHandler implements AccessDeniedHandler {

    private final ErrorResponseWriter writer;

    public JsonAccessDeniedHandler(ErrorResponseWriter writer) {
        this.writer = writer;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        log.warn("HTTP 403 FORBIDDEN {} {}", request.getMethod(), request.getRequestURI());
        writer.write(request, response, ErrorCode.FORBIDDEN, ErrorCode.FORBIDDEN.defaultMessage());
    }
}
