package com.ugnay.ugnay.core.error;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import com.ugnay.ugnay.post.FacebookConnectionRequiredException;
import com.ugnay.ugnay.post.PostConflictDto;
import com.ugnay.ugnay.post.SchedulingConflictException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

/**
 * Drives every handler of {@link GlobalExceptionHandler} through a real DispatcherServlet (MockMvc) with the
 * {@link CorrelationIdFilter} in front, and checks status, the standard body, and that nothing internal leaks.
 */
@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerTest {

    private static final String TOKEN = "EAAsecretPageToken1234567890";
    private static final String LEAKY_URL = "https://graph.facebook.com/v20.0/me?access_token=" + TOKEN;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .addFilters(new CorrelationIdFilter())
            .build();
    }

    // ───────── standard body & correlation id ─────────

    @Test
    void errorBodyHasTheStandardShapeAndMatchingTraceId() throws Exception {
        MvcResult result = mvc.perform(get("/t/not-found"))
            .andExpect(status().isNotFound())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.status").value("error"))
            .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("Post not found"))
            .andExpect(jsonPath("$.error").value("Not Found"))
            .andExpect(jsonPath("$.details").isArray())
            .andExpect(jsonPath("$.timestamp").isNotEmpty())
            .andExpect(jsonPath("$.path").value("/t/not-found"))
            .andReturn();

        String header = result.getResponse().getHeader(CorrelationIdFilter.HEADER);
        assertTrue(header != null && !header.isBlank());
        assertTrue(result.getResponse().getContentAsString().contains("\"traceId\":\"" + header + "\""));
    }

    @Test
    void wellFormedIncomingRequestIdIsReused() throws Exception {
        mvc.perform(get("/t/not-found").header(CorrelationIdFilter.HEADER, "client-req-12345"))
            .andExpect(header().string(CorrelationIdFilter.HEADER, "client-req-12345"))
            .andExpect(jsonPath("$.traceId").value("client-req-12345"));
    }

    @Test
    void malformedIncomingRequestIdIsReplaced() throws Exception {
        for (String bad : new String[] {"short", "has space inside", "inject\r\nFAKE LOG LINE", "<script>x</script>",
            "a".repeat(65)}) {
            String returned = mvc.perform(get("/t/not-found").header(CorrelationIdFilter.HEADER, bad))
                .andReturn().getResponse().getHeader(CorrelationIdFilter.HEADER);
            assertNotEquals(bad, returned);
            assertTrue(CorrelationIdFilter.isValid(returned), returned);
        }
    }

    @Test
    void queryStringIsNotReportedInPath() throws Exception {
        mvc.perform(get("/t/not-found").queryParam("access_token", TOKEN))
            .andExpect(jsonPath("$.path").value("/t/not-found"))
            .andExpect(content().string(not(containsString(TOKEN))));
    }

    // ───────── operational application errors ─────────

    @Test
    void responseStatusExceptionKeepsItsStatusAndUserFacingReason() throws Exception {
        mvc.perform(get("/t/rse-403"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"))
            .andExpect(jsonPath("$.message").value("Requires officer or admin role"));
    }

    @Test
    void responseStatusException500HidesItsReason() throws Exception {
        mvc.perform(get("/t/rse-500"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
            .andExpect(content().string(not(containsString("internal detail"))));
    }

    @Test
    void businessRuleIs423WithItsMessage() throws Exception {
        mvc.perform(get("/t/business"))
            .andExpect(status().isLocked())
            .andExpect(jsonPath("$.code").value("OPERATION_NOT_ALLOWED"))
            .andExpect(jsonPath("$.message").value("Only pending posts can be approved or rejected"));
    }

    @Test
    void schedulingConflictKeepsThePostConflictFieldsAtTopLevel() throws Exception {
        mvc.perform(get("/t/conflict"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.postId").value("11111111-1111-1111-1111-111111111111"))
            .andExpect(jsonPath("$.caption").value("Existing post"))
            .andExpect(jsonPath("$.scheduledAt").value("2026-12-01T10:00:00Z"))
            .andExpect(jsonPath("$.status").value("SCHEDULED"))
            .andExpect(jsonPath("$.code").value("SCHEDULE_CONFLICT"))
            .andExpect(jsonPath("$.message").isNotEmpty())
            .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void facebookConnectionRequiredStays428WithMessage() throws Exception {
        mvc.perform(get("/t/fb-required"))
            .andExpect(status().is(428))
            .andExpect(jsonPath("$.code").value("FACEBOOK_CONNECTION_REQUIRED"))
            .andExpect(jsonPath("$.message").value("Connect this organization's Facebook Page to enable post scheduling."));
    }

    @Test
    void rateLimitCarriesRetryAfter() throws Exception {
        mvc.perform(get("/t/rate"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "30"))
            .andExpect(jsonPath("$.code").value("RATE_LIMIT_EXCEEDED"));
    }

    @Test
    void aiQuotaIs429WithItsCode() throws Exception {
        mvc.perform(get("/t/ai-quota"))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("AI_QUOTA_EXCEEDED"));
    }

    // ───────── unexpected errors are NOT operational ─────────

    @Test
    void programmingErrorsBecomeGeneric500NotClientErrors(CapturedOutput output) throws Exception {
        for (String path : new String[] {"/t/npe", "/t/ise", "/t/nse", "/t/iae"}) {
            mvc.perform(get(path))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value(ErrorCode.INTERNAL_SERVER_ERROR.defaultMessage()))
                .andExpect(content().string(not(containsString("internal state detail"))))
                .andExpect(content().string(not(containsString("Exception"))));
        }
        assertTrue(output.getOut().contains("ERROR"), "defects are logged at ERROR");
        assertTrue(output.getOut().contains("java.lang.IllegalStateException"), "with the exception class");
    }

    @Test
    void credentialsInExceptionMessagesNeverReachLogsOrBody(CapturedOutput output) throws Exception {
        MvcResult result = mvc.perform(get("/t/npe-with-leaky-cause"))
            .andExpect(status().isInternalServerError())
            .andReturn();
        assertFalse(result.getResponse().getContentAsString().contains(TOKEN));
        assertFalse(output.getAll().contains(TOKEN), "token leaked into the log");
        assertTrue(output.getAll().contains("at com.ugnay.ugnay.core.error.GlobalExceptionHandlerTest"),
            "stack frames are kept for diagnosis");
    }

    // ───────── request validation & binding ─────────

    @Test
    void bodyValidationUsesTheConstraintsOwnMessageAndListsFields() throws Exception {
        mvc.perform(post("/t/validate").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.message").value("Enter a name."))
            .andExpect(jsonPath("$.details[*].field", hasItem("name")))
            .andExpect(jsonPath("$.details[*].field", hasItem("email")));
    }

    @Test
    void bodyValidationWithOnlyLibraryMessagesGetsGenericMessage() throws Exception {
        mvc.perform(post("/t/validate").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"A\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(ErrorCode.VALIDATION_ERROR.defaultMessage()))
            .andExpect(jsonPath("$.details[0].field").value("email"));
    }

    @Test
    void malformedJsonIs400WithoutParserDetails() throws Exception {
        mvc.perform(post("/t/validate").contentType(MediaType.APPLICATION_JSON).content("{\"name\": "))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"))
            .andExpect(content().string(not(containsString("JsonEOFException"))));
    }

    @Test
    void missingAndMistypedParametersAre400() throws Exception {
        mvc.perform(get("/t/param"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MISSING_PARAMETER"))
            .andExpect(jsonPath("$.message").value("Missing required parameter 'id'."));
        mvc.perform(get("/t/param").queryParam("id", "not-a-uuid"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.message").value("Invalid value for 'id'."));
    }

    @Test
    void unknownRouteAndWrongMethod() throws Exception {
        mvc.perform(get("/t/does-not-exist"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(HttpMethod.DELETE, "/t/param"))
            .andExpect(status().isMethodNotAllowed())
            .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    // ───────── database ─────────

    @Test
    void duplicateIs409WithoutSqlOrValues() throws Exception {
        mvc.perform(get("/t/duplicate"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RESOURCE_CONFLICT"))
            .andExpect(content().string(not(containsString("someone@example.com"))))
            .andExpect(content().string(not(containsString("users_email_key"))));
    }

    @Test
    void concurrentUpdateIs409() throws Exception {
        mvc.perform(get("/t/optimistic"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RESOURCE_CONFLICT"));
    }

    @Test
    void unreachableDatabaseIs503() throws Exception {
        mvc.perform(get("/t/db-down"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("DATABASE_UNAVAILABLE"))
            .andExpect(content().string(not(containsString("pooler.supabase.com"))));
    }

    @Test
    void otherDatabaseErrorsAre500WithoutSql() throws Exception {
        mvc.perform(get("/t/bad-sql"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("DATABASE_ERROR"))
            .andExpect(content().string(not(containsString("select"))));
    }

    // ───────── third parties ─────────

    @Test
    void untranslatedUpstreamErrorIs502AndNeverEchoesItsUrl(CapturedOutput output) throws Exception {
        mvc.perform(get("/t/upstream"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("EXTERNAL_SERVICE_ERROR"))
            .andExpect(content().string(not(containsString(TOKEN))));
        assertFalse(output.getAll().contains(TOKEN), "token leaked into the log");
    }

    @Test
    void externalServiceUnavailableIs503WithItsMessage() throws Exception {
        mvc.perform(get("/t/ai-busy"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("EXTERNAL_SERVICE_UNAVAILABLE"))
            .andExpect(jsonPath("$.message").value("The AI assistant is busy right now."));
    }

    @Test
    void codesAndStatusesAgree() {
        for (ErrorCode code : ErrorCode.values()) {
            assertFalse(code.defaultMessage().isBlank(), code.name());
        }
        assertEquals(ErrorCode.OPERATION_NOT_ALLOWED, ErrorCode.forStatus(423));
        assertEquals(ErrorCode.INTERNAL_SERVER_ERROR, ErrorCode.forStatus(599));
        assertEquals(ErrorCode.BAD_REQUEST, ErrorCode.forStatus(418));
    }

    // ───────── probe controller ─────────

    record ValidatedBody(@NotBlank(message = "Enter a name.") String name, @NotBlank String email) {
    }

    @RestController
    static class ProbeController {

        @GetMapping("/t/not-found")
        void notFound() {
            throw new ResourceNotFoundException("Post not found");
        }

        @GetMapping("/t/rse-403")
        void rse403() {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires officer or admin role");
        }

        @GetMapping("/t/rse-500")
        void rse500() {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "internal detail xyz");
        }

        @GetMapping("/t/business")
        void business() {
            throw new BusinessRuleException("Only pending posts can be approved or rejected");
        }

        @GetMapping("/t/conflict")
        void conflict() {
            throw new SchedulingConflictException(new PostConflictDto(
                UUID.fromString("11111111-1111-1111-1111-111111111111"), "Existing post", "2026-12-01T10:00:00Z",
                "SCHEDULED", null));
        }

        @GetMapping("/t/fb-required")
        void facebookRequired() {
            throw new FacebookConnectionRequiredException("Connect this organization's Facebook Page to enable post scheduling.");
        }

        @GetMapping("/t/rate")
        void rate() {
            throw new RateLimitExceededException("Slow down.", Duration.ofSeconds(30));
        }

        @GetMapping("/t/ai-quota")
        void aiQuota() {
            throw new ExternalServiceException(ExternalServiceException.Service.GEMINI, ErrorCode.AI_QUOTA_EXCEEDED, null);
        }

        @GetMapping("/t/ai-busy")
        void aiBusy() {
            throw new ExternalServiceException(ExternalServiceException.Service.GEMINI,
                ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE, "The AI assistant is busy right now.");
        }

        @GetMapping("/t/npe")
        void npe() {
            throw new NullPointerException("internal state detail");
        }

        @GetMapping("/t/ise")
        void ise() {
            throw new IllegalStateException("internal state detail");
        }

        @GetMapping("/t/nse")
        void nse() {
            throw new NoSuchElementException("internal state detail");
        }

        @GetMapping("/t/iae")
        void iae() {
            throw new IllegalArgumentException("internal state detail");
        }

        @GetMapping("/t/npe-with-leaky-cause")
        void leaky() {
            throw new IllegalStateException("wrapped " + LEAKY_URL, new RuntimeException("GET " + LEAKY_URL));
        }

        @PostMapping("/t/validate")
        void validate(@Valid @RequestBody ValidatedBody body) {
        }

        @GetMapping("/t/param")
        void param(@RequestParam UUID id) {
        }

        @GetMapping("/t/duplicate")
        void duplicate() {
            throw new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"users_email_key\" Detail: Key (email)=(someone@example.com)");
        }

        @GetMapping("/t/optimistic")
        void optimistic() {
            throw new OptimisticLockingFailureException("Row was updated or deleted by another transaction");
        }

        @GetMapping("/t/db-down")
        void dbDown() {
            throw new CannotGetJdbcConnectionException("Failed to obtain JDBC Connection to aws-0.pooler.supabase.com");
        }

        @GetMapping("/t/bad-sql")
        void badSql() {
            throw new InvalidDataAccessResourceUsageException("could not execute: select * from users where x");
        }

        @GetMapping("/t/upstream")
        void upstream() {
            throw WebClientResponseException.create(400, "Bad Request", HttpHeaders.EMPTY,
                "{\"error\":{\"message\":\"bad\"}}".getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8,
                new org.springframework.mock.http.client.MockClientHttpRequest(HttpMethod.GET, LEAKY_URL));
        }
    }
}
