package com.ugnay.ugnay.core.error;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class LogSanitizerTest {

    private static final String SECRET = "s3cr3tValue987";

    @Test
    void redactsFacebookTokenExchangeUrl() {
        String url = "400 Bad Request from GET https://graph.facebook.com/v20.0/oauth/access_token?client_id=1234"
            + "&client_secret=" + SECRET + "&redirect_uri=https%3A%2F%2Fapi.example.com%2Fcb&code=AQDauthCode55";

        String result = LogSanitizer.redact(url);

        assertFalse(result.contains(SECRET), result);
        assertFalse(result.contains("AQDauthCode55"), result);
        assertTrue(result.contains("client_id=1234"), "non-secret parameters stay readable: " + result);
        assertTrue(result.contains("client_secret=" + LogSanitizer.REDACTED), result);
    }

    @Test
    void redactsLongLivedExchangeAndAccessTokens() {
        String url = "https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token"
            + "&fb_exchange_token=shortLived123&access_token=pageToken456&input_token=x9";

        String result = LogSanitizer.redact(url);

        assertFalse(result.contains("shortLived123"), result);
        assertFalse(result.contains("pageToken456"), result);
        assertFalse(result.contains("=x9"), result);
        assertTrue(result.contains("grant_type=fb_exchange_token"), "a parameter value that is only a name stays: " + result);
    }

    @Test
    void redactsPercentEncodedAndDoubleEncodedParameters() {
        assertFalse(LogSanitizer.redact("next=%2Fcb%3Fclient%5Fsecret%3D" + SECRET).contains(SECRET));
        assertFalse(LogSanitizer.redact("a=1%26access_token%3D" + SECRET + "%26b%3D2").contains(SECRET));
        assertFalse(LogSanitizer.redact("x?access_token%253D" + SECRET).contains(SECRET));
        assertFalse(LogSanitizer.redact("x?ACCESS_TOKEN=" + SECRET).contains(SECRET), "names are case-insensitive");
    }

    @Test
    void encodedValueStopsAtEncodedSeparator() {
        String result = LogSanitizer.redact("q=a%26access_token%3D" + SECRET + "%26fields%3Did");
        assertFalse(result.contains(SECRET), result);
        assertTrue(result.contains("%26fields%3Did"), "the next encoded parameter survives: " + result);
    }

    @Test
    void redactsSecretsInJsonAndHeaders() {
        String json = "{\"access_token\":\"" + SECRET + "\",\"token_type\":\"bearer\"}";
        assertFalse(LogSanitizer.redact(json).contains(SECRET));

        assertFalse(LogSanitizer.redact("Authorization: Bearer abcdefgh12345678").contains("abcdefgh12345678"));
        assertFalse(LogSanitizer.redact("x-goog-api-key: " + SECRET).contains(SECRET));
        assertFalse(LogSanitizer.redact("password=" + SECRET).contains(SECRET));
    }

    @Test
    void keepsGraphErrorCodesReadable() {
        String body = "{\"error\":{\"message\":\"Error validating access token\",\"type\":\"OAuthException\",\"code\":190,"
            + "\"error_subcode\":463}}";
        assertEquals(body, LogSanitizer.redact(body));
        assertEquals("error_code=190&error_subcode=463", LogSanitizer.redact("error_code=190&error_subcode=463"));
    }

    @Test
    void redactsBareJwtsGoogleKeysAndFacebookTokens() {
        String jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIn0.c2lnbmF0dXJlLXZhbHVl";
        String googleKey = "AIzaSyA1234567890abcdefghijklmnopqrstu";
        String facebookToken = "EAAGm0PX4ZCpsBAKZCZA1234567890abcdef";

        String result = LogSanitizer.redact("state " + jwt + " key " + googleKey + " token " + facebookToken);

        assertFalse(result.contains(jwt), result);
        assertFalse(result.contains(googleKey), result);
        assertFalse(result.contains(facebookToken), result);
    }

    @Test
    void flattensLineBreaksSoValuesCannotForgeLogLines() {
        String result = LogSanitizer.redact("first\r\nERROR forged entry\nthird");
        assertFalse(result.contains("\n"));
        assertFalse(result.contains("\r"));
    }

    @Test
    void handlesNullAndEmpty() {
        assertNull(LogSanitizer.redact(null));
        assertEquals("", LogSanitizer.redact(""));
        assertEquals("null", LogSanitizer.describe(null));
        assertEquals("IllegalStateException", LogSanitizer.describe(new IllegalStateException()));
    }

    @Test
    void describeRedactsTheMessage() {
        String description = LogSanitizer.describe(new RuntimeException("GET https://x?access_token=" + SECRET));
        assertTrue(description.startsWith("RuntimeException: "), description);
        assertFalse(description.contains(SECRET), description);
    }

    @Test
    void scrubRedactsEveryCauseAndKeepsClassNamesAndStackFrames() {
        IllegalStateException root = new IllegalStateException("token=" + SECRET);
        RuntimeException outer = new RuntimeException("GET https://x?client_secret=" + SECRET, root);

        RuntimeException scrubbed = LogSanitizer.scrub(outer);

        assertNotNull(scrubbed);
        assertFalse(scrubbed.getMessage().contains(SECRET), scrubbed.getMessage());
        assertTrue(scrubbed.getMessage().startsWith("java.lang.RuntimeException: "), scrubbed.getMessage());
        assertNotNull(scrubbed.getCause());
        assertFalse(scrubbed.getCause().getMessage().contains(SECRET));
        assertTrue(scrubbed.getCause().getMessage().startsWith("java.lang.IllegalStateException: "));
        assertEquals(outer.getStackTrace().length, scrubbed.getStackTrace().length);
    }

    @Test
    void scrubSurvivesCyclicCauses() {
        RuntimeException a = new RuntimeException("a");
        RuntimeException b = new RuntimeException("b", a);
        a.initCause(b);

        RuntimeException scrubbed = LogSanitizer.scrub(a);

        assertNotNull(scrubbed);
        assertNull(scrubbed.getCause().getCause(), "the cycle is cut instead of recursing forever");
        assertNull(LogSanitizer.scrub(null));
    }
}
