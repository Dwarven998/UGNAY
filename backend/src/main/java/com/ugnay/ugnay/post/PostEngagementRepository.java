package com.ugnay.ugnay.post;

import com.ugnay.ugnay.core.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PostEngagementRepository extends JpaRepository<PostEngagement, UUID> {

    List<PostEngagement> findByPost_User(User user);

    @Query("SELECT e FROM PostEngagement e WHERE e.post.user = :user ORDER BY (e.likes + e.comments + e.shares) DESC")
    List<PostEngagement> findByPost_UserOrderByTotalEngagementDesc(User user);
}