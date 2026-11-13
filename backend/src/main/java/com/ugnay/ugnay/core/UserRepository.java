package com.ugnay.ugnay.core;


import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    /** Emails are stored as typed at sign-up, so look-ups from user input must ignore case. */
    Optional<User> findFirstByEmailIgnoreCase(String email);
    boolean existsByEmail(String email);
}