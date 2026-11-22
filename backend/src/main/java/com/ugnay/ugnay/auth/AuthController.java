package com.ugnay.ugnay.auth;

import com.ugnay.ugnay.core.*;
import com.ugnay.ugnay.core.error.ApiException;
import com.ugnay.ugnay.core.error.AuthenticationRequiredException;
import com.ugnay.ugnay.core.error.ErrorCode;
import com.ugnay.ugnay.core.error.ResourceConflictException;
import com.ugnay.ugnay.facebook.FacebookOAuthService;
import lombok.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    // The login form recognises this text ("security"), so keep it as is.
    private static final String SECURITY_VERIFICATION_FAILED = "Security verification failed. Please try again.";
    private static final String EMAIL_ALREADY_REGISTERED = "Email already registered";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final FacebookOAuthService facebookOAuthService;
    private final LoginRateLimiterService rateLimiterService;
    private final GoogleAuthService googleAuthService;
    private final TurnstileService turnstileService;
    private final PasswordResetService passwordResetService;

    private final AuthCookieWriter authCookieWriter;

    private void setAuthCookie(HttpServletResponse response, HttpServletRequest request, String token) {
        authCookieWriter.set(response, request, token);
    }

    private void clearAuthCookie(HttpServletResponse response, HttpServletRequest request) {
        authCookieWriter.clear(response, request);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req,
                                      HttpServletRequest httpRequest,
                                      HttpServletResponse httpResponse) {
        // 1. Turnstile verification — must happen before any business logic
        String clientIp = extractClientIp(httpRequest);
        if (!turnstileService.verify(req.turnstileToken(), clientIp)) {
            throw new ApiException(ErrorCode.SECURITY_VERIFICATION_FAILED, SECURITY_VERIFICATION_FAILED);
        }

        // 2. Email uniqueness check (the unique constraint below also covers two sign-ups racing each other)
        if (userRepository.existsByEmail(req.email())) {
            throw new ResourceConflictException(EMAIL_ALREADY_REGISTERED);
        }

        // 3. Create user
        User user = User.builder()
            .email(req.email())
            .passwordHash(passwordEncoder.encode(req.password()))
            .orgName(req.orgName())
            .description(req.description() != null ? req.description().trim() : null)
            .fullName(req.fullName() != null ? req.fullName().trim() : null)
            .audience(req.audience() != null ? req.audience().trim() : null)
            .focusAreas(req.focusAreas() != null ? req.focusAreas().trim() : null)
            .languagePref(req.languagePref() != null ? req.languagePref().trim() : null)
            .officialHashtags(req.officialHashtags() != null ? req.officialHashtags().trim() : null)
            .captionAvoid(req.captionAvoid() != null ? req.captionAvoid().trim() : null)
            .tonePreference(User.TonePreference.FORMAL)
            .build();
        saveNewUser(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
        setAuthCookie(httpResponse, httpRequest, token);
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getOrgName()));
    }

    /** A concurrent sign-up with the same email hits the unique constraint: report it like the pre-check does. */
    private void saveNewUser(User user) {
        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            throw new ResourceConflictException(EMAIL_ALREADY_REGISTERED, ex);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req,
                                   HttpServletRequest httpRequest,
                                   HttpServletResponse httpResponse) {
        String email = req.email();

        // 1. Turnstile verification — must happen before any business logic
        String clientIp = extractClientIp(httpRequest);
        if (!turnstileService.verify(req.turnstileToken(), clientIp)) {
            throw new ApiException(ErrorCode.SECURITY_VERIFICATION_FAILED, SECURITY_VERIFICATION_FAILED);
        }

        // 2. Account Lockout Check
        if (rateLimiterService.isAccountLocked(email)) {
            throw new ApiException(ErrorCode.ACCOUNT_LOCKED,
                "Too many failed login attempts. Your account is locked for 15 minutes.");
        }

        // 3. Database Lookup & Password Verification
        Optional<User> userOptional = userRepository.findByEmail(email);

        if (userOptional.isEmpty() || !passwordEncoder.matches(req.password(), userOptional.get().getPasswordHash())) {
            rateLimiterService.recordFailedLogin(email);
            int remaining = rateLimiterService.getRemainingAttempts(email);

            throw new ApiException(ErrorCode.INVALID_CREDENTIALS,
                "Invalid email or password. Remaining attempts before lockout: " + remaining);
        }

        // 4. Reset Fail Counters on Success
        User user = userOptional.get();
        rateLimiterService.recordSuccessfulLogin(email);

        // 5. Issue Token
        String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
        setAuthCookie(httpResponse, httpRequest, token);
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getOrgName()));
    }

    /**
     * "Continue with Google": logs in the account matching the verified Google email. When no account exists yet,
     * replies with needsOrgName so the client can ask for an organization name and call again with it.
     */
    @PostMapping("/google")
    public ResponseEntity<?> google(@Valid @RequestBody GoogleAuthRequest req,
                                    HttpServletRequest httpRequest,
                                    HttpServletResponse httpResponse) {
        GoogleAuthService.GoogleIdentity identity;
        try {
            identity = googleAuthService.verify(req.accessToken());
        } catch (GoogleAuthService.GoogleAuthException e) {
            // GoogleAuthException messages are fixed, user-facing texts.
            throw new ApiException(ErrorCode.AUTHENTICATION_FAILED, e.getMessage());
        }

        Optional<User> existing = userRepository.findByEmail(identity.email());
        if (existing.isPresent()) {
            User user = existing.get();
            String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
            setAuthCookie(httpResponse, httpRequest, token);
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
            .description(req.description() != null ? req.description().trim() : null)
            .fullName(req.fullName() != null ? req.fullName().trim() : null)
            .audience(req.audience() != null ? req.audience().trim() : null)
            .focusAreas(req.focusAreas() != null ? req.focusAreas().trim() : null)
            .languagePref(req.languagePref() != null ? req.languagePref().trim() : null)
            .officialHashtags(req.officialHashtags() != null ? req.officialHashtags().trim() : null)
            .captionAvoid(req.captionAvoid() != null ? req.captionAvoid().trim() : null)
            .tonePreference(User.TonePreference.FORMAL)
            .build();
        saveNewUser(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());
        setAuthCookie(httpResponse, httpRequest, token);
        return ResponseEntity.ok(new GoogleAuthResponse(token, user.getId(), user.getOrgName(), false, true, user.getEmail()));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        clearAuthCookie(httpResponse, httpRequest);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
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
        // /api/auth/** is public, so a request without a valid session arrives here with no user.
        AuthenticationRequiredException.requireAuthenticated(user);
        var connection = facebookOAuthService.buildConnectionDetails(user);
        return ResponseEntity.ok(new CurrentUserResponse(
            user.getId(),
            user.getOrgName(),
            connection.facebookConnected(),
            connection.facebookPageId(),
            connection.facebookPageName(),
            connection.facebookPagePictureUrl(),
            user.getDescription(),
            user.getFullName(),
            user.getAudience(),
            user.getFocusAreas(),
            user.getLanguagePref(),
            user.getOfficialHashtags(),
            user.getCaptionAvoid()
        ));
    }

    @PatchMapping("/profile")
    public ResponseEntity<CurrentUserResponse> updateProfile(@AuthenticationPrincipal User authUser,
                                                             @RequestBody UpdateUserProfileRequest req) {
        // Public prefix: without this, an anonymous call failed with a NullPointerException (500).
        AuthenticationRequiredException.requireAuthenticated(authUser);
        User user = userRepository.findById(authUser.getId()).orElse(authUser);
        if (req.orgName() != null && !req.orgName().isBlank()) {
            user.setOrgName(req.orgName().trim());
        }
        if (req.description() != null) {
            user.setDescription(req.description().trim());
        }
        if (req.fullName() != null) {
            user.setFullName(req.fullName().trim());
        }
        if (req.audience() != null) {
            user.setAudience(req.audience().trim());
        }
        if (req.focusAreas() != null) {
            user.setFocusAreas(req.focusAreas().trim());
        }
        if (req.languagePref() != null) {
            user.setLanguagePref(req.languagePref().trim());
        }
        if (req.officialHashtags() != null) {
            user.setOfficialHashtags(req.officialHashtags().trim());
        }
        if (req.captionAvoid() != null) {
            user.setCaptionAvoid(req.captionAvoid().trim());
        }
        userRepository.save(user);
        return me(user);
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
            // PasswordResetException messages are fixed, user-facing texts.
            throw new ApiException(ErrorCode.BAD_REQUEST, e.getMessage());
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
        @jakarta.validation.constraints.Size(min = 6, max = 72, message = "Password must be 6 to 72 characters.")
        String newPassword
    ) {}

    public record RegisterRequest(
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Email String email,
        @jakarta.validation.constraints.NotBlank String password,
        @jakarta.validation.constraints.NotBlank String orgName,
        @jakarta.validation.constraints.NotBlank String turnstileToken,
        String description,
        String fullName,
        String audience,
        String focusAreas,
        String languagePref,
        String officialHashtags,
        String captionAvoid
    ) {}

    public record LoginRequest(
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Email String email,
        @jakarta.validation.constraints.NotBlank String password,
        @jakarta.validation.constraints.NotBlank String turnstileToken
    ) {}

    public record GoogleAuthRequest(
        @jakarta.validation.constraints.NotBlank String accessToken,
        String orgName,
        String description,
        String fullName,
        String audience,
        String focusAreas,
        String languagePref,
        String officialHashtags,
        String captionAvoid
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
        String facebookPagePictureUrl,
        String description,
        String fullName,
        String audience,
        String focusAreas,
        String languagePref,
        String officialHashtags,
        String captionAvoid
    ) {}

    public record UpdateUserProfileRequest(
        String orgName,
        String description,
        String fullName,
        String audience,
        String focusAreas,
        String languagePref,
        String officialHashtags,
        String captionAvoid
    ) {}
}