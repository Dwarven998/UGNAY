package com.ugnay.ugnay.core;


import java.io.IOException;
import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {

        String token = null;
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring(7);
        } else if (req.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : req.getCookies()) {
                if ("ugnay_token".equals(cookie.getName())) {
                    token = cookie.getValue();
                    break;
                }
            }
        }

        var claims = token == null ? java.util.Optional.<io.jsonwebtoken.Claims>empty() : jwtUtil.parseValid(token);
        if (claims.isPresent()) {
            String email = claims.get().getSubject();
            java.util.Date issuedAt = claims.get().getIssuedAt();
            userRepository.findByEmail(email)
                .filter(user -> issuedAfterPasswordChange(user, issuedAt))
                .ifPresent(user -> {
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(user, null, List.of());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(req, res);
    }

    /**
     * A password change or reset signs the account out everywhere: tokens issued before it are refused.
     * JWT "iat" has whole-second precision, so the change time is truncated to seconds; the token that
     * the change itself re-issues for the current session lands in the same or a later second.
     */
    static boolean issuedAfterPasswordChange(User user, java.util.Date issuedAt) {
        java.time.Instant changedAt = user.getPasswordChangedAt();
        if (changedAt == null) return true;
        if (issuedAt == null) return false;
        return !issuedAt.toInstant().isBefore(changedAt.truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
    }
}