package com.ugnay.ugnay.core.error;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ugnay.ugnay.auth.LoginRateLimiterService;
import com.ugnay.ugnay.core.HealthController;
import com.ugnay.ugnay.core.JwtUtil;
import com.ugnay.ugnay.core.SecurityConfig;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;

import io.jsonwebtoken.Claims;
import jakarta.servlet.http.Cookie;

/**
 * The real security filter chain (CorrelationIdFilter → rate limit → JwtFilter → authorization) with the
 * database and JWT parsing mocked: failures raised inside filters, outside Spring MVC, must still produce the
 * standard JSON error with the correlation id.
 */
@WebMvcTest(controllers = HealthController.class)
@Import({SecurityConfig.class, LoginRateLimiterService.class, ErrorResponseWriter.class,
    JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class, SecurityErrorHandlingTest.ProbeController.class})
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:5173")
class SecurityErrorHandlingTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private UserRepository userRepository;

    @Test
    void protectedEndpointWithoutSessionIs401JsonWithTraceId() throws Exception {
        MvcResult result = mvc.perform(get("/api/probe"))
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.status").value("error"))
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.path").value("/api/probe"))
            .andReturn();
        String traceId = result.getResponse().getHeader(CorrelationIdFilter.HEADER);
        assertTrue(CorrelationIdFilter.isValid(traceId));
        assertTrue(result.getResponse().getContentAsString().contains(traceId));
    }

    @Test
    void refusedSessionTokenIs401SessionExpired() throws Exception {
        when(jwtUtil.parseValid(anyString())).thenReturn(Optional.empty());

        mvc.perform(get("/api/probe").cookie(new Cookie("ugnay_token", "expired.jwt.value")))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
            .andExpect(jsonPath("$.message").value(ErrorCode.SESSION_EXPIRED.defaultMessage()));
    }

    @Test
    void tokenIssuedBeforePasswordChangeIs401SessionExpired() throws Exception {
        User user = User.builder().id(UUID.randomUUID()).email("member@example.com")
            .passwordChangedAt(java.time.Instant.now()).build();
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("member@example.com");
        when(claims.getIssuedAt()).thenReturn(new Date(System.currentTimeMillis() - 3_600_000));
        when(jwtUtil.parseValid(anyString())).thenReturn(Optional.of(claims));
        when(userRepository.findByEmail("member@example.com")).thenReturn(Optional.of(user));

        mvc.perform(get("/api/probe").header(HttpHeaders.AUTHORIZATION, "Bearer old.session.token"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
    }

    @Test
    void validSessionPassesAndSignedInDenialIs403() throws Exception {
        signedIn();

        mvc.perform(get("/api/probe").cookie(new Cookie("ugnay_token", "valid.jwt.value")))
            .andExpect(status().isOk());
        mvc.perform(get("/api/probe/denied").cookie(new Cookie("ugnay_token", "valid.jwt.value")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void publicHealthCheckStaysOpen() throws Exception {
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void loginRateLimitIs429WithRetryAfterAndStandardBody() throws Exception {
        String ip = "203.0.113." + (int) (Math.random() * 200);
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").header("X-Forwarded-For", ip));
        }
        mvc.perform(post("/api/auth/login").header("X-Forwarded-For", ip))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "60"))
            .andExpect(header().exists(CorrelationIdFilter.HEADER))
            .andExpect(jsonPath("$.code").value("RATE_LIMIT_EXCEEDED"))
            .andExpect(jsonPath("$.message").value(
                "Too many login attempts from this IP. Please wait 1 minute before trying again."));
    }

    @Test
    void correlationAndRetryAfterHeadersAreExposedToTheBrowser() throws Exception {
        mvc.perform(get("/api/health").header(HttpHeaders.ORIGIN, "http://localhost:5173"))
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                org.hamcrest.Matchers.containsString(CorrelationIdFilter.HEADER)))
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                org.hamcrest.Matchers.containsString("Retry-After")));
    }

    @Test
    void accessDeniedHandlerWrites403Json() throws Exception {
        JsonAccessDeniedHandler handler = new JsonAccessDeniedHandler(new ErrorResponseWriter(new ObjectMapper()));
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/app/organizations/x");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(request, response, new AccessDeniedException("denied"));

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":\"FORBIDDEN\""));
        assertTrue(response.getContentAsString().contains("\"path\":\"/api/app/organizations/x\""));
    }

    private void signedIn() {
        User user = User.builder().id(UUID.randomUUID()).email("member@example.com").build();
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("member@example.com");
        when(claims.getIssuedAt()).thenReturn(new Date());
        when(jwtUtil.parseValid(anyString())).thenReturn(Optional.of(claims));
        when(userRepository.findByEmail("member@example.com")).thenReturn(Optional.of(user));
    }

    @RestController
    static class ProbeController {

        @GetMapping("/api/probe")
        String probe() {
            return "ok";
        }

        @GetMapping("/api/probe/denied")
        String denied() {
            throw new AccessDeniedException("not allowed");
        }
    }
}
