package com.ugnay.ugnay.auth;

import com.ugnay.ugnay.core.*;
import com.ugnay.ugnay.facebook.FacebookOAuthService;
import lombok.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
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

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest().body("Email already registered");
        }
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
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        String email = req.email();

        // 1. Account Lockout Check
        if (rateLimiterService.isAccountLocked(email)) {
            return ResponseEntity.status(HttpStatus.LOCKED).body(Map.of(
                "error", "Account Locked",
                "message", "Too many failed login attempts. Your account is locked for 15 minutes."
            ));
        }

        // 2. Database Lookup & Password Verification
        Optional<User> userOptional = userRepository.findByEmail(email);

        if (userOptional.isEmpty() || !passwordEncoder.matches(req.password(), userOptional.get().getPasswordHash())) {
            rateLimiterService.recordFailedLogin(email);
            int remaining = rateLimiterService.getRemainingAttempts(email);

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "error", "Invalid Credentials",
                "message", "Invalid email or password. Remaining attempts before lockout: " + remaining
            ));
        }

        // 3. Reset Fail Counters on Success
        User user = userOptional.get();
        rateLimiterService.recordSuccessfulLogin(email);

        // 4. Issue Token
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

    // --- DTOs (inner records) ---
    public record RegisterRequest(
        @jakarta.validation.constraints.Email String email,
        @jakarta.validation.constraints.NotBlank String password,
        @jakarta.validation.constraints.NotBlank String orgName
    ) {}

    public record LoginRequest(
        @jakarta.validation.constraints.Email String email,
        @jakarta.validation.constraints.NotBlank String password
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