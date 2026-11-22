package com.ugnay.ugnay.core.error;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Gives every request a correlation id, before any other filter (Spring Security included) runs:
 * <ul>
 *   <li>reuses a well-formed incoming {@code X-Request-Id}, otherwise generates a UUID;</li>
 *   <li>puts it in the logging MDC as {@code traceId}, so every log line of the request carries it;</li>
 *   <li>returns it in the {@code X-Request-Id} response header and in every error body as {@code traceId}.</li>
 * </ul>
 * An incoming id is accepted only if it is 8–64 characters of {@code [A-Za-z0-9._-]}; anything else (line breaks,
 * spaces, markup, oversized values) is replaced, so a client can never inject text into the logs through it.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "traceId";
    static final String ATTRIBUTE = CorrelationIdFilter.class.getName() + ".traceId";

    private static final Pattern VALID_ID = Pattern.compile("^[A-Za-z0-9._-]{8,64}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // An error dispatch (forward to /error) is the same request: keep the id it already has.
        Object existing = request.getAttribute(ATTRIBUTE);
        String traceId = existing instanceof String id ? id : resolve(request.getHeader(HEADER));
        request.setAttribute(ATTRIBUTE, traceId);
        response.setHeader(HEADER, traceId);
        String previous = MDC.get(MDC_KEY);
        MDC.put(MDC_KEY, traceId);
        try {
            chain.doFilter(request, response);
        } finally {
            if (previous != null) {
                MDC.put(MDC_KEY, previous);
            } else {
                MDC.remove(MDC_KEY);
            }
        }
    }

    /** The error dispatch must get the same id (it would otherwise run without one in the MDC). */
    @Override
    protected boolean shouldNotFilterErrorDispatch() {
        return false;
    }

    static String resolve(String incoming) {
        return isValid(incoming) ? incoming : UUID.randomUUID().toString();
    }

    static boolean isValid(String candidate) {
        return candidate != null && VALID_ID.matcher(candidate).matches();
    }

    /** The current request's correlation id, falling back to the logging context (e.g. outside a request). */
    public static String currentTraceId(HttpServletRequest request) {
        if (request != null && request.getAttribute(ATTRIBUTE) instanceof String id) {
            return id;
        }
        return MDC.get(MDC_KEY);
    }
}
