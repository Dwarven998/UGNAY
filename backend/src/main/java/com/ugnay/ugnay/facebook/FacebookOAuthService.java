package com.ugnay.ugnay.facebook;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import com.ugnay.ugnay.core.JwtUtil;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.util.retry.Retry;

@Service
@Slf4j
@RequiredArgsConstructor
public class FacebookOAuthService {

    private static final Duration GRAPH_REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final int GRAPH_REQUEST_RETRIES = 3;
    private static final Duration GRAPH_REQUEST_BACKOFF = Duration.ofSeconds(2);

    @Value("${facebook.api.url}")
    private String facebookApiUrl;

    @Value("${facebook.oauth.authorize-url}")
    private String facebookAuthorizeUrl;

    @Value("${facebook.oauth.token-url}")
    private String facebookTokenUrl;

    @Value("${facebook.oauth.redirect-uri}")
    private String facebookRedirectUri;

    @Value("${facebook.app.id}")
    private String facebookAppId;

    @Value("${facebook.app.secret}")
    private String facebookAppSecret;

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final WebClient webClient = WebClient.builder().build();

    public String buildAuthorizationUrl(User user) {
        String state = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
        return UriComponentsBuilder.fromHttpUrl(facebookAuthorizeUrl)
                .queryParam("client_id", facebookAppId)
                .queryParam("redirect_uri", facebookRedirectUri)
                .queryParam("state", state)
                .queryParam("response_type", "code")
                .queryParam("scope", "pages_show_list,pages_manage_posts,pages_read_engagement")
                .build(true)
                .toUriString();
    }

