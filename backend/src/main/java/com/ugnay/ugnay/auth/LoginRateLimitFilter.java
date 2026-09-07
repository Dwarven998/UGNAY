package com.ugnay.ugnay.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private final LoginRateLimiterService rateLimiterService;

    public LoginRateLimitFilter(LoginRateLimiterService rateLimiterService) {
        this.rateLimiterService = rateLimiterService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Intercept POST requests to /api/auth/login
        if ("POST".equalsIgnoreCase(request.getMethod()) && "/api/auth/login".equals(request.getRequestURI())) {
            String clientIp = extractClientIp(request);

            if (!rateLimiterService.tryConsumeIp(clientIp)) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("""
                    {
                      "error": "Too Many Requests",
                      "message": "Too many login attempts from this IP. Please wait 1 minute before trying again."
                    }
                    """);
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