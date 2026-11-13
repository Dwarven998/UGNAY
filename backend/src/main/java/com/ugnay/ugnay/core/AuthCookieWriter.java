package com.ugnay.ugnay.core;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** Writes and clears the HttpOnly session cookie that carries the JWT. */
@Component
public class AuthCookieWriter {

    public static final String COOKIE_NAME = "ugnay_token";

    @Value("${jwt.expiration:86400000}")
    private long jwtExpiration;

    @Value("${app.frontend.url:}")
    private String frontendUrl;

    public void set(HttpServletResponse response, HttpServletRequest request, String token) {
        write(response, request, token, jwtExpiration / 1000);
    }

    public void clear(HttpServletResponse response, HttpServletRequest request) {
        write(response, request, "", 0);
    }

    private void write(HttpServletResponse response, HttpServletRequest request, String value, long maxAgeSeconds) {
        boolean isHttps = request.isSecure()
            || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"))
            || (frontendUrl != null && frontendUrl.startsWith("https"));

        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(COOKIE_NAME, value)
            .httpOnly(true)
            .path("/")
            .maxAge(maxAgeSeconds);

        if (isHttps) {
            builder.secure(true).sameSite("None");
        } else {
            builder.secure(false).sameSite("Lax");
        }

        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }
}
