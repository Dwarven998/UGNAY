package com.ugnay.ugnay.profile;

import com.ugnay.ugnay.auth.PasswordResetService;
import com.ugnay.ugnay.auth.PasswordResetService.PasswordChangeException;
import com.ugnay.ugnay.core.AuthCookieWriter;
import com.ugnay.ugnay.core.JwtUtil;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.error.ApiException;
import com.ugnay.ugnay.core.error.ErrorCode;
import com.ugnay.ugnay.core.error.ExternalServiceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * The signed-in user's own Profile. Requires authentication (not under /api/auth/**). Every endpoint acts
 * only on the authenticated principal — there is no user id in any path or body, so one user can never
 * read or change another user's profile.
 */
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;
    private final PasswordResetService passwordService;
    private final JwtUtil jwtUtil;
    private final AuthCookieWriter authCookieWriter;

    @GetMapping
    public ResponseEntity<ProfileService.ProfileDto> me(@AuthenticationPrincipal User user) {
        // Personal data: never store it in a shared or browser cache.
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore().cachePrivate())
            .body(profileService.load(user.getId()));
    }

    /**
     * Changes the password after checking the current one. All other sessions are signed out; this one
     * receives a fresh session cookie so the user stays signed in here.
     */
    @PostMapping("/password")
    public ResponseEntity<?> changePassword(@AuthenticationPrincipal User user,
                                            @Valid @RequestBody ChangePasswordRequest req,
                                            HttpServletRequest httpRequest,
                                            HttpServletResponse httpResponse) {
        try {
            passwordService.changePassword(user.getId(), req.currentPassword(), req.newPassword());
        } catch (PasswordChangeException e) {
            // 400/423, never 401: the client treats 401 as "signed out" and would drop the session.
            throw new ApiException(e.getReason() == PasswordChangeException.Reason.LOCKED
                ? ErrorCode.ACCOUNT_LOCKED : ErrorCode.BAD_REQUEST, e.getMessage());
        }
        authCookieWriter.set(httpResponse, httpRequest, jwtUtil.generateToken(user.getEmail(), user.getId().toString()));
        return ResponseEntity.ok(Map.of(
            "message", "Password updated. Other devices signed in to this account have been signed out."));
    }

    /** Emails a reset link to the signed-in user's own address (for accounts without a known password). */
    @PostMapping("/password/reset-link")
    public ResponseEntity<?> sendResetLink(@AuthenticationPrincipal User user) {
        try {
            passwordService.requestPasswordResetForSignedInUser(user.getId());
        } catch (PasswordResetService.EmailDeliveryException e) {
            throw new ExternalServiceException(ExternalServiceException.Service.EMAIL,
                ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE, e.getMessage());
        }
        return ResponseEntity.ok(Map.of(
            "message", "We sent a password reset link to your email. It expires in 30 minutes."));
    }

    // Validation failures ("New password must be 6 to 72 characters.") are answered by GlobalExceptionHandler,
    // which returns the constraint's own message as "message".

    public record ChangePasswordRequest(
        @NotBlank(message = "Enter your current password.")
        @Size(max = 72, message = "Current password is incorrect.")
        String currentPassword,
        @NotBlank(message = "Enter a new password.")
        @Size(min = 6, max = 72, message = "New password must be 6 to 72 characters.")
        String newPassword
    ) {}
}
