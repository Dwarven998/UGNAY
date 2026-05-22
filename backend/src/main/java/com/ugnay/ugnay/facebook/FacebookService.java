package com.ugnay.ugnay.facebook;


import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FacebookService {

    @Value("${facebook.api.url}")
    private String fbApiUrl;

    private final WebClient webClient = WebClient.builder().build();

    /**
     * Publish a text-only or photo post to a Facebook Page.
     * Returns the fb_post_id on success.
     */
    public String publishPost(String accessToken, String pageId, String message, String imageUrl) {
        String endpoint;
        Map<String, String> body;

        if (imageUrl != null && !imageUrl.isBlank()) {
            // Photo post
            endpoint = fbApiUrl + "/" + pageId + "/photos";
            body = Map.of("message", message, "url", imageUrl, "access_token", accessToken);
        } else {
            // Text-only post
            endpoint = fbApiUrl + "/" + pageId + "/feed";
            body = Map.of("message", message, "access_token", accessToken);
        }

        Map<String, Object> response = webClient.post()
            .uri(endpoint)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        return response != null ? (String) response.get("id") : null;
    }

    /**
     * Fetch engagement metrics for a published post.
     */
    public Map<String, Object> getPostInsights(String accessToken, String fbPostId) {
        return webClient.get()
            .uri(fbApiUrl + "/" + fbPostId
                + "?fields=likes.summary(true),comments.summary(true),shares&access_token=" + accessToken)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();
    }
}