package com.ugnay.ugnay.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.ugnay.ugnay.core.error.ErrorCode;
import com.ugnay.ugnay.core.error.ErrorResponseWriter;

import java.io.IOException;
import java.util.Map;

@Slf4j
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    /** The IP bucket refills within a minute. */
    private static final String RETRY_AFTER_SECONDS = "60";

    private final LoginRateLimiterService rateLimiterService;
    private final ErrorResponseWriter errorResponseWriter;

    public LoginRateLimitFilter(LoginRateLimiterService rateLimiterService, ErrorResponseWriter errorResponseWriter) {
        this.rateLimiterService = rateLimiterService;
        this.errorResponseWriter = errorResponseWriter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Intercept POST requests to /api/auth/login
        if ("POST".equalsIgnoreCase(request.getMethod()) && "/api/auth/login".equals(request.getRequestURI())) {
            String clientIp = extractClientIp(request);

            if (!rateLimiterService.tryConsumeIp(clientIp)) {
                log.warn("HTTP 429 RATE_LIMIT_EXCEEDED POST /api/auth/login: IP login rate limit reached");
                errorResponseWriter.write(request, response, ErrorCode.RATE_LIMIT_EXCEEDED,
                    "Too many login attempts from this IP. Please wait 1 minute before trying again.",
                    Map.of(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SECONDS));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
