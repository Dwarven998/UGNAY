package com.ugnay.ugnay.auth;


import com.ugnay.ugnay.core.*;
import com.ugnay.ugnay.facebook.FacebookOAuthService;
import lombok.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final FacebookOAuthService facebookOAuthService;

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
        return userRepository.findByEmail(req.email())
            .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
            .map(u -> {
                String token = jwtUtil.generateToken(u.getEmail(), u.getId().toString());
                return ResponseEntity.ok(new AuthResponse(token, u.getId(), u.getOrgName()));
            })
            .orElse(ResponseEntity.status(401).build());
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

    // --- DTOs (inner records for brevity) ---
    public record RegisterRequest(
        @jakarta.validation.constraints.Email String email,
        @jakarta.validation.constraints.NotBlank String password,
        @jakarta.validation.constraints.NotBlank String orgName
    ) {}

    public record LoginRequest(String email, String password) {}

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