    @Transactional
    public FacebookConnectionDetails completeAuthorization(String code, String state) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Missing Facebook authorization code");
        }
        if (state == null || state.isBlank() || !jwtUtil.isValid(state)) {
            throw new IllegalArgumentException("Invalid Facebook OAuth state");
        }

        UUID userId = UUID.fromString(jwtUtil.extractUserId(state));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        FacebookPageAccount pageAccount;
        try {
            log.info("Completing Facebook OAuth for user={}, codePresent={}, statePresent={}", user.getId(), code != null,
                    state != null);

            String shortLivedToken = exchangeCodeForUserToken(code);
            log.debug("Obtained short-lived token for user={}", user.getId());

            String longLivedToken = exchangeForLongLivedToken(shortLivedToken);
            log.debug("Exchanged for long-lived token for user={}", user.getId());

            pageAccount = fetchPrimaryPage(longLivedToken);
            log.info("Fetched primary Facebook Page for user={} pageId={}", user.getId(), pageAccount.pageId());

            user.setFbPageId(pageAccount.pageId());
            user.setFbAccessToken(pageAccount.pageAccessToken());
            userRepository.save(user);
        } catch (Exception ex) {
            log.error("Facebook OAuth completion failed for user={}, state={}: {}", user.getId(), state,
                    ex.getMessage(), ex);
            throw ex;
        }

        return new FacebookConnectionDetails(
                true,
                pageAccount.pageId(),
                pageAccount.pageName(),
                pageAccount.pagePictureUrl()
        );
    }

    @Transactional(readOnly = true)
    public FacebookConnectionDetails buildConnectionDetails(User user) {
        if (user.getFbPageId() == null || user.getFbPageId().isBlank()
                || user.getFbAccessToken() == null || user.getFbAccessToken().isBlank()) {
            return new FacebookConnectionDetails(false, null, null, null);
        }

        try {
            FacebookPageDetails page = fetchPageDetails(user.getFbPageId(), user.getFbAccessToken());
            return new FacebookConnectionDetails(true, page.pageId(), page.pageName(), page.pagePictureUrl());
        } catch (RuntimeException ex) {
            return new FacebookConnectionDetails(true, user.getFbPageId(), null, null);
        }
    }

    @Transactional
    public void disconnect(User user) {
        user.setFbPageId(null);
        user.setFbAccessToken(null);
        userRepository.save(user);
    }

    private String exchangeCodeForUserToken(String code) {
        String uri = UriComponentsBuilder.fromHttpUrl(facebookTokenUrl)
                .queryParam("client_id", facebookAppId)
                .queryParam("client_secret", facebookAppSecret)
                .queryParam("redirect_uri", facebookRedirectUri)
                .queryParam("code", code)
                .build()
                .encode()
                .toUriString();

        Map<String, Object> response = executeGraphGet(uri);

        return readToken(response);
    }

    private String exchangeForLongLivedToken(String shortLivedToken) {
        String uri = UriComponentsBuilder.fromHttpUrl(facebookTokenUrl)
                .queryParam("grant_type", "fb_exchange_token")
                .queryParam("client_id", facebookAppId)
                .queryParam("client_secret", facebookAppSecret)
                .queryParam("fb_exchange_token", shortLivedToken)
                .build()
                .encode()
                .toUriString();

        Map<String, Object> response = executeGraphGet(uri);

        return readToken(response);
    }

    private FacebookPageAccount fetchPrimaryPage(String userAccessToken) {
        String uri = UriComponentsBuilder.fromHttpUrl(facebookApiUrl)
                .path("/me/accounts")
                .queryParam("fields", "id,name,access_token")
                .queryParam("access_token", userAccessToken)
                .build()
                .encode()
                .toUriString();

        Map<String, Object> response = executeGraphGet(uri);

        List<Map<String, Object>> data = readList(response, "data");
        if (data.isEmpty()) {
            throw new IllegalStateException("No Facebook Page connected to the account");
        }
        return toPageAccount(data.get(0));
    }

    private FacebookPageDetails fetchPageDetails(String pageId, String accessToken) {
        String uri = UriComponentsBuilder.fromHttpUrl(facebookApiUrl)
                .pathSegment(pageId)
                .queryParam("fields", "id,name,picture{url}")
                .queryParam("access_token", accessToken)
                .build(false) // false = don't re-encode, prevents %7B%7D double-encoding of { }
                .toUriString();

        Map<String, Object> response = executeGraphGet(uri);

        if (response == null) {
            throw new IllegalStateException("Failed to load Facebook Page details");
        }
        return new FacebookPageDetails(
                stringValue(response.get("id")),
                stringValue(response.get("name")),
                nestedPictureUrl(response.get("picture"))
        );
    }

    private FacebookPageAccount toPageAccount(Map<String, Object> pageData) {
        return new FacebookPageAccount(
                stringValue(pageData.get("id")),
                stringValue(pageData.get("name")),
                stringValue(pageData.get("access_token")),
                null
        );
    }

    private String readToken(Map<String, Object> response) {
        if (response == null || response.get("access_token") == null) {
            throw new IllegalStateException("Facebook token exchange failed");
        }
        return String.valueOf(response.get("access_token"));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readList(Map<String, Object> response, String key) {
        if (response == null || response.get(key) == null) {
            throw new IllegalStateException("Facebook response missing " + key);
        }
        return (List<Map<String, Object>>) response.get(key);
    }

    private String nestedPictureUrl(Object pictureValue) {
        if (!(pictureValue instanceof Map<?, ?> pictureMap)) {
            return null;
        }
        Object data = pictureMap.get("data");
        if (!(data instanceof Map<?, ?> dataMap)) {
            return null;
        }
        Object url = dataMap.get("url");
        return url != null ? String.valueOf(url) : null;
    }

    private String stringValue(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private Map<String, Object> executeGraphGet(String uri) {
        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .timeout(GRAPH_REQUEST_TIMEOUT)
                .retryWhen(
                        Retry.backoff(GRAPH_REQUEST_RETRIES, GRAPH_REQUEST_BACKOFF)
                                .filter(this::isRetryableGraphError)
                                .doBeforeRetry(signal -> log.warn(
                                "Retrying Facebook Graph request attempt {} for {}",
                                signal.totalRetries() + 1,
                                uri
                        ))
                )
                .doOnError(error -> {
                    if (error instanceof WebClientResponseException wre) {
                        try {
                            log.error("Facebook Graph response error for {}: status={}, body={}", uri, wre.getRawStatusCode(),
                                    wre.getResponseBodyAsString());
                        } catch (Exception e) {
                            log.error("Failed to log response body for {}: {}", uri, e.getMessage(), e);
                        }
                    } else {
                        log.error("Facebook Graph request failed for {}: {}", uri, error.getMessage(), error);
                    }
                })
                .onErrorMap(error -> error instanceof RuntimeException ? error : new IllegalStateException(error.getMessage(), error))
                .block();
    }

    private boolean isRetryableGraphError(Throwable error) {
        return error instanceof TimeoutException
                || error instanceof WebClientRequestException
                || (error instanceof WebClientResponseException webClientError && webClientError.getStatusCode().is5xxServerError());
    }

    public record FacebookConnectionDetails(
            boolean facebookConnected,
            String facebookPageId,
            String facebookPageName,
            String facebookPagePictureUrl
            ) {

    }

    private record FacebookPageAccount(
            String pageId,
            String pageName,
            String pageAccessToken,
            String pagePictureUrl
            ) {

    }

    private record FacebookPageDetails(
            String pageId,
            String pageName,
            String pagePictureUrl
            ) {

    }
}
