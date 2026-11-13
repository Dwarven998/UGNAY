package com.ugnay.ugnay.auth;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Password lifecycle: Forgot Password / Reset Password from the login page, and Change Password from
 * the signed-in Profile page.
 *
 * <p>Security properties:
 * <ul>
 *   <li>Tokens are 32 bytes from {@link SecureRandom} — 256 bits of entropy.</li>
 *   <li>Only SHA-256(token) is stored in the database.</li>
 *   <li>Tokens expire after 30 minutes.</li>
 *   <li>Only the newest link works: issuing a link removes the user's earlier ones, and a successful
 *       reset or change removes all of them.</li>
 *   <li>Every reset or change stamps {@code passwordChangedAt}, which signs out every other session.</li>
 *   <li>The forgot-password path never reveals whether an email exists.</li>
 *   <li>Raw tokens and passwords are never logged.</li>
 * </ul>
 *
 * <p>Each reset email has its own subject line (it carries the request time) and an
 * {@code X-Entity-Ref-ID} header. Without that, Gmail folds repeat requests into the first email's
 * thread, so the user opens the old, already-used link and the reset seems to work only once.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private static final int TOKEN_BYTES    = 32;
    private static final int EXPIRY_MINUTES = 30;
    private static final ZoneId MAIL_ZONE   = ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter MAIL_TIME =
            DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a", Locale.ENGLISH).withZone(MAIL_ZONE);

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository               userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder              passwordEncoder;
    private final JavaMailSender               mailSender;
    private final LoginRateLimiterService      rateLimiterService;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Value("${app.mail.from}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    /** False when SMTP_USERNAME / SMTP_PASSWORD are missing — no email can be sent at all. */
    public boolean isMailConfigured() {
        return smtpUsername != null && !smtpUsername.isBlank() && smtpPassword != null && !smtpPassword.isBlank();
    }

    @jakarta.annotation.PostConstruct
    void warnIfMailNotConfigured() {
        if (!isMailConfigured()) {
            log.warn("SMTP is NOT configured: password-reset emails cannot be sent. "
                    + "Set SMTP_USERNAME and SMTP_PASSWORD (a Gmail App Password) in backend/.env and restart.");
        }
    }

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
        if (email == null || email.isBlank()) return;
        Optional<User> maybeUser = userRepository.findFirstByEmailIgnoreCase(email.trim());

        if (maybeUser.isEmpty()) {
            // Do NOT reveal that the account does not exist.
            log.debug("Password-reset requested for unregistered email (not disclosed to caller)");
            return;
        }
        issueAndSend(maybeUser.get());
    }

    /**
     * Sends a reset link to the signed-in user's own address — for accounts that do not know their
     * current password (for example ones created with Google sign-in).
     */
    @Transactional
    public void requestPasswordResetForSignedInUser(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow();
        // The account is the caller's own, so (unlike the public path) a delivery failure can be reported.
        if (!issueAndSend(user)) {
            throw new EmailDeliveryException(isMailConfigured()
                    ? "We couldn't send the email right now. Please try again in a few minutes."
                    : "Email sending isn't set up on the server yet, so no link was sent. Please contact the administrator.");
        }
    }

    /** @return true when the email was handed to the mail server */
    private boolean issueAndSend(User user) {
        if (!isMailConfigured()) {
            log.error("Password-reset email for user {} NOT sent: SMTP_USERNAME / SMTP_PASSWORD are not set.", user.getId());
            return false;
        }

        // Only the newest link is valid: drop any earlier, unused links for this account.
        tokenRepository.deleteAllByUserId(user.getId());

        byte[] rawBytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(rawBytes);
        String rawToken  = Base64.getUrlEncoder().withoutPadding().encodeToString(rawBytes);

        Instant now = Instant.now();
        tokenRepository.save(PasswordResetToken.builder()
                .user(user)
                .tokenHash(sha256Hex(rawToken))
                .expiresAt(now.plus(EXPIRY_MINUTES, ChronoUnit.MINUTES))
                .createdAt(now)
                .build());

        // Any SMTP failure is logged; the caller still gets the generic response.
        try {
            sendResetEmail(user.getEmail(), rawToken, now);
            return true;
        } catch (Exception ex) {
            log.error("Failed to send password-reset email for user {} — SMTP error: {}", user.getId(), ex.getMessage());
            return false;
        }
    }

    // -----------------------------------------------------------------------
    // Reset Password — apply the new password from an emailed link
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
                .orElseThrow(() -> new PasswordResetException(
                        "This reset link is no longer valid. It was already used or a newer link was sent. "
                        + "Open the most recent reset email, or request a new link."));

        if (prt.isUsed()) {
            throw new PasswordResetException("This reset link has already been used. Please request a new one.");
        }
        if (Instant.now().isAfter(prt.getExpiresAt())) {
            tokenRepository.delete(prt);
            throw new PasswordResetException("This reset link has expired. Please request a new one.");
        }

        applyNewPassword(prt.getUser(), newPassword);
        // The user proved control of the mailbox, so clear any login lockout for the account.
        rateLimiterService.recordSuccessfulLogin(prt.getUser().getEmail());
        log.info("Password successfully reset for user {}", prt.getUser().getId());
    }

    // -----------------------------------------------------------------------
    // Change Password — signed-in user on the Profile page
    // -----------------------------------------------------------------------

    /**
     * Changes the signed-in user's password after checking the current one. Five wrong current
     * passwords lock the change for 15 minutes, so a hijacked session cannot guess its way through.
     *
     * @throws PasswordChangeException with a user-facing message when the change is refused
     */
    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        String lockKey = "password-change:" + userId;
        if (rateLimiterService.isAccountLocked(lockKey)) {
            throw new PasswordChangeException(PasswordChangeException.Reason.LOCKED,
                    "Too many incorrect attempts. Try again in 15 minutes, or use \"Email me a reset link\".");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new PasswordChangeException(PasswordChangeException.Reason.INVALID, "Account not found."));

        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            rateLimiterService.recordFailedLogin(lockKey);
            int remaining = rateLimiterService.getRemainingAttempts(lockKey);
            throw new PasswordChangeException(PasswordChangeException.Reason.INVALID,
                    remaining > 0
                        ? "Current password is incorrect. " + remaining + " attempt" + (remaining == 1 ? "" : "s") + " left."
                        : "Too many incorrect attempts. Try again in 15 minutes, or use \"Email me a reset link\".");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new PasswordChangeException(PasswordChangeException.Reason.INVALID,
                    "Your new password must be different from your current password.");
        }

        applyNewPassword(user, newPassword);
        rateLimiterService.recordSuccessfulLogin(lockKey);
        log.info("Password changed from profile for user {}", user.getId());
    }

    /** Sets the hash, stamps the change time (signs out other sessions) and voids every reset link. */
    private void applyNewPassword(User user, String newPassword) {
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(Instant.now());
        userRepository.save(user);
        tokenRepository.deleteAllByUserId(user.getId());
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private void sendResetEmail(String to, String rawToken, Instant requestedAt) throws Exception {
        String resetUrl = frontendUrl.replaceAll("/$", "") + "/reset-password?token=" + rawToken;
        String when = MAIL_TIME.format(requestedAt);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
        helper.setFrom(mailFrom);
        helper.setTo(to);
        // A distinct subject keeps every request in its own email instead of a Gmail thread.
        helper.setSubject("Reset your Ugnay password (requested " + when + ")");
        helper.setText(
                "Hello,\n\n" +
                "We received a request on " + when + " (Philippine time) to reset the password for your Ugnay account.\n\n" +
                "Click the link below to set a new password. This link expires in " + EXPIRY_MINUTES + " minutes " +
                "and replaces any reset link we sent you before.\n\n" +
                resetUrl + "\n\n" +
                "If you did not request this, you can safely ignore this email. Your password stays the same.\n\n" +
                "— The Ugnay Team"
        );
        // Unique per message: stops Gmail from grouping repeat requests and hiding the new link.
        message.setHeader("X-Entity-Ref-ID", UUID.randomUUID().toString());
        mailSender.send(message);
        log.info("Password-reset email sent (recipient suppressed for privacy)");
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

    /** The reset email for a signed-in user could not be sent; the message is safe to show the user. */
    public static class EmailDeliveryException extends RuntimeException {
        public EmailDeliveryException(String message) {
            super(message);
        }
    }

    /** Thrown when a signed-in password change is refused; the message is safe to show the user. */
    public static class PasswordChangeException extends RuntimeException {
        public enum Reason { INVALID, LOCKED }

        private final Reason reason;

        public PasswordChangeException(Reason reason, String message) {
            super(message);
            this.reason = reason;
        }

        public Reason getReason() {
            return reason;
        }
    }
}
