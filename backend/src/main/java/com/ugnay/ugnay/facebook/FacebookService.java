package com.ugnay.ugnay.facebook;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FacebookService {

    @Value("${facebook.api.url}")
    private String fbApiUrl;

    @Value("${facebook.app.id}")
    private String facebookAppId;

    @Value("${facebook.app.secret}")
    private String facebookAppSecret;

    @Value("${facebook.redirect.uri}")
    private String facebookRedirectUri;

    private final WebClient webClient = WebClient.builder().build();

    public String publishPost(String accessToken, String pageId, String message, String imageUrl) {
        String endpoint;
        Map<String, String> body;

        if (imageUrl != null && !imageUrl.isBlank()) {
            endpoint = fbApiUrl + "/" + pageId + "/photos";
            body = Map.of("message", message, "url", imageUrl, "access_token", accessToken);
        } else {
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

    public Map<String, Object> getPostInsights(String accessToken, String fbPostId) {
        return webClient.get()
            .uri(fbApiUrl + "/" + fbPostId + "?fields=likes.summary(true),comments.summary(true),shares&access_token=" + accessToken)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();
    }

    public Map<String, String> exchangeCodeForToken(String code) {
        // 1. Get Short-Lived Token from Facebook
        String userTokenUrl = String.format(
            "https://graph.facebook.com/v20.0/oauth/access_token?client_id=%s&redirect_uri=%s&client_secret=%s&code=%s",
            facebookAppId, facebookRedirectUri, facebookAppSecret, code
        );

        try {
            RestTemplate restTemplate = new RestTemplate();
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(userTokenUrl, Map.class);
            
            if (response == null) throw new RuntimeException("No response from Facebook OAuth provider");
            
            String shortLivedToken = (String) response.get("access_token");
            String fbUserId = response.get("user_id") != null ? response.get("user_id").toString() : null;

            // 2. Exchange Short-Lived User Token for a 60-day Long-Lived Token
            String longLivedUrl = String.format(
                "https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s",
                facebookAppId, facebookAppSecret, shortLivedToken
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> longLivedResponse = restTemplate.getForObject(longLivedUrl, Map.class);
            String longLivedUserToken = longLivedResponse != null ? (String) longLivedResponse.get("access_token") : shortLivedToken;

            return Map.of(
                "access_token", longLivedUserToken,
                "user_id", fbUserId != null ? fbUserId : ""
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to complete token exchange sequence: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getUserPages(String longLivedUserToken) {
        // 💡 Asking for fields=name,id,access_token returns the PERMANENT Page Token
        String url = "https://graph.facebook.com/v20.0/me/accounts?fields=name,id,access_token&access_token=" + longLivedUserToken;

        try {
            RestTemplate restTemplate = new RestTemplate();
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) throw new RuntimeException("No page accounts found managed under this token");

            List<Map<String, Object>> pages = (List<Map<String, Object>>) response.get("data");
            if (pages != null && !pages.isEmpty()) {
                Map<String, Object> firstPage = pages.get(0);
                return Map.of(
                    "pageId", firstPage.get("id"),
                    "pageName", firstPage.get("name"),
                    "pageAccessToken", firstPage.get("access_token"), // 💡 Extracting page specific context tokens
                    "pageAvatar", getPageAvatar((String) firstPage.get("id"), longLivedUserToken)
                );
            }
            return Map.of();
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch matching application pages managed by account: " + e.getMessage(), e);
        }
    }

    private String getPageAvatar(String pageId, String accessToken) {
        return String.format("https://graph.facebook.com/v20.0/%s/picture?type=large&access_token=%s", pageId, accessToken);
    }
}