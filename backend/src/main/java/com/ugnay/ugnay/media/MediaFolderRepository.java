package com.ugnay.ugnay.media;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ugnay.ugnay.core.User;

public interface MediaFolderRepository extends JpaRepository<MediaFolder, UUID> {
    List<MediaFolder> findByUser(User user);
}

