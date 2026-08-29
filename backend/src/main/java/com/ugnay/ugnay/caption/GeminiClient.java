package com.ugnay.ugnay.caption;


import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import java.io.IOException;
import java.util.*;

@Component
@RequiredArgsConstructor
public class GeminiClient {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

    private static final int MAX_RETRIES = 5;
    private static final long RETRY_DELAY_MS = 1500;

    private final WebClient webClient = WebClient.builder()
        .codecs(configurer -> configurer
            .defaultCodecs()
            .maxInMemorySize(10 * 1024 * 1024)) // 10MB buffer for large images
        .build();

    /**
     * Generates 3 caption options for the given image URL and tone.
     * Uses Gemini 1.5 Flash with multimodal (text + image URL) input.
     */
    public List<String> generateCaptions(String imageUrl, String tone, String orgName) {
        String prompt = buildCaptionPrompt(tone, orgName);
        Map<String, Object> requestBody = buildGeminiRequest(imageUrl, prompt);

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            final int currentAttempt = attempt; // effectively final for lambda capture
            try {
                Map<String, Object> response = webClient.post()
                    .uri(apiUrl + "?key=" + apiKey)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                        status -> status.isError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                            .map(body -> {
                                System.out.println("🔥 GEMINI ERROR (attempt " + currentAttempt + "): "
                                    + clientResponse.statusCode() + " - " + body);
                                return new RuntimeException("Gemini API Error: " + body);
                            })
                    )
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

                List<String> captions = parseCaptions(response);

                // Validate we got real captions, not the fallback
                if (captions != null && !captions.isEmpty()
                        && !captions.get(0).contains("failed")) {
                    return captions;
                }

                System.out.println("⚠️ Caption parse returned fallback on attempt " + attempt
                    + ", raw response: " + extractText(response));

            } catch (Exception e) {
                System.out.println("❌ Gemini attempt " + attempt + " failed: " + e.getMessage());
                if (isQuotaExceeded(e)) {
                    throw quotaExceededException(e);
                }
                if (attempt == MAX_RETRIES) {
                    throw new RuntimeException("Caption generation failed after " + MAX_RETRIES + " attempts.", e);
                }
            }

            // Wait before retrying
            try {
                Thread.sleep(RETRY_DELAY_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
        }

        return List.of("Caption generation failed. Please try again.");
    }

