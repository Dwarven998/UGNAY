package com.ugnay.ugnay.auth;

import com.ugnay.ugnay.core.*;
import com.ugnay.ugnay.facebook.FacebookOAuthService;
import lombok.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final FacebookOAuthService facebookOAuthService;
    private final LoginRateLimiterService rateLimiterService;
    private final GoogleAuthService googleAuthService;
    private final TurnstileService turnstileService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req,
                                      HttpServletRequest httpRequest) {
        // 1. Turnstile verification — must happen before any business logic
        String clientIp = extractClientIp(httpRequest);
        if (!turnstileService.verify(req.turnstileToken(), clientIp)) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Security Verification Failed",
                "message", "Security verification failed. Please try again."
            ));
        }

        // 2. Email uniqueness check
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest().body("Email already registered");
        }

        // 3. Create user
        User user = User.builder()
            .email(req.email())
            .passwordHash(passwordEncoder.encode(req.password()))
            .orgName(req.orgName())
            .tonePreference(User.TonePreference.FORMAL)
            .build();
        userRepository.save(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getOrgName()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req,
                                   HttpServletRequest httpRequest) {
        String email = req.email();

        // 1. Turnstile verification — must happen before any business logic
        String clientIp = extractClientIp(httpRequest);
        if (!turnstileService.verify(req.turnstileToken(), clientIp)) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Security Verification Failed",
                "message", "Security verification failed. Please try again."
            ));
        }

        // 2. Account Lockout Check
        if (rateLimiterService.isAccountLocked(email)) {
            return ResponseEntity.status(HttpStatus.LOCKED).body(Map.of(
                "error", "Account Locked",
                "message", "Too many failed login attempts. Your account is locked for 15 minutes."
            ));
        }

        // 3. Database Lookup & Password Verification
        Optional<User> userOptional = userRepository.findByEmail(email);

        if (userOptional.isEmpty() || !passwordEncoder.matches(req.password(), userOptional.get().getPasswordHash())) {
            rateLimiterService.recordFailedLogin(email);
            int remaining = rateLimiterService.getRemainingAttempts(email);

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "error", "Invalid Credentials",
                "message", "Invalid email or password. Remaining attempts before lockout: " + remaining
            ));
        }

        // 4. Reset Fail Counters on Success
        User user = userOptional.get();
        rateLimiterService.recordSuccessfulLogin(email);

        // 5. Issue Token
        String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getOrgName()));
    }

    /**
     * "Continue with Google": logs in the account matching the verified Google email. When no account exists yet,
     * replies with needsOrgName so the client can ask for an organization name and call again with it.
     */
    @PostMapping("/google")
    public ResponseEntity<?> google(@Valid @RequestBody GoogleAuthRequest req) {
        GoogleAuthService.GoogleIdentity identity;
        try {
            identity = googleAuthService.verify(req.accessToken());
        } catch (GoogleAuthService.GoogleAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "error", "Google Sign-In Failed",
                "message", e.getMessage()
            ));
        }

        Optional<User> existing = userRepository.findByEmail(identity.email());
        if (existing.isPresent()) {
            User user = existing.get();
            String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
            return ResponseEntity.ok(new GoogleAuthResponse(token, user.getId(), user.getOrgName(), false, false, user.getEmail()));
        }

        String orgName = req.orgName() == null ? "" : req.orgName().trim();
        if (orgName.isEmpty()) {
            return ResponseEntity.ok(new GoogleAuthResponse(null, null, null, true, false, identity.email()));
        }

        // Google accounts have no password; store a hash of a random value so password login can never match.
        User user = User.builder()
            .email(identity.email())
            .passwordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
            .orgName(orgName)
            .tonePreference(User.TonePreference.FORMAL)
            .build();
        userRepository.save(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
        return ResponseEntity.ok(new GoogleAuthResponse(token, user.getId(), user.getOrgName(), false, true, user.getEmail()));
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me(@AuthenticationPrincipal User user) {
        var connection = facebookOAuthService.buildConnectionDetails(user);
        return ResponseEntity.ok(new CurrentUserResponse(
            user.getId(),
            user.getOrgName(),
            connection.facebookConnected(),
            connection.facebookPageId(),
            connection.facebookPageName(),
            connection.facebookPagePictureUrl()
        ));
    }

    // --- Forgot Password / Reset Password ---

    /**
     * Accepts an email and (if the account exists) sends a password-reset link.
     * Always returns the same generic response to prevent user-enumeration.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        passwordResetService.requestPasswordReset(req.email());
        return ResponseEntity.ok(Map.of(
            "message", "If an account exists for that email, a password reset link has been sent."
        ));
    }

    /**
     * Validates the reset token and updates the user's password.
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        try {
            passwordResetService.resetPassword(req.token(), req.newPassword());
            return ResponseEntity.ok(Map.of("message", "Password successfully reset. You can now log in."));
        } catch (PasswordResetService.PasswordResetException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Reset Failed",
                "message", e.getMessage()
            ));
        }
    }

    // --- DTOs (inner records) ---
    public record ForgotPasswordRequest(
        @jakarta.validation.constraints.Email
        @jakarta.validation.constraints.NotBlank
        String email
    ) {}

    public record ResetPasswordRequest(
        @jakarta.validation.constraints.NotBlank String token,
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Size(min = 6, message = "Password must be at least 6 characters.")
        String newPassword
    ) {}

    public record RegisterRequest(
        @jakarta.validation.constraints.Email String email,
        @jakarta.validation.constraints.NotBlank String password,
        @jakarta.validation.constraints.NotBlank String orgName,
        @jakarta.validation.constraints.NotBlank String turnstileToken
    ) {}

    public record LoginRequest(
        @jakarta.validation.constraints.Email String email,
        @jakarta.validation.constraints.NotBlank String password,
        @jakarta.validation.constraints.NotBlank String turnstileToken
    ) {}

    public record GoogleAuthRequest(
        @jakarta.validation.constraints.NotBlank String accessToken,
        String orgName
    ) {}

    public record GoogleAuthResponse(
        String token,
        java.util.UUID userId,
        String orgName,
        boolean needsOrgName,
        boolean newAccount,
        String email
    ) {}

    public record AuthResponse(String token, java.util.UUID userId, String orgName) {}

    public record CurrentUserResponse(
        java.util.UUID userId,
        String orgName,
        boolean facebookConnected,
        String facebookPageId,
        String facebookPageName,
        String facebookPagePictureUrl
    ) {}
}