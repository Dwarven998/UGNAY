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

    /**
     * Set when the request carried a session token that was refused (expired, invalid signature, or issued
     * before a password change), so a 401 can say "session expired" rather than "please sign in".
     */
    public static final String TOKEN_REJECTED_ATTRIBUTE = JwtFilter.class.getName() + ".tokenRejected";

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

        var claims = token == null || token.isBlank()
            ? java.util.Optional.<io.jsonwebtoken.Claims>empty()
            : jwtUtil.parseValid(token);
        boolean authenticated = false;
        if (claims.isPresent()) {
            String email = claims.get().getSubject();
            java.util.Date issuedAt = claims.get().getIssuedAt();
            var user = userRepository.findByEmail(email)
                .filter(candidate -> issuedAfterPasswordChange(candidate, issuedAt));
            if (user.isPresent()) {
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(user.get(), null, List.of());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
                SecurityContextHolder.getContext().setAuthentication(auth);
                authenticated = true;
            }
        }
        if (!authenticated && token != null && !token.isBlank()) {
            req.setAttribute(TOKEN_REJECTED_ATTRIBUTE, Boolean.TRUE);
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