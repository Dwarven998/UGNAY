package com.ugnay.ugnay.caption;


import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ugnay.ugnay.core.PooledHttpConnector;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Gemini calls for the AI assistant (captions, rewrites, hashtags, image ranking).
 *
 * Speed and reliability:
 * - Thinking is kept to the minimum the model allows: these are short creative tasks, and thinking both
 *   slows the answer and eats the output budget (a cut-off answer used to count as a failure and be retried).
 * - Lists are requested as structured JSON, and every text part of the answer is read.
 * - Several models are raced (Google's free tier is often overloaded for one model while another answers);
 *   the first good answer wins. Each call has a timeout, and only a dropped connection or overload is retried,
 *   once and quickly. Anything else fails at once with a readable message.
 * - Images are sent downscaled, and the connection to Gemini is opened at start-up.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GeminiClient {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

    public static final int MAX_CAPTION_IMAGES = 6; // reasoning over many images at once gets slow/unreliable

    private static final Duration IMAGE_CALL_TIMEOUT = Duration.ofSeconds(20);
    private static final Duration TEXT_CALL_TIMEOUT = Duration.ofSeconds(15);
    public static final int CAPTION_IMAGE_EDGE = 1536; // Increased resolution for readable text/dates on pubmats
    public static final int RANKING_IMAGE_EDGE = 768;  // Fast thumbnail resolution kept for candidate ranking

    private static final Map<String, Object> STRING_LIST_SCHEMA = Map.of(
        "type", "ARRAY",
        "items", Map.of("type", "STRING")
    );

    private static final Map<String, Object> IMAGE_ANALYSIS_SCHEMA = Map.of(
        "type", "OBJECT",
        "properties", Map.ofEntries(
            Map.entry("scene", Map.of("type", "STRING")),
            Map.entry("setting", Map.of("type", "STRING")),
            Map.entry("people", Map.of("type", "STRING")),
            Map.entry("activities", Map.of("type", "ARRAY", "items", Map.of("type", "STRING"))),
            Map.entry("visibleText", Map.of("type", "ARRAY", "items", Map.of("type", "STRING"))),
            Map.entry("eventName", Map.of("type", "STRING")),
            Map.entry("date", Map.of("type", "STRING")),
            Map.entry("venue", Map.of("type", "STRING")),
            Map.entry("mood", Map.of("type", "STRING")),
            Map.entry("postType", Map.of("type", "STRING")),
            Map.entry("relationToOrg", Map.of("type", "STRING"))
        )
    );

    private static final Map<String, Object> ALBUM_ANALYSIS_SCHEMA = Map.of(
        "type", "OBJECT",
        "properties", Map.of(
            "overallStory", Map.of("type", "STRING"),
            "sceneProgression", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
            "keyActivities", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
            "visibleText", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
            "eventName", Map.of("type", "STRING"),
            "date", Map.of("type", "STRING"),
            "venue", Map.of("type", "STRING"),
            "mood", Map.of("type", "STRING")
        )
    );

    private static class CacheEntry<T> {
        final T value;
        final long expiresAt;
        CacheEntry(T value, long ttlMillis) {
            this.value = value;
            this.expiresAt = System.currentTimeMillis() + ttlMillis;
        }
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }

    private final Map<String, CacheEntry<String>> analysisCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 30 * 60 * 1000L; // 30 minutes

    /**
     * Models raced for every request, the configured one ({@code gemini.api.url}) first. Google's free tier is
     * often overloaded ("503 high demand") for one model while another still answers, so the first two are asked
     * at once and the rest join if neither has answered after {@link #HEDGE_DELAY}; the first good answer wins
     * and the other requests are cancelled.
     */
    @Value("${gemini.api.fallback-models:gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview,gemini-flash-lite-latest}")
    private String fallbackModels;

    private static final int FIRST_WAVE = 2;
    private static final Duration HEDGE_DELAY = Duration.ofMillis(2500);

    /** Thinking settings tried in order until the model accepts one; remembered per model. */
    private static final List<Map<String, Object>> THINKING_VARIANTS = List.of(
        Map.of("thinkingLevel", "minimal"),
        Map.of("thinkingLevel", "low"),
        Map.of("thinkingBudget", 0),
        Map.of()
    );

    private static final class ModelSettings {
        final AtomicInteger thinkingVariant = new AtomicInteger(0);
        final AtomicBoolean structuredOutput = new AtomicBoolean(true);
    }

    private final Map<String, ModelSettings> modelSettings = new ConcurrentHashMap<>();

    private final ObjectMapper mapper = new ObjectMapper();

    private final WebClient webClient = WebClient.builder()
        // Google keeps idle connections open for minutes; reusing one saves the TLS set-up on every call.
        .clientConnector(PooledHttpConnector.create("gemini", Duration.ofSeconds(60), Duration.ofSeconds(90)))
        .codecs(configurer -> configurer
            .defaultCodecs()
            .maxInMemorySize(10 * 1024 * 1024)) // 10MB buffer for large images
        .build();

    // ───────────────────────── public API ─────────────────────────

    /**
     * Step 1: Look first (factual image analysis).
     * Extracts scene, setting, visible people, activities, and verbatim visible text/dates/venues via OCR.
     * Cached by image hash/URL for 30 minutes to make rewrites, hashtags, and tone switches instant.
     */
    public String describeImage(String imageUrl, OrgAiProfile profile) {
        String key = cacheKey(imageUrl);
        CacheEntry<String> cached = analysisCache.get(key);
        if (cached != null && !cached.isExpired()) {
            return cached.value;
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(imagePart(imageUrl)); // Image FIRST
        parts.add(Map.of("text", buildDescribePrompt(profile)));

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.2);
        config.put("maxOutputTokens", 1024);
        config.put("responseMimeType", "application/json");
        config.put("responseSchema", IMAGE_ANALYSIS_SCHEMA);
        config.put("thinkingConfig", Map.of("thinkingLevel", "low"));

        try {
            Map<String, Object> response = generate(parts, config, Duration.ofSeconds(25));
            String text = extractText(response);
            if (text != null && !text.isBlank()) {
                String cleaned = cleanJson(text);
                analysisCache.put(key, new CacheEntry<>(cleaned, CACHE_TTL_MS));
                return cleaned;
            }
        } catch (Exception e) {
            log.warn("Step 1 image describe failed, proceeding to direct write: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Step 1 for multi-image album: extracts the collective story progression and activities across the images.
     */
    public String describeAlbum(List<String> imageUrls, OrgAiProfile profile) {
        String key = "album:" + imageUrls.stream().map(this::cacheKey).reduce("", (a, b) -> a + "|" + b);
        CacheEntry<String> cached = analysisCache.get(key);
        if (cached != null && !cached.isExpired()) {
            return cached.value;
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        // Images attached FIRST
        List<ModelImage> downloaded = downloadAll(imageUrls, CAPTION_IMAGE_EDGE);
        for (int i = 0; i < imageUrls.size(); i++) {
            ModelImage img = downloaded.get(i);
            if (img != null) {
                parts.add(img.part());
            }
        }
        parts.add(Map.of("text", buildAlbumDescribePrompt(profile, imageUrls.size())));

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.2);
        config.put("maxOutputTokens", 1024);
        config.put("responseMimeType", "application/json");
        config.put("responseSchema", ALBUM_ANALYSIS_SCHEMA);
        config.put("thinkingConfig", Map.of("thinkingLevel", "low"));

        try {
            Map<String, Object> response = generate(parts, config, Duration.ofSeconds(30));
            String text = extractText(response);
            if (text != null && !text.isBlank()) {
                String cleaned = cleanJson(text);
                analysisCache.put(key, new CacheEntry<>(cleaned, CACHE_TTL_MS));
                return cleaned;
            }
        } catch (Exception e) {
            log.warn("Step 1 album describe failed: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Generates 3 caption options grounded primarily in the image (70-80%), framed by the organization
     * profile (20-30%), with high priority given to optional poster notes.
     */
    public List<String> generateCaptions(String imageUrl, String tone, OrgAiProfile profile, String notes) {
        // Step 1: Look first (factual image analysis)
        String analysisJson = describeImage(imageUrl, profile);

        // Step 2: Write captions
        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(imagePart(imageUrl)); // Image FIRST
        parts.add(Map.of("text", buildCaptionPrompt(tone, profile, notes, analysisJson)));

        return generateStringList(parts, 0.65, 1024, Duration.ofSeconds(20));
    }

    public List<String> generateCaptions(String imageUrl, String tone, String orgName) {
        return generateCaptions(imageUrl, tone, new OrgAiProfile(orgName, null, null, null, null, null, null, null), null);
    }

    /** Rewrites a caption in the specified tone, preserving all facts and avoiding name insertion. */
    public String rewriteWithTone(String caption, String tone, OrgAiProfile profile, String notes, String imageUrl) {
        String analysisJson = null;
        if (imageUrl != null && !imageUrl.isBlank()) {
            CacheEntry<String> cached = analysisCache.get(cacheKey(imageUrl));
            if (cached != null && !cached.isExpired()) {
                analysisJson = cached.value;
            }
        }

        String prompt = buildRewritePrompt(caption, tone, profile, notes, analysisJson);

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.65);
        config.put("maxOutputTokens", 512);
        for (int attempt = 1; attempt <= 2; attempt++) {
            String text = extractText(generate(List.of(Map.of("text", prompt)), config, TEXT_CALL_TIMEOUT));
            if (text != null && !text.isBlank()) return text.trim();
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
            "The AI assistant returned an empty answer. Please try again.");
    }

    public String rewriteWithTone(String caption, String tone, String orgName) {
        return rewriteWithTone(caption, tone, new OrgAiProfile(orgName, null, null, null, null, null, null, null), null, null);
    }

    /** Generates 7 relevant hashtags, prioritizing the organization's official hashtags first. */
    public List<String> generateHashtags(String caption, OrgAiProfile profile, String imageUrl) {
        String analysisJson = null;
        if (imageUrl != null && !imageUrl.isBlank()) {
            CacheEntry<String> cached = analysisCache.get(cacheKey(imageUrl));
            if (cached != null && !cached.isExpired()) {
                analysisJson = cached.value;
            }
        }

        String prompt = buildHashtagsPrompt(caption, profile, analysisJson);

        try {
            return generateStringList(List.of(Map.of("text", prompt)), 0.65, 512, TEXT_CALL_TIMEOUT);
        } catch (ResponseStatusException e) {
            if (e.getStatusCode().value() == 429) throw e;
            log.warn("Hashtag generation failed, using profile/caption fallback: {}", e.getReason());
        }

        return fallbackHashtags(caption, profile);
    }

    public List<String> generateHashtags(String caption, String orgName) {
        return generateHashtags(caption, new OrgAiProfile(orgName, null, null, null, null, null, null, null), null);
    }

    private List<String> fallbackHashtags(String caption, OrgAiProfile profile) {
        List<String> fallback = new ArrayList<>();
        if (profile != null) {
            List<String> official = profile.parsedOfficialHashtags();
            if (!official.isEmpty()) {
                fallback.addAll(official);
            } else if (profile.orgName() != null && !profile.orgName().isBlank()) {
                fallback.add("#" + profile.orgName().replaceAll("[^a-zA-Z0-9]", ""));
            }
        }

        if (caption != null) {
            for (String word : caption.split("\\s+")) {
                String cleaned = word.replaceAll("[^a-zA-Z0-9]", "");
                if (cleaned.length() >= 4 && fallback.size() < 7) {
                    String tag = "#" + cleaned.substring(0, 1).toUpperCase() + cleaned.substring(1).toLowerCase();
                    if (!fallback.contains(tag)) {
                        fallback.add(tag);
                    }
                }
            }
        }
        return fallback;
    }

    /**
     * Scores a folder's candidate images against a free-text description and returns
     * them ranked best-match-first. Used by the Media Repository's AI image picker.
     * Retains RANKING_IMAGE_EDGE (768px) for performance.
     */
    public List<ImageRanking> rankImages(List<AssetForRanking> assets, String description) {
        if (assets.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", buildRankingPrompt(description, assets.size())));
        List<ModelImage> downloaded = downloadAll(assets.stream().map(AssetForRanking::fileUrl).toList(), RANKING_IMAGE_EDGE);
        for (int i = 0; i < assets.size(); i++) {
            AssetForRanking asset = assets.get(i);
            parts.add(Map.of("text", "Image ID: " + asset.id()));
            ModelImage image = downloaded.get(i);
            if (image == null) {
                log.warn("Skipping image in ranking (download failed): {}", asset.fileUrl());
                continue;
            }
            parts.add(image.part());
        }

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.2);
        config.put("maxOutputTokens", 2048);
        for (int attempt = 1; attempt <= 2; attempt++) {
            List<ImageRanking> rankings = parseRankings(generate(parts, config, Duration.ofSeconds(40)));
            if (rankings != null && !rankings.isEmpty()) return rankings;
        }
        return List.of();
    }

    /**
     * Generates 3 caption options treating multiple images as one cohesive album/carousel post,
     * highlighting the overall story and progression across the images.
     */
    public List<String> generateCaptionsMultiImage(List<String> imageUrls, String tone, OrgAiProfile profile, String notes) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose at least one image.");
        }

        // Step 1: Look first (album narrative & progression analysis)
        String albumAnalysis = describeAlbum(imageUrls, profile);

        // Step 2: Write captions
        List<Map<String, Object>> parts = new ArrayList<>();
        List<ModelImage> downloaded = downloadAll(imageUrls, CAPTION_IMAGE_EDGE);
        int attached = 0;
        for (int i = 0; i < imageUrls.size(); i++) {
            ModelImage image = downloaded.get(i);
            if (image == null) {
                log.warn("Skipping image in multi-caption (download failed): {}", imageUrls.get(i));
                continue;
            }
            parts.add(image.part()); // Images FIRST
            attached++;
        }

        if (attached == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Couldn't load the images for the AI assistant. Please try again in a moment.");
        }

        parts.add(Map.of("text", buildMultiImageCaptionPrompt(tone, profile, notes, albumAnalysis, imageUrls.size())));
        return generateStringList(parts, 0.65, 1024, Duration.ofSeconds(30));
    }

    public List<String> generateCaptionsMultiImage(List<String> imageUrls, String tone, String orgName) {
        return generateCaptionsMultiImage(imageUrls, tone, new OrgAiProfile(orgName, null, null, null, null, null, null, null), null);
    }

    public record AssetForRanking(UUID id, String fileUrl) {}
    public record ImageRanking(UUID id, int score, String reason) {}

    // ───────────────────────── Gemini calls ─────────────────────────

    /** Opens the connection to Gemini at start-up so the first caption after a restart doesn't pay for it. */
    @EventListener(ApplicationReadyEvent.class)
    void warmUp() {
        Thread thread = new Thread(() -> {
            try {
                URI base = URI.create(apiUrl);
                String modelsUrl = base.getScheme() + "://" + base.getHost() + "/v1beta/models?pageSize=1&key=" + apiKey;
                webClient.get().uri(URI.create(modelsUrl)).retrieve().toBodilessEntity().block(Duration.ofSeconds(15));
            } catch (Exception ignored) {
                // Only a warm-up; the first real call simply opens the connection itself.
            }
        }, "gemini-warm-up");
        thread.setDaemon(true);
        thread.start();
    }

    /** A JSON list of strings (captions, hashtags), asked for twice at most when the answer can't be read. */
    private List<String> generateStringList(List<Map<String, Object>> parts, double temperature, int maxTokens,
                                            Duration timeout) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", temperature);
        config.put("maxOutputTokens", maxTokens);
        config.put("responseMimeType", "application/json");
        config.put("responseSchema", STRING_LIST_SCHEMA);

        for (int attempt = 1; attempt <= 2; attempt++) {
            Map<String, Object> response = generate(parts, config, timeout);
            List<String> items = parseStringList(extractText(response));
            if (items != null && !items.isEmpty()) return items;
            log.warn("Gemini answer could not be read as a list (attempt {}): {}", attempt, describe(response));
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
            "The AI assistant returned an answer we couldn't read. Please try again.");
    }

    /**
     * Races the models (see {@link #fallbackModels}) and returns the first successful answer. Fails only when
     * every model failed, with the most useful reason: quota, rejected request, or busy.
     */
    private Map<String, Object> generate(List<Map<String, Object>> parts, Map<String, Object> baseConfig,
                                         Duration timeout) {
        List<String> models = models();
        List<Throwable> errors = new CopyOnWriteArrayList<>();
        long startedAt = System.nanoTime();

        List<Mono<ModelAnswer>> racers = new ArrayList<>();
        for (int i = 0; i < models.size(); i++) {
            String model = models.get(i);
            Mono<ModelAnswer> call = callModel(model, parts, baseConfig, timeout)
                .map(response -> new ModelAnswer(model, response))
                .doOnError(errors::add);
            racers.add(i < FIRST_WAVE ? call : Mono.delay(HEDGE_DELAY).then(call));
        }

        try {
            ModelAnswer answer = Mono.firstWithValue(racers).block(timeout.plus(HEDGE_DELAY).plusSeconds(5));
            if (answer == null) throw new IllegalStateException("No answer");
            log.info("Gemini answered in {} ms via {}", (System.nanoTime() - startedAt) / 1_000_000, answer.model());
            return answer.response();
        } catch (Exception raceFailure) {
            log.warn("Every Gemini model failed after {} ms: {}", (System.nanoTime() - startedAt) / 1_000_000,
                errors.stream().map(this::describeError).toList());
            throw bestFailure(errors, raceFailure);
        }
    }

    private record ModelAnswer(String model, Map<String, Object> response) {}

    /**
     * One model: adjusts unsupported settings on a 400 (thinking level, structured output — remembered for the
     * model) and retries a dropped connection or overload once, quickly.
     */
    private Mono<Map<String, Object>> callModel(String model, List<Map<String, Object>> parts,
                                                Map<String, Object> baseConfig, Duration timeout) {
        return Mono.defer(() -> {
            ModelSettings settings = modelSettings.computeIfAbsent(model, m -> new ModelSettings());
            int variant = settings.thinkingVariant.get();
            boolean structured = settings.structuredOutput.get();

            Map<String, Object> config = new LinkedHashMap<>(baseConfig);
            if (!structured) {
                config.remove("responseMimeType");
                config.remove("responseSchema");
            }
            if (!config.containsKey("thinkingConfig")) {
                Map<String, Object> thinking = THINKING_VARIANTS.get(variant);
                if (!thinking.isEmpty()) config.put("thinkingConfig", thinking);
            }
            Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", parts)),
                "generationConfig", config
            );

            return webClient.post()
                .uri(URI.create(modelsBaseUrl() + model + ":generateContent?key=" + apiKey))
                .bodyValue(body)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .timeout(timeout)
                .onErrorResume(WebClientResponseException.class, e -> {
                    if (e.getStatusCode().value() == 400
                        && adjustSettings(settings, variant, structured, e.getResponseBodyAsString())) {
                        log.info("Gemini {} rejected a setting; retrying with simpler settings", model);
                        return callModel(model, parts, baseConfig, timeout);
                    }
                    return Mono.error(e);
                });
        }).retryWhen(Retry.backoff(1, Duration.ofMillis(300)).filter(this::isTransient));
    }

    /** Steps to the next simpler settings for a 400; false when there is nothing left to simplify. */
    private boolean adjustSettings(ModelSettings settings, int variant, boolean structured, String responseBody) {
        String lower = responseBody == null ? "" : responseBody.toLowerCase(Locale.ROOT);
        boolean mentionsThinking = lower.contains("thinking");
        boolean vague = lower.contains("invalid argument");
        if (variant < THINKING_VARIANTS.size() - 1 && (mentionsThinking || vague)) {
            settings.thinkingVariant.compareAndSet(variant, variant + 1);
            return true;
        }
        if (structured && (vague || lower.contains("schema") || lower.contains("response_mime_type")
            || lower.contains("responsemimetype"))) {
            settings.structuredOutput.set(false);
            return true;
        }
        return false;
    }

    private boolean isTransient(Throwable error) {
        if (error instanceof WebClientResponseException e) {
            return e.getStatusCode().value() == 503 || e.getStatusCode().value() == 500;
        }
        return error instanceof WebClientRequestException;
    }

    private ResponseStatusException bestFailure(List<Throwable> errors, Throwable fallback) {
        for (Throwable error : errors) {
            if (error instanceof WebClientResponseException e
                && (e.getStatusCode().value() == 429 || e.getResponseBodyAsString().contains("RESOURCE_EXHAUSTED"))
                && errors.stream().noneMatch(this::isBusy)) {
                return (ResponseStatusException) quotaExceededException(e);
            }
        }
        for (Throwable error : errors) {
            if (error instanceof WebClientResponseException e && e.getStatusCode().is4xxClientError()
                && e.getStatusCode().value() != 404 && e.getStatusCode().value() != 429) {
                return new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "The AI assistant rejected the request: " + geminiMessage(e.getResponseBodyAsString()), e);
            }
        }
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
            "The AI assistant is busy right now (Google's Gemini service is overloaded). Please try again in a moment.",
            errors.isEmpty() ? fallback : errors.get(0));
    }

    private boolean isBusy(Throwable error) {
        return !(error instanceof WebClientResponseException e) || e.getStatusCode().is5xxServerError();
    }

    private String describeError(Throwable error) {
        if (error instanceof WebClientResponseException e) {
            return "HTTP " + e.getStatusCode().value() + " " + abbreviate(geminiMessage(e.getResponseBodyAsString()));
        }
        return error.getClass().getSimpleName() + ": " + error.getMessage();
    }

    /** The configured model first, then the fallbacks, without duplicates. */
    private List<String> models() {
        List<String> models = new ArrayList<>();
        String primary = primaryModel();
        if (primary != null) models.add(primary);
        for (String model : fallbackModels.split(",")) {
            String trimmed = model.trim();
            if (!trimmed.isEmpty() && !models.contains(trimmed)) models.add(trimmed);
        }
        return models;
    }

    /** ".../v1beta/models/" from gemini.api.url. */
    private String modelsBaseUrl() {
        int index = apiUrl.indexOf("/models/");
        return index >= 0 ? apiUrl.substring(0, index + "/models/".length())
            : "https://generativelanguage.googleapis.com/v1beta/models/";
    }

    private String primaryModel() {
        int index = apiUrl.indexOf("/models/");
        if (index < 0) return null;
        String rest = apiUrl.substring(index + "/models/".length());
        int colon = rest.indexOf(':');
        return colon >= 0 ? rest.substring(0, colon) : rest;
    }

    // ───────────────────────── images ─────────────────────────

    /** An image ready to send: downscaled bytes and their type. */
    private record ModelImage(String mimeType, byte[] bytes) {
        Map<String, Object> part() {
            return Map.of("inline_data", Map.of(
                "mime_type", mimeType,
                "data", Base64.getEncoder().encodeToString(bytes)
            ));
        }
    }

    private Map<String, Object> imagePart(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an image first.");
        }
        if (imageUrl.startsWith("data:image")) {
            // Already prepared by the browser (downscaled JPEG).
            String[] splits = imageUrl.split(",", 2);
            String mimeType = splits[0].replace("data:", "").replace(";base64", "");
            return Map.of("inline_data", Map.of("mime_type", mimeType, "data", splits.length > 1 ? splits[1] : ""));
        }
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            return shrinkForModel(downloadImageBytes(imageUrl), getMimeType(imageUrl), CAPTION_IMAGE_EDGE).part();
        }
        // Gemini file URI
        return Map.of("file_data", Map.of("file_uri", imageUrl, "mime_type", "image/jpeg"));
    }

    /**
     * Downscales to at most {@code maxEdge}px on the long edge as JPEG.
     */
    private ModelImage shrinkForModel(byte[] bytes, String mimeType, int maxEdge) {
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(bytes));
            if (source == null) return new ModelImage(mimeType, bytes);
            int width = source.getWidth();
            int height = source.getHeight();
            double scale = Math.min(1.0, (double) maxEdge / Math.max(width, height));
            if (scale >= 1.0 && "image/jpeg".equals(mimeType)) return new ModelImage(mimeType, bytes);

            int targetWidth = Math.max(1, (int) Math.round(width * scale));
            int targetHeight = Math.max(1, (int) Math.round(height * scale));
            BufferedImage target = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = target.createGraphics();
            try {
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.setColor(java.awt.Color.WHITE); // transparent PNG areas become white, not black
                graphics.fillRect(0, 0, targetWidth, targetHeight);
                graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
            } finally {
                graphics.dispose();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (!ImageIO.write(target, "jpg", out)) return new ModelImage(mimeType, bytes);
            return new ModelImage("image/jpeg", out.toByteArray());
        } catch (Exception e) {
            return new ModelImage(mimeType, bytes);
        }
    }

    private ModelImage shrinkForModel(byte[] bytes, String mimeType) {
        return shrinkForModel(bytes, mimeType, CAPTION_IMAGE_EDGE);
    }

    /*
     * Storage (Supabase/Cloudflare) closes idle keep-alive connections on its side. Reusing one of those from the
     * pool is what produced the intermittent "Connection reset" when generating captions, so downloads use a pool
     * that drops connections before the server does, plus a timeout and a few quick retries.
     */
    private static final int DOWNLOAD_ATTEMPTS = 3;

    private final WebClient downloadClient = WebClient.builder()
        .clientConnector(PooledHttpConnector.create("image-download", Duration.ofSeconds(20)))
        .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(25 * 1024 * 1024))
        .build();

    private final ExecutorService downloadPool = Executors.newFixedThreadPool(6, runnable -> {
        Thread thread = new Thread(runnable, "image-download");
        thread.setDaemon(true);
        return thread;
    });

    /** Downloads (and downscales) every image at once; an entry is null when that image could not be fetched. */
    private List<ModelImage> downloadAll(List<String> imageUrls, int maxEdge) {
        List<CompletableFuture<ModelImage>> futures = imageUrls.stream()
            .map(url -> CompletableFuture.supplyAsync(() -> {
                try {
                    return shrinkForModel(downloadImageBytes(url), getMimeType(url), maxEdge);
                } catch (Exception e) {
                    return null;
                }
            }, downloadPool))
            .toList();
        return futures.stream().map(CompletableFuture::join).toList();
    }

    private List<ModelImage> downloadAll(List<String> imageUrls) {
        return downloadAll(imageUrls, CAPTION_IMAGE_EDGE);
    }

    private byte[] downloadImageBytes(String imageUrl) {
        Exception lastError = null;
        for (int attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
            try {
                byte[] bytes = downloadClient.get()
                    .uri(imageUrl)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block(Duration.ofSeconds(25));

                if (bytes == null || bytes.length == 0) {
                    throw new IllegalStateException("Downloaded image is empty");
                }
                return bytes;
            } catch (WebClientResponseException e) {
                // 4xx means the file is gone or not public; asking again will not change that.
                lastError = e;
                if (e.getStatusCode().is4xxClientError()) break;
            } catch (Exception e) {
                lastError = e;
            }
            log.warn("Image download attempt {} failed for {}: {}", attempt, imageUrl,
                lastError != null ? lastError.getMessage() : "unknown error");
            if (attempt < DOWNLOAD_ATTEMPTS) sleepQuietly(400L * attempt);
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
            "Couldn't load the image for the AI assistant. Please try again in a moment.", lastError);
    }

    private String getMimeType(String imageUrl) {
        String lower = imageUrl.toLowerCase(Locale.ROOT);
        if (lower.contains(".png")) return "image/png";
        if (lower.contains(".webp")) return "image/webp";
        if (lower.contains(".gif")) return "image/gif";
        return "image/jpeg";
    }

    // ───────────────────────── prompts ─────────────────────────

    private String cacheKey(String imageUrl) {
        if (imageUrl == null) return "";
        if (imageUrl.startsWith("data:")) {
            try {
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                byte[] digest = md.digest(imageUrl.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                return "data:" + Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
            } catch (Exception e) {
                return "data:" + imageUrl.hashCode() + ":" + imageUrl.length();
            }
        }
        return imageUrl;
    }

    private String cleanJson(String raw) {
        if (raw == null || raw.isBlank()) return "{}";
        String text = raw.trim().replaceAll("```json|```", "").trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start != -1 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
    }

    private String buildDescribePrompt(OrgAiProfile profile) {
        return """
            Analyze this image in detail for a Philippine school organization post.
            Examine visible people, activities, setting, mood, and do an accurate OCR read of all visible text (especially event names, titles, dates, venues, deadlines, and calls to action).

            Return ONLY valid JSON matching this schema:
            {
              "scene": "detailed description of what is happening",
              "setting": "location/setting (e.g. indoor gym, classroom, stage, outdoor field)",
              "people": "count/roles visible without identifying individuals",
              "activities": ["key activities depicted"],
              "visibleText": ["exact text segments, headlines, dates, venues read from the poster or image"],
              "eventName": "event title or null if none",
              "date": "event date/time or null if none",
              "venue": "venue/location or null if none",
              "mood": "atmosphere/mood",
              "postType": "announcement/pubmat | event recap | achievement | reminder | greeting | other",
              "relationToOrg": "how or whether this visually connects to a school org"
            }
            """;
    }

    private String buildAlbumDescribePrompt(OrgAiProfile profile, int imageCount) {
        return String.format(
            """
            Analyze ALL %d images as a cohesive sequence/album for a Philippine school organization post.
            Extract the overarching story, progression of events, visible text, and activities across the set.

            Return ONLY valid JSON matching this schema:
            {
              "overallStory": "the overarching narrative or progression shown across the images",
              "sceneProgression": ["step 1 / image 1 scene", "step 2 / image 2 scene"],
              "keyActivities": ["activities across the album"],
              "visibleText": ["key dates, titles, venues, or slogans visible across the images"],
              "eventName": "event name or null if none",
              "date": "event date or null if none",
              "venue": "venue or null if none",
              "mood": "general mood"
            }
            """,
            imageCount
        );
    }

    private String buildOrgProfileBlock(OrgAiProfile profile) {
        if (profile == null) {
            return "Name: Student Organization\n(Note: Only the organization's name is known. Focus on the image.)";
        }
        if (!profile.hasDescription()) {
            return String.format(
                """
                Name: %s
                (Note: Only the organization's name is known. Do not guess what the acronym stands for, and do not build the caption around the name. Focus on the image.)
                """,
                profile.orgName()
            ).trim();
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Name: ").append(profile.orgName());
        if (profile.fullName() != null && !profile.fullName().isBlank()) {
            sb.append(" (").append(profile.fullName().trim()).append(")");
        }
        sb.append("\nAbout: ").append(profile.description().trim());
        if (profile.audience() != null && !profile.audience().isBlank()) {
            sb.append("\nAudience: ").append(profile.audience().trim());
        }
        if (profile.focusAreas() != null && !profile.focusAreas().isBlank()) {
            sb.append("\nUsual activities: ").append(profile.focusAreas().trim());
        }
        if (profile.languagePref() != null && !profile.languagePref().isBlank()) {
            sb.append("\nLanguage: ").append(profile.languagePref().trim());
        }
        if (profile.officialHashtags() != null && !profile.officialHashtags().isBlank()) {
            sb.append("\nOfficial hashtags: ").append(profile.officialHashtags().trim());
        }
        if (profile.captionAvoid() != null && !profile.captionAvoid().isBlank()) {
            sb.append("\nAvoid: ").append(profile.captionAvoid().trim());
        }
        return sb.toString();
    }

    private String buildCaptionPrompt(String tone, OrgAiProfile profile, String notes, String analysisJson) {
        String analysisBlock = (analysisJson != null && !analysisJson.isBlank())
            ? analysisJson
            : "Visible image content is attached. Describe the scene, visible people, activities, setting, and all visible text.";

        String orgBlock = buildOrgProfileBlock(profile);

        String notesBlock = (notes != null && !notes.isBlank())
            ? notes.trim()
            : "None provided.";

        return String.format(
            """
            You write Facebook captions for a Philippine school organization.

            PRIMARY SOURCE - THE IMAGE (most of the caption's content must come from here):
            %s

            BACKGROUND - THE ORGANIZATION (use for framing and voice, NOT as the main topic):
            %s

            OPTIONAL NOTES FROM THE POSTER:
            %s

            TONE: %s - affects wording and energy only, not the facts.
            - FORMAL: professional, structured, respectful
            - ENERGETIC: exciting, dynamic, with energy-filled words
            - CELEBRATORY: festive, warm, joyful, with celebratory emojis
            - URGENT: time-sensitive, clear call-to-action, concise

            Rules:
            1. Describe what actually happens in the image: the activity, setting, people, and any visible text (event name, date, venue, call to action). Each caption must mention at least two specific details from the image.
            2. Mention the organization by name at most once per caption. Connect the image to the org's purpose only where it fits naturally.
            3. Never invent dates, venues, names, results, or events that are not in the image, the org profile, or the notes.
            4. If the image is unrelated to the org's usual activities, still caption the image faithfully. Do not force the org theme.
            5. Write 3 options that differ in angle (e.g. recap / invitation / appreciation). Each is 2–4 sentences with fitting emojis.
            6. Return ONLY a valid JSON array of exactly 3 strings (no markdown, no backticks):
            ["caption 1", "caption 2", "caption 3"]
            """,
            analysisBlock, orgBlock, notesBlock, tone
        );
    }

    private String buildMultiImageCaptionPrompt(String tone, OrgAiProfile profile, String notes, String albumAnalysis, int imageCount) {
        String analysisBlock = (albumAnalysis != null && !albumAnalysis.isBlank())
            ? albumAnalysis
            : "Visible images are attached. Describe the collective sequence, progression of activities, and visible poster text.";

        String orgBlock = buildOrgProfileBlock(profile);

        String notesBlock = (notes != null && !notes.isBlank())
            ? notes.trim()
            : "None provided.";

        return String.format(
            """
            You write Facebook captions for a Philippine school organization.
            You are captioning a set of %d images posted together in a single Facebook post (like an album/carousel).
            Analyze ALL %d images together as one cohesive set — do not caption them individually.
            The captions should tell the overall story or progression shown across the images.

            PRIMARY SOURCE - THE ALBUM (most of the caption's content must come from here):
            %s

            BACKGROUND - THE ORGANIZATION (use for framing and voice, NOT as the main topic):
            %s

            OPTIONAL NOTES FROM THE POSTER:
            %s

            TONE: %s - affects wording and energy only, not the facts.
            - FORMAL: professional, structured, respectful
            - ENERGETIC: exciting, dynamic, with energy-filled words
            - CELEBRATORY: festive, warm, joyful, with celebratory emojis
            - URGENT: time-sensitive, clear call-to-action, concise

            Rules:
            1. Tell the collective story across the %d images: highlight the progression, key activity, and any visible dates/titles/venues. Each caption must mention at least two specific details from the images.
            2. Mention the organization by name at most once per caption. Connect the images to the org's purpose only where it fits naturally.
            3. Never invent dates, venues, names, results, or events that are not in the images, the org profile, or the notes.
            4. If the images are unrelated to the org's usual activities, still caption the images faithfully. Do not force the org theme.
            5. Write 3 options that differ in angle (e.g. recap / invitation / appreciation). Each is 2–4 sentences with fitting emojis.
            6. Return ONLY a valid JSON array of exactly 3 strings (no markdown, no backticks):
            ["caption 1", "caption 2", "caption 3"]
            """,
            imageCount, imageCount, analysisBlock, orgBlock, notesBlock, tone, imageCount
        );
    }

    private String buildRewritePrompt(String caption, String tone, OrgAiProfile profile, String notes, String analysisJson) {
        String orgName = profile != null ? profile.orgName() : "the organization";
        String imageContext = (analysisJson != null && !analysisJson.isBlank())
            ? "\nVisible Image Context: " + analysisJson
            : "";
        String notesContext = (notes != null && !notes.isBlank())
            ? "\nPoster Notes: " + notes.trim()
            : "";

        return String.format(
            """
            Rewrite the following Facebook caption for a Philippine school organization "%s".
            Target tone: %s.
            - FORMAL: professional, structured, respectful
            - ENERGETIC: exciting, dynamic, with energy-filled words
            - CELEBRATORY: festive, warm, joyful, with celebratory emojis
            - URGENT: time-sensitive, clear call-to-action, concise

            Rules:
            - Keep all facts, names, dates, and details from the original caption.
            - Change ONLY the tone, wording, and energy.
            - Do NOT add the organization name if it is not already in the original caption.
            - Never invent new facts or event details.%s%s

            Return ONLY the rewritten caption, nothing else.

            Original caption: %s
            """,
            orgName, tone, imageContext, notesContext, caption
        );
    }

    private String buildHashtagsPrompt(String caption, OrgAiProfile profile, String analysisJson) {
        String orgName = profile != null ? profile.orgName() : "the organization";
        String officialTags = (profile != null && profile.parsedOfficialHashtags().size() > 0)
            ? String.join(" ", profile.parsedOfficialHashtags())
            : "None specified";

        String imageContext = (analysisJson != null && !analysisJson.isBlank())
            ? "\nVisible Image Details: " + analysisJson
            : "";

        return String.format(
            """
            You are a social media hashtag expert for "%s", a Philippine school organization.

            Analyze the following caption and visible content to generate exactly 7 highly relevant Facebook hashtags.

            Caption: %s%s
            Official Organization Hashtags: %s

            Rules:
            - Generate exactly 7 hashtags starting with #
            - Prioritize official hashtags if provided: %s
            - Mix: about 2 official hashtags (if configured in profile), about 3 topic/event hashtags based on the caption and visible image details, and about 2 general/community hashtags.
            - If no official hashtags are provided in the profile, do NOT invent hashtags from the organization name. Focus instead on the specific event, activity, and campus community.
            - Each hashtag must start with #
            - Return ONLY a valid JSON array of exactly 7 strings (no markdown, no backticks):
            ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7"]
            """,
            orgName, caption, imageContext, officialTags, officialTags
        );
    }

    private String buildRankingPrompt(String description, int count) {
        return String.format(
            """
            You are an image search assistant helping a social media manager pick the best photo for a post.
            Target description: "%s"

            You will see %d candidate images, each preceded by a line "Image ID: <id>".
            Score EACH image from 0 (no match) to 100 (perfect match) against the description, and give a short one-sentence reason.

            Return ONLY a valid JSON array covering ALL %d images, sorted by score descending, no markdown, no backticks:
            [{"id":"<image id exactly as given>","score":87,"reason":"..."}]
            """,
            description, count, count
        );
    }

    // ───────────────────────── parsing ─────────────────────────

    /** Reads a JSON array of strings out of the answer, tolerating code fences or text around it. */
    private List<String> parseStringList(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String text = raw.trim().replaceAll("```json|```", "").trim();
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start == -1 || end <= start) return null;
        try {
            List<String> items = mapper.readValue(text.substring(start, end + 1), new TypeReference<List<String>>() {});
            List<String> cleaned = items.stream()
                .filter(item -> item != null && !item.isBlank())
                .map(String::trim)
                .toList();
            return cleaned.isEmpty() ? null : cleaned;
        } catch (IOException e) {
            return null;
        }
    }

    private List<ImageRanking> parseRankings(Map<String, Object> response) {
        String raw = extractText(response);
        if (raw == null || raw.isBlank()) return null;
        raw = raw.trim().replaceAll("```json|```", "").trim();
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start == -1 || end <= start) return null;
        try {
            List<Map<String, Object>> rawList = mapper.readValue(raw.substring(start, end + 1),
                new TypeReference<List<Map<String, Object>>>() {});
            List<ImageRanking> result = new ArrayList<>();
            for (Map<String, Object> item : rawList) {
                try {
                    UUID id = UUID.fromString(String.valueOf(item.get("id")));
                    int score = ((Number) item.get("score")).intValue();
                    String reason = String.valueOf(item.getOrDefault("reason", ""));
                    result.add(new ImageRanking(id, score, reason));
                } catch (Exception ignore) {
                    // Skip malformed entries (e.g. a hallucinated id) rather than failing the whole ranking.
                }
            }
            result.sort((a, b) -> Integer.compare(b.score(), a.score()));
            return result;
        } catch (IOException e) {
            return null;
        }
    }

    /** All answer text of the first candidate (an answer may be split across parts); thought parts are skipped. */
    @SuppressWarnings("unchecked")
    private String extractText(Map<String, Object> response) {
        try {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            if (candidates == null || candidates.isEmpty()) return "";
            Map<String, Object> first = candidates.get(0);

            String finishReason = (String) first.get("finishReason");
            if ("SAFETY".equals(finishReason) || "RECITATION".equals(finishReason)) {
                log.warn("Gemini blocked the answer, finishReason: {}", finishReason);
                return "";
            }

            Map<String, Object> content = (Map<String, Object>) first.get("content");
            if (content == null) return "";
            List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
            if (parts == null) return "";
            StringBuilder text = new StringBuilder();
            for (Map<String, Object> part : parts) {
                if (Boolean.TRUE.equals(part.get("thought"))) continue;
                Object value = part.get("text");
                if (value instanceof String s) text.append(s);
            }
            return text.toString();
        } catch (ClassCastException | NullPointerException e) {
            return "";
        }
    }

    @SuppressWarnings("unchecked")
    private String describe(Map<String, Object> response) {
        try {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            Object finish = candidates != null && !candidates.isEmpty() ? candidates.get(0).get("finishReason") : null;
            return "finishReason=" + finish + ", usage=" + response.get("usageMetadata")
                + ", text=" + abbreviate(extractText(response));
        } catch (Exception e) {
            return String.valueOf(response);
        }
    }

    private String geminiMessage(String responseBody) {
        try {
            Object error = mapper.readValue(responseBody, Map.class).get("error");
            if (error instanceof Map<?, ?> map && map.get("message") != null) return String.valueOf(map.get("message"));
        } catch (Exception ignored) {
            // fall through
        }
        return "unexpected response";
    }

    private static String abbreviate(String text) {
        if (text == null) return "";
        return text.length() > 400 ? text.substring(0, 400) + "…" : text;
    }

    private RuntimeException quotaExceededException(Throwable cause) {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
            "Gemini API quota exceeded for this key/model. The free tier only allows a limited number "
                + "of requests per minute and per day — wait a moment (or for the daily reset), or switch to an "
                + "API key/model with a higher quota.",
            cause
        );
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
