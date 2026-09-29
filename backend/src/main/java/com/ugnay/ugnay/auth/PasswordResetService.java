package com.ugnay.ugnay.auth;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Handles the complete Forgot Password / Reset Password lifecycle.
 *
 * <p>Security properties:
 * <ul>
 *   <li>Tokens are 32 bytes from {@link SecureRandom} — 256 bits of entropy.</li>
 *   <li>Only SHA-256(token) is stored in the database.</li>
 *   <li>Tokens expire after 30 minutes.</li>
 *   <li>Tokens are single-use: all tokens for the user are deleted on successful reset.</li>
 *   <li>The forgot-password path never reveals whether an email exists.</li>
 *   <li>Raw tokens and passwords are never logged.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private static final int TOKEN_BYTES        = 32;
    private static final int EXPIRY_MINUTES     = 30;

    private final UserRepository               userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder              passwordEncoder;
    private final JavaMailSender               mailSender;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Value("${app.mail.from}")
    private String mailFrom;

    // -----------------------------------------------------------------------
    // Forgot Password — request a reset link
    // -----------------------------------------------------------------------

    /**
     * Generates a reset token and sends the email when the account exists.
     * Always returns without error regardless of whether the email is registered
     * (prevents user-enumeration attacks).
     *
     * @param email the submitted email address
     */
    @Transactional
    public void requestPasswordReset(String email) {
        Optional<User> maybeUser = userRepository.findByEmail(email.toLowerCase().trim());

        if (maybeUser.isEmpty()) {
            // Do NOT reveal that the account does not exist.
            log.debug("Password-reset requested for unregistered email (not disclosed to caller)");
            return;
        }

        User user = maybeUser.get();

        // Generate cryptographically secure random token
        byte[] rawBytes = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(rawBytes);
        String rawToken   = Base64.getUrlEncoder().withoutPadding().encodeToString(rawBytes);
        String tokenHash  = sha256Hex(rawToken);

        // Persist the hash (old tokens for this user remain valid until they expire or are replaced on use)
        PasswordResetToken prt = PasswordResetToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(Instant.now().plus(EXPIRY_MINUTES, ChronoUnit.MINUTES))
                .build();
        tokenRepository.save(prt);

        // Send email — any SMTP failure is logged; caller still gets the generic response
        try {
            sendResetEmail(user.getEmail(), rawToken);
        } catch (Exception ex) {
            log.error("Failed to send password-reset email to {} — SMTP error: {}", user.getEmail(), ex.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Reset Password — apply the new password
    // -----------------------------------------------------------------------

    /**
     * Validates the token and updates the user's password.
     *
     * @param rawToken    the raw token from the URL query parameter
     * @param newPassword the new password to set
     * @throws PasswordResetException if the token is invalid, expired, or already used
     */
    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new PasswordResetException("Invalid or missing reset token.");
        }

        String tokenHash = sha256Hex(rawToken.trim());
        PasswordResetToken prt = tokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new PasswordResetException("Invalid or expired reset link."));

        if (prt.isUsed()) {
            throw new PasswordResetException("This reset link has already been used.");
        }
        if (Instant.now().isAfter(prt.getExpiresAt())) {
            throw new PasswordResetException("This reset link has expired. Please request a new one.");
        }

        // Update password using the same BCrypt encoder as the rest of the app
        User user = prt.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Invalidate ALL tokens for this user (single-use semantics for the whole account)
        tokenRepository.deleteAllByUserId(user.getId());

        log.info("Password successfully reset for user {}", user.getId());
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private void sendResetEmail(String to, String rawToken) {
        String resetUrl = frontendUrl.replaceAll("/$", "") + "/reset-password?token=" + rawToken;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(to);
        message.setSubject("Reset your Ugnay password");
        message.setText(
                "Hello,\n\n" +
                "You requested a password reset for your Ugnay account.\n\n" +
                "Click the link below to set a new password. This link expires in " + EXPIRY_MINUTES + " minutes.\n\n" +
                resetUrl + "\n\n" +
                "If you did not request this, you can safely ignore this email.\n\n" +
                "— The Ugnay Team"
        );
        mailSender.send(message);
        log.info("Password-reset email sent (user lookup suppressed for privacy)");
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /** Thrown when token validation fails — caught by the controller to return HTTP 400. */
    public static class PasswordResetException extends RuntimeException {
        public PasswordResetException(String message) {
            super(message);
        }
    }
}
