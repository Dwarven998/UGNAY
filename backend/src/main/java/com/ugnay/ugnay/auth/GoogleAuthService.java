package com.ugnay.ugnay.auth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Verifies Google OAuth access tokens obtained by the frontend's "Continue with Google" popup.
 * A token is only trusted when Google confirms it was issued to this app's client ID for a verified email,
 * so a token minted for some other site can't be replayed here.
 */
@Service
public class GoogleAuthService {

    private static final String TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo?access_token={token}";

    private final RestClient restClient = RestClient.create();
    private final String clientId;

    public GoogleAuthService(@Value("${google.oauth.client-id:}") String clientId) {
        this.clientId = clientId;
    }

    public GoogleIdentity verify(String accessToken) {
        if (clientId == null || clientId.isBlank()) {
            throw new GoogleAuthException("Google sign-in is not configured on the server.");
        }
        TokenInfo info;
        try {
            info = restClient.get().uri(TOKEN_INFO_URL, accessToken).retrieve().body(TokenInfo.class);
        } catch (RestClientException e) {
            throw new GoogleAuthException("Google sign-in failed. Please try again.");
        }
        if (info == null || !clientId.equals(info.aud())) {
            throw new GoogleAuthException("Google sign-in failed. Please try again.");
        }
        if (info.email() == null || !"true".equalsIgnoreCase(info.emailVerified())) {
            throw new GoogleAuthException("Your Google account email is not verified.");
        }
        return new GoogleIdentity(info.email(), info.sub());
    }

    public record GoogleIdentity(String email, String subject) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenInfo(String aud, String sub, String email, @JsonProperty("email_verified") String emailVerified) {}

    public static class GoogleAuthException extends RuntimeException {
        public GoogleAuthException(String message) {
            super(message);
        }
    }
}
