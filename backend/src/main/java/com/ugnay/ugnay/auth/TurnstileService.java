package com.ugnay.ugnay.auth;

import com.ugnay.ugnay.core.PooledHttpConnector;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;

/**
 * Server-side Cloudflare Turnstile token verification.
 *
 * <p>Calls the official Siteverify endpoint:
 * {@code https://challenges.cloudflare.com/turnstile/v0/siteverify}
 *
 * <p>The secret is NEVER exposed to the frontend. It is read exclusively from the
 * {@code TURNSTILE_SECRET} environment variable via {@code application.properties}.
 *
 * <p>Tokens are single-use and time-limited; no caching is performed here.
 */
@Service
@Slf4j
public class TurnstileService {

    private static final String SITEVERIFY_URL =
            "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final WebClient webClient;

    @Value("${turnstile.secret}")
    private String turnstileSecret;

    public TurnstileService() {
        this.webClient = WebClient.builder()
                .clientConnector(PooledHttpConnector.create("turnstile", REQUEST_TIMEOUT))
                .baseUrl(SITEVERIFY_URL)
                .build();
    }

    /**
     * Verifies a Turnstile challenge token with Cloudflare's Siteverify API.
     *
     * @param token  the {@code cf-turnstile-response} token submitted by the client
     * @param remoteIp optional client IP to include in the verification request (may be null)
     * @return {@code true} if Cloudflare reports {@code "success": true}, {@code false} otherwise
     */
    public boolean verify(String token, String remoteIp) {
        if (token == null || token.isBlank()) {
            log.warn("Turnstile verification skipped: token is null or blank");
            return false;
        }

        try {
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("secret", turnstileSecret);
            formData.add("response", token);
            if (remoteIp != null && !remoteIp.isBlank()) {
                formData.add("remoteip", remoteIp);
            }

            SiteverifyResponse response = webClient
                    .post()
                    .uri("")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(formData))
                    .retrieve()
                    .bodyToMono(SiteverifyResponse.class)
                    .timeout(REQUEST_TIMEOUT)
                    .block();

            if (response == null) {
                log.warn("Turnstile: Siteverify returned a null response");
                return false;
            }

            if (!response.success()) {
                // Log only the error codes — never the secret or the token
                List<String> codes = response.errorCodes() != null ? response.errorCodes() : List.of();
                log.warn("Turnstile verification failed. error-codes={}", codes);
            }

            return response.success();

        } catch (Exception ex) {
            // Network errors, timeouts, etc. — fail closed (deny the request)
            log.error("Turnstile: Siteverify request failed: {}", ex.getMessage());
            return false;
        }
    }

    /**
     * Siteverify JSON response shape.
     *
     * @see <a href="https://developers.cloudflare.com/turnstile/get-started/server-side-validation/">Cloudflare docs</a>
     */
    private record SiteverifyResponse(
            boolean success,
            String hostname,
            String action,
            String cdata,
            @com.fasterxml.jackson.annotation.JsonProperty("error-codes") List<String> errorCodes
    ) {}
}
