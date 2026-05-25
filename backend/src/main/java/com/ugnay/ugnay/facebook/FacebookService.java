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
     * Publish a post to a Facebook Page feed.
     * Returns the fb_post_id on success.
     */
    public String publishPost(String accessToken, String pageId, String message, String imageUrl) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("message", message);
        body.put("access_token", accessToken);
        if (imageUrl != null && !imageUrl.isBlank()) {
            body.put("link", imageUrl);
        }

        Map<String, Object> response = webClient.post()
            .uri(fbApiUrl + "/" + pageId + "/feed")
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