    /**
     * Rewrites a caption in the specified tone.
     */
    public String rewriteWithTone(String caption, String tone, String orgName) {
        String prompt = String.format(
            """
            Rewrite the following Facebook caption for a Philippine college organization called "%s".
            Target tone: %s.
            - FORMAL: professional, structured, respectful
            - ENERGETIC: exciting, dynamic, with energy-filled words
            - CELEBRATORY: festive, warm, joyful, with 🎉 emojis
            - URGENT: time-sensitive, clear call-to-action, concise
            
            Return ONLY the rewritten caption, nothing else.
            
            Original caption: %s
            """,
            orgName, tone, caption
        );

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
            "generationConfig", Map.of("temperature", 0.7, "maxOutputTokens", 512)
        );

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                Map<String, Object> response = webClient.post()
                    .uri(apiUrl + "?key=" + apiKey)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                        status -> status.isError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                            .map(body -> {
                                System.out.println("🔥 GEMINI ERROR: " + clientResponse.statusCode() + " - " + body);
                                return new RuntimeException("Gemini API Error: " + body);
                            })
                    )
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

                String text = extractText(response);
                if (text != null && !text.isBlank()) return text;

            } catch (Exception e) {
                System.out.println("❌ Rewrite attempt " + attempt + " failed: " + e.getMessage());
                if (isQuotaExceeded(e)) {
                    throw quotaExceededException(e);
                }
                if (attempt == MAX_RETRIES) throw new RuntimeException("Rewrite failed after retries.", e);
                sleepSilently();
            }
        }

        return caption; // Return original if all retries fail
    }

    /**
     * Generates 7 relevant hashtags from caption + image context.
     */
    public List<String> generateHashtags(String caption, String orgName) {
        String prompt = String.format(
            """
            You are a social media hashtag expert for "%s", a Philippine college organization.
            
            Analyze the following caption and generate exactly 7 highly relevant Facebook hashtags.
            
            Caption: %s
            
            Rules:
            - Hashtags MUST be directly relevant to the specific content, topics, and themes in the caption above
            - Include hashtags about the subject matter discussed in the caption
            - Include 1-2 hashtags related to the organization name "%s"
            - Each hashtag must start with #
            - Do NOT use only generic tags — they must relate to what the caption is actually about
            - Return ONLY a valid JSON array of exactly 7 strings, no markdown, no explanation, no conversational filler
            - Example format: ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7"]
            """,
            orgName, caption, orgName
        );

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
            "generationConfig", Map.of("temperature", 0.7, "maxOutputTokens", 1024)
        );

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                Map<String, Object> response = webClient.post()
                    .uri(apiUrl + "?key=" + apiKey)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                        status -> status.isError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                            .map(body -> {
                                System.out.println("🔥 GEMINI ERROR RESPONSE: " + body);
                                return new RuntimeException("Gemini API Error: " + body);
                            })
                    )
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

                String raw = extractText(response);
                if (raw == null || raw.isBlank()) {
                    System.out.println("⚠️ Gemini returned empty text for hashtags on attempt " + attempt);
                    continue;
                }

                raw = raw.trim().replaceAll("```json|```", "").trim();

                // Defensively find JSON array bounds (same approach as parseCaptions)
                int start = raw.indexOf('[');
                int end = raw.lastIndexOf(']');
                if (start == -1 || end == -1 || end <= start) {
                    System.out.println("⚠️ No valid JSON array found in hashtag response: " + raw);
                    continue;
                }
                raw = raw.substring(start, end + 1);

                com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();
                List<String> tags = mapper.readValue(raw,
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});

                if (tags != null && !tags.isEmpty()) return tags;

            } catch (Exception e) {
                System.out.println("❌ Hashtag attempt " + attempt + " failed: " + e.getMessage());
                if (isQuotaExceeded(e)) {
                    throw quotaExceededException(e);
                }
                if (attempt == MAX_RETRIES) break;
                sleepSilently();
            }
        }

        // Derive fallback hashtags from the caption words instead of hardcoding
        List<String> fallback = new ArrayList<>();
        fallback.add("#" + orgName.replaceAll("[^a-zA-Z0-9]", ""));
        String[] words = caption.split("\\s+");
        for (String word : words) {
            String cleaned = word.replaceAll("[^a-zA-Z0-9]", "");
            if (cleaned.length() >= 4 && fallback.size() < 5) {
                fallback.add("#" + cleaned.substring(0, 1).toUpperCase() + cleaned.substring(1).toLowerCase());
            }
        }
        return fallback.isEmpty() ? List.of("#" + orgName.replaceAll("[^a-zA-Z0-9]", "")) : fallback;
    }

    /**
     * Scores a folder's candidate images against a free-text description and returns
     * them ranked best-match-first. Used by the Media Repository's AI image picker
     * (CLAUDE.md Caption Studio flow step: description -> ranked images).
     */
    public List<ImageRanking> rankImages(List<AssetForRanking> assets, String description) {
        if (assets.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", buildRankingPrompt(description, assets.size())));
        for (AssetForRanking asset : assets) {
            parts.add(Map.of("text", "Image ID: " + asset.id()));
            try {
                byte[] bytes = downloadImageBytes(asset.fileUrl());
                parts.add(Map.of("inline_data", Map.of(
                    "mime_type", getMimeType(asset.fileUrl()),
                    "data", Base64.getEncoder().encodeToString(bytes)
                )));
            } catch (Exception e) {
                System.out.println("⚠️ Skipping image in ranking (download failed): " + asset.fileUrl() + " - " + e.getMessage());
            }
        }

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(Map.of("parts", parts)),
            "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", 2048)
        );

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                Map<String, Object> response = webClient.post()
                    .uri(apiUrl + "?key=" + apiKey)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                        status -> status.isError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                            .map(body -> new RuntimeException("Gemini API Error: " + body))
                    )
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

                List<ImageRanking> rankings = parseRankings(response);
                if (rankings != null && !rankings.isEmpty()) return rankings;

            } catch (Exception e) {
                System.out.println("❌ Image ranking attempt " + attempt + " failed: " + e.getMessage());
                if (isQuotaExceeded(e)) {
                    throw quotaExceededException(e);
                }
                if (attempt == MAX_RETRIES) throw new RuntimeException("Image ranking failed after retries.", e);
                sleepSilently();
            }
        }

        return List.of();
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

    private List<ImageRanking> parseRankings(Map<String, Object> response) {
        try {
            String raw = extractText(response);
            if (raw == null || raw.isBlank()) return null;

            raw = raw.trim().replaceAll("```json|```", "").trim();
            int start = raw.indexOf('[');
            int end = raw.lastIndexOf(']');
            if (start == -1 || end == -1 || end <= start) return null;
            raw = raw.substring(start, end + 1);

            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            List<Map<String, Object>> rawList = mapper.readValue(raw,
                new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});

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

    public record AssetForRanking(UUID id, String fileUrl) {}
    public record ImageRanking(UUID id, int score, String reason) {}

    // --- Private helpers ---

    private String buildCaptionPrompt(String tone, String orgName) {
        return String.format(
            """
            You are a social media assistant for "%s", a Philippine college organization.
            Analyze this image and generate exactly 3 Facebook caption options.
            
            Tone: %s
            - FORMAL: professional and institutional
            - ENERGETIC: exciting and dynamic  
            - CELEBRATORY: festive and warm
            - URGENT: time-sensitive with clear CTA
            
            Rules:
            - Each caption must include relevant emojis
            - Each caption should be 2–4 sentences
            - Use Filipino college student context
            - Return ONLY a valid JSON array of exactly 3 strings (no markdown, no backticks):
              ["caption 1", "caption 2", "caption 3"]
            """,
            orgName, tone
        );
    }

    private byte[] downloadImageBytes(String imageUrl) {
        try {
            byte[] bytes = webClient.get()
                .uri(imageUrl)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                .retrieve()
                .bodyToMono(byte[].class)
                .block();

            if (bytes == null || bytes.length == 0) {
                throw new RuntimeException("Downloaded image is empty from URL: " + imageUrl);
            }

            System.out.println("✅ Downloaded image: " + bytes.length + " bytes from " + imageUrl);
            return bytes;
        } catch (Exception e) {
            throw new RuntimeException("Failed to download image from URL: " + imageUrl
                + " — " + e.getMessage(), e);
        }
    }

    private String getMimeType(String imageUrl) {
        String lower = imageUrl.toLowerCase();
        if (lower.contains(".png")) return "image/png";
        if (lower.contains(".webp")) return "image/webp";
        if (lower.contains(".gif")) return "image/gif";
        return "image/jpeg";
    }

    private Map<String, Object> buildGeminiRequest(String imageUrl, String prompt) {
        List<Map<String, Object>> parts = new ArrayList<>();

        if (imageUrl.startsWith("data:image")) {
            // Base64 data URL
            String[] splits = imageUrl.split(",", 2);
            String mimeType = splits[0].replace("data:", "").replace(";base64", "");
            parts.add(Map.of("inline_data", Map.of(
                "mime_type", mimeType,
                "data", splits[1]
            )));
        } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            // Download and convert to base64
            byte[] imageBytes = downloadImageBytes(imageUrl);
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String mimeType = getMimeType(imageUrl);
            parts.add(Map.of("inline_data", Map.of(
                "mime_type", mimeType,
                "data", base64Image
            )));
        } else {
            // Gemini file URI
            parts.add(Map.of("file_data", Map.of(
                "file_uri", imageUrl,
                "mime_type", "image/jpeg"
            )));
        }

        parts.add(Map.of("text", prompt));

        return Map.of(
            "contents", List.of(Map.of("parts", parts)),
            // ✅ Increased from 1024 — prevents JSON truncation for longer captions
            "generationConfig", Map.of("temperature", 0.8, "maxOutputTokens", 2048)
        );
    }

    private List<String> parseCaptions(Map<String, Object> response) {
        try {
            String raw = extractText(response);
            if (raw == null || raw.isBlank()) {
                System.out.println("⚠️ Gemini returned empty text in parseCaptions");
                return null;
            }

            raw = raw.trim().replaceAll("```json|```", "").trim();

            // Find JSON array bounds defensively
            int start = raw.indexOf('[');
            int end = raw.lastIndexOf(']');
            if (start == -1 || end == -1 || end <= start) {
                System.out.println("⚠️ No valid JSON array found in: " + raw);
                return null;
            }
            raw = raw.substring(start, end + 1);

            com.fasterxml.jackson.databind.ObjectMapper mapper =
                new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(raw,
                new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});

        } catch (IOException e) {
            System.out.println("❌ JSON parse error in parseCaptions: " + e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private String extractText(Map<String, Object> response) {
        try {
            List<Map<String, Object>> candidates =
                (List<Map<String, Object>>) response.get("candidates");
            Map<String, Object> first = candidates.get(0);

            // Check for safety block or finish reason issues
            String finishReason = (String) first.get("finishReason");
            if ("SAFETY".equals(finishReason) || "RECITATION".equals(finishReason)) {
                System.out.println("⚠️ Gemini blocked response, finishReason: " + finishReason);
                return "";
            }

            Map<String, Object> content = (Map<String, Object>) first.get("content");
            List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
            return (String) parts.get(0).get("text");

        } catch (NullPointerException | ClassCastException | IndexOutOfBoundsException e) {
            System.out.println("❌ extractText failed: " + e.getMessage()
                + " | response: " + response);
            return "";
        }
    }

    /** Detects Gemini's daily-quota-exceeded error (HTTP 429 / RESOURCE_EXHAUSTED), for which retrying is pointless. */
    private boolean isQuotaExceeded(Throwable e) {
        String msg = e.getMessage();
        return msg != null && (msg.contains("RESOURCE_EXHAUSTED") || msg.contains("\"code\": 429") || msg.contains("\"code\":429"));
    }

    private RuntimeException quotaExceededException(Throwable cause) {
        return new RuntimeException(
            "Gemini API daily quota exceeded for this key/model. The free tier only allows a limited number "
                + "of requests per day — wait for it to reset (daily), or switch to an API key/model with a higher quota.",
            cause
        );
    }

    private void sleepSilently() {
        try {
            Thread.sleep(RETRY_DELAY_MS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}