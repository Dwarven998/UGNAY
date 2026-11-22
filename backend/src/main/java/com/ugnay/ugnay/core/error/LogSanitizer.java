package com.ugnay.ugnay.core.error;

import java.util.IdentityHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Removes credentials from text before it is written to a log or attached to an exception.
 *
 * Outbound calls to Facebook Graph carry {@code client_secret}, {@code access_token} and
 * {@code fb_exchange_token} as URL query parameters, and Spring puts the full request URL into
 * {@code WebClientResponseException} messages. Anything that may contain such a URL (or an exception
 * message built from one) must pass through {@link #redact(String)} before it is logged.
 *
 * Covered forms:
 * <ul>
 *   <li>query/form parameters: {@code ?access_token=…}, {@code &client_secret=…}, including percent-encoded
 *       names and separators ({@code client%5Fsecret%3D…}, {@code %26code=…}, double-encoded {@code %253D});</li>
 *   <li>JSON or header style for unambiguous secret names: {@code "access_token":"…"}, {@code password: …};</li>
 *   <li>{@code Bearer …} values, JWTs, Google API keys ({@code AIza…}) and Facebook tokens ({@code EAA…})
 *       wherever they appear.</li>
 * </ul>
 * Carriage returns and line feeds are flattened so a value can never forge an extra log line.
 */
public final class LogSanitizer {

    public static final String REDACTED = "[REDACTED]";

    /** '_' in a parameter name may arrive percent-encoded. */
    private static final String U = "(?:_|%5[Ff])";

    /** Names that are secrets in any notation (query, form, JSON, header). */
    private static final String SECRET_NAMES = String.join("|",
        "access" + U + "token", "client" + U + "secret", "fb" + U + "exchange" + U + "token",
        "input" + U + "token", "refresh" + U + "token", "id" + U + "token", "appsecret" + U + "proof",
        "api" + U + "?key", "x-goog-api-key", "password", "secret", "turnstile" + U + "?token",
        "cf-turnstile-response");

    /** Generic names that are only secrets as URL/form parameters ("code": 190 in a Graph error body is not). */
    private static final String PARAM_ONLY_NAMES = "code|key|state|token|signature|sig";

    private static final String BOUNDARY = "(^|[?&;,{\\s\"'(]|%26|%3[Ff])";
    private static final String VALUE = "((?:(?!%26)[^&\\s\"',;}#<>)])+)";

    private static final Pattern PARAM = Pattern.compile(
        "(?i)" + BOUNDARY + "(" + SECRET_NAMES + "|" + PARAM_ONLY_NAMES + ")(=|%3[Dd]|%253[Dd])" + VALUE);

    private static final Pattern KEY_VALUE = Pattern.compile(
        "(?i)" + BOUNDARY + "(" + SECRET_NAMES + ")(\"?\\s*:\\s*\"?)" + VALUE);

    private static final Pattern BEARER = Pattern.compile("(?i)\\b(bearer|oauth)(\\s+|%20|\\+)[A-Za-z0-9._~+/=-]{8,}");
    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]*");
    private static final Pattern GOOGLE_API_KEY = Pattern.compile("AIza[0-9A-Za-z_-]{20,}");
    private static final Pattern FACEBOOK_TOKEN = Pattern.compile("\\bEAA[A-Za-z0-9]{20,}");
    private static final Pattern LINE_BREAKS = Pattern.compile("[\\r\\n]+");

    private static final int MAX_CAUSE_DEPTH = 10;

    private LogSanitizer() {
    }

    /** The text with every recognised credential replaced by {@value #REDACTED}; null stays null. */
    public static String redact(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        String result = LINE_BREAKS.matcher(text).replaceAll(" ");
        result = replaceValue(PARAM, result);
        result = replaceValue(KEY_VALUE, result);
        result = BEARER.matcher(result).replaceAll("$1 " + REDACTED);
        result = JWT.matcher(result).replaceAll(REDACTED);
        result = GOOGLE_API_KEY.matcher(result).replaceAll(REDACTED);
        result = FACEBOOK_TOKEN.matcher(result).replaceAll(REDACTED);
        return result;
    }

    /** "SimpleClassName: redacted message", for one-line log entries. */
    public static String describe(Throwable error) {
        if (error == null) {
            return "null";
        }
        String message = redact(error.getMessage());
        return error.getClass().getSimpleName() + (message == null || message.isBlank() ? "" : ": " + message);
    }

    /**
     * A copy of {@code error} and its causes whose messages are redacted, keeping the original class names
     * (in the message) and stack frames, so it can be attached as a cause or logged with a stack trace
     * without carrying a credential-bearing URL along.
     */
    public static RuntimeException scrub(Throwable error) {
        return scrub(error, new IdentityHashMap<>(), 0);
    }

    private static RuntimeException scrub(Throwable error, Map<Throwable, Boolean> seen, int depth) {
        if (error == null || depth >= MAX_CAUSE_DEPTH || seen.put(error, Boolean.TRUE) != null) {
            return null;
        }
        String message = redact(error.getMessage());
        RedactedException copy = new RedactedException(
            error.getClass().getName() + (message == null ? "" : ": " + message),
            scrub(error.getCause(), seen, depth + 1));
        copy.setStackTrace(error.getStackTrace());
        return copy;
    }

    private static String replaceValue(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String replacement = matcher.group(1) + matcher.group(2) + matcher.group(3) + REDACTED;
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    /** Stand-in for an exception whose message had to be redacted; the original class name leads the message. */
    public static final class RedactedException extends RuntimeException {
        RedactedException(String message, Throwable cause) {
            super(message, cause, false, true);
        }
    }
}
