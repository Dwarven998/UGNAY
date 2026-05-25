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

    private static final int MAX_RETRIES = 3;
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
            Generate 7 relevant Facebook hashtags for this post by the Philippine college organization "%s".
            Caption: %s
            
            Rules:
            - Use campus/student/Philippine context
            - Mix broad (#StudentLife) and specific (#CITUniversity) tags
            - Return ONLY a JSON array of strings like: ["#tag1", "#tag2", ...]
            - No explanation, no markdown, just the JSON array
            """,
            orgName, caption
        );

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
            "generationConfig", Map.of("temperature", 0.7, "maxOutputTokens", 256)
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

                String raw = extractText(response).trim()
                    .replaceAll("```json|```", "").trim();

                com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();
                List<String> tags = mapper.readValue(raw,
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});

                if (tags != null && !tags.isEmpty()) return tags;

            } catch (Exception e) {
                System.out.println("❌ Hashtag attempt " + attempt + " failed: " + e.getMessage());
                if (attempt == MAX_RETRIES) break;
                sleepSilently();
            }
        }

        return List.of("#StudentLife", "#CollegeOrg", "#Philippines");
    }

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

    private void sleepSilently() {
        try {
            Thread.sleep(RETRY_DELAY_MS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}