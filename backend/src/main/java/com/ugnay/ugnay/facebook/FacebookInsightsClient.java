package com.ugnay.ugnay.facebook;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Thin read-only Graph API client for the Analytics panel. Every call is made with the caller's own
 * Page access token, so it can only ever read the Page that token belongs to. Requests are capped at
 * a few seconds so a slow Graph response can never stall the panel.
 */
@Component
@Slf4j
public class FacebookInsightsClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(4);

    private final WebClient webClient = WebClient.builder()
        .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024))
        .build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String baseUrl;

    public FacebookInsightsClient(
        @Value("${facebook.insights.api.url:https://graph.facebook.com/v23.0}") String baseUrl
    ) {
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    /**
     * The first HTTPS call after boot pays for DNS, TLS and connection-pool setup (about 3 s). Doing one
     * throwaway request at startup means the first person to open Analytics does not wait for it.
     */
    @EventListener(ApplicationReadyEvent.class)
    void warmUp() {
        Thread thread = new Thread(() -> {
            try {
                webClient.get().uri(URI.create(baseUrl + "/me?access_token=warm-up"))
                    .retrieve().toBodilessEntity().block(Duration.ofSeconds(10));
            } catch (Exception ignored) {
                // Facebook rejects the fake token; the connection is warm either way.
            }
        }, "graph-warm-up");
        thread.setDaemon(true);
        thread.start();
    }

    /** GET {base}/{path}?{params}&access_token=... */
    public JsonNode get(String path, String accessToken, Map<String, String> params) {
        Map<String, String> all = new LinkedHashMap<>(params);
        all.put("access_token", accessToken);
        StringBuilder query = new StringBuilder();
        all.forEach((key, value) -> {
            if (!query.isEmpty()) query.append('&');
            query.append(URLEncoder.encode(key, StandardCharsets.UTF_8))
                .append('=')
                .append(URLEncoder.encode(value, StandardCharsets.UTF_8));
        });
        String cleanPath = path.startsWith("/") ? path : "/" + path;
        return fetch(URI.create(baseUrl + cleanPath + "?" + query));
    }

    /**
     * Graph batch request: up to 50 GETs answered in a single round trip. Returns one entry per requested
     * relative URL, in order; an entry is null when that individual request failed.
     */
    public List<JsonNode> batchGet(String accessToken, List<String> relativeUrls) {
        List<JsonNode> results = new ArrayList<>();
        for (int from = 0; from < relativeUrls.size(); from += 50) {
            List<String> chunk = relativeUrls.subList(from, Math.min(from + 50, relativeUrls.size()));
            try {
                var batch = objectMapper.createArrayNode();
                chunk.forEach(url -> batch.addObject().put("method", "GET").put("relative_url", url));
                String form = "access_token=" + URLEncoder.encode(accessToken, StandardCharsets.UTF_8)
                    + "&batch=" + URLEncoder.encode(batch.toString(), StandardCharsets.UTF_8);
                String body = webClient.post().uri(URI.create(baseUrl))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue(form)
                    .retrieve().bodyToMono(String.class).block(TIMEOUT);
                JsonNode responses = objectMapper.readTree(body == null ? "[]" : body);
                for (int i = 0; i < chunk.size(); i++) {
                    JsonNode entry = responses.path(i);
                    results.add(entry.path("code").asInt(0) == 200 ? objectMapper.readTree(entry.path("body").asText("{}")) : null);
                }
            } catch (Exception ex) {
                log.warn("Graph batch request failed: {}", ex.getMessage());
                for (int i = 0; i < chunk.size(); i++) results.add(null);
            }
        }
        return results;
    }

    /** Follows a Graph "paging.next" URL, which already carries the token and every parameter. */
    public JsonNode getNext(String nextUrl) {
        return fetch(URI.create(nextUrl));
    }

    private JsonNode fetch(URI uri) {
        try {
            String body = webClient.get().uri(uri).retrieve().bodyToMono(String.class).block(TIMEOUT);
            return body == null || body.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(body);
        } catch (WebClientResponseException ex) {
            throw new GraphException(ex.getStatusCode().value(), graphMessage(ex.getResponseBodyAsString()), ex);
        } catch (GraphException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new GraphException(502, "Facebook did not respond in time", ex);
        }
    }

    private String graphMessage(String responseBody) {
        try {
            JsonNode message = objectMapper.readTree(responseBody).path("error").path("message");
            if (!message.isMissingNode()) return message.asText();
        } catch (Exception ignored) {
            // fall through to the generic message
        }
        return "Facebook rejected the request";
    }

    public static class GraphException extends RuntimeException {
        private final int status;

        public GraphException(int status, String message, Throwable cause) {
            super(message, cause);
            this.status = status;
        }

        public int getStatus() {
            return status;
        }
    }
}
