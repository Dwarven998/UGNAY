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

    private final WebClient webClient = WebClient.builder().build();

    /**
     * Generates 3 caption options for the given image URL and tone.
     * Uses Gemini 1.5 Flash with multimodal (text + image URL) input.
     */
    public List<String> generateCaptions(String imageUrl, String tone, String orgName) {
        String prompt = buildCaptionPrompt(tone, orgName);

        Map<String, Object> requestBody = buildGeminiRequest(imageUrl, prompt);

        Map<String, Object> response = webClient.post()
            .uri(apiUrl + "?key=" + apiKey)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        return parseCaptions(response);
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
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt))))
        );

        Map<String, Object> response = webClient.post()
            .uri(apiUrl + "?key=" + apiKey)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        return extractText(response);
    }

    /**
     * Generates 5–10 relevant hashtags from caption + image context.
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
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt))))
        );

        Map<String, Object> response = webClient.post()
            .uri(apiUrl + "?key=" + apiKey)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        String raw = extractText(response).trim();
        // Parse JSON array
        try {
            raw = raw.replaceAll("```json|```", "").trim();
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(raw, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (IOException e) {
            return List.of("#StudentLife", "#CollegeOrg", "#Philippines");
        }
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
            - Return ONLY a JSON array of exactly 3 strings:
              ["caption 1", "caption 2", "caption 3"]
            - No explanation, no markdown, just the JSON array
            """,
            orgName, tone
        );
    }

    private Map<String, Object> buildGeminiRequest(String imageUrl, String prompt) {
        // Gemini multimodal: image URL + text prompt
        List<Map<String, Object>> parts = new ArrayList<>();

        // Check if it's a data URL (base64) or regular URL
        if (imageUrl.startsWith("data:image")) {
            String[] splits = imageUrl.split(",");
            String mimeType = splits[0].replace("data:", "").replace(";base64", "");
            parts.add(Map.of("inline_data", Map.of(
                "mime_type", mimeType,
                "data", splits[1]
            )));
        } else {
            parts.add(Map.of("file_data", Map.of(
                "file_uri", imageUrl,
                "mime_type", "image/jpeg"
            )));
        }

        parts.add(Map.of("text", prompt));

        return Map.of(
            "contents", List.of(Map.of("parts", parts)),
            "generationConfig", Map.of("temperature", 0.8, "maxOutputTokens", 1024)
        );
    }

    private List<String> parseCaptions(Map<String, Object> response) {
        try {
            String raw = extractText(response).trim()
                .replaceAll("```json|```", "").trim();
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(raw, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (IOException e) {
            return List.of("Caption generation failed. Please try again.");
        }
    }

    @SuppressWarnings("unchecked")
    private String extractText(Map<String, Object> response) {
        try {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            Map<String, Object> first = candidates.get(0);
            Map<String, Object> content = (Map<String, Object>) first.get("content");
            List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
            Map<String, Object> part = parts.get(0);
            return (String) part.get("text");
        } catch (NullPointerException | ClassCastException | IndexOutOfBoundsException e) {
            return "";
        }
    }
}