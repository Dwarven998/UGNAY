package com.ugnay.ugnay.post;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.util.List;
import java.util.Map;

import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.repository.query.parser.PartTree;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.media.MediaFolder;
import com.ugnay.ugnay.org.Organization;

/**
 * The page-scoped repository queries can't be exercised without Postgres, but a typo in a derived method name or
 * a JPQL string would only surface when the whole application boots. This checks both offline: derived names are
 * parsed against the entity model and the hand-written JPQL is compiled by Hibernate's query parser (no DB needed).
 */
class PageScopedRepositoryQueriesTest {

    private static SessionFactory sessionFactory;

    @BeforeAll
    static void buildMetamodelWithoutDatabase() {
        var registry = new StandardServiceRegistryBuilder()
            .applySettings(Map.of(
                "hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect",
                "hibernate.boot.allow_jdbc_metadata_access", "false",
                "hibernate.temp.use_jdbc_metadata_defaults", "false"))
            .build();
        sessionFactory = new MetadataSources(registry)
            .addAnnotatedClass(Post.class)
            .addAnnotatedClass(PostEngagement.class)
            .addAnnotatedClass(User.class)
            .addAnnotatedClass(Organization.class)
            .addAnnotatedClass(MediaAsset.class)
            .addAnnotatedClass(MediaFolder.class)
            .buildMetadata()
            .buildSessionFactory();
    }

    @AfterAll
    static void close() {
        if (sessionFactory != null) sessionFactory.close();
    }

    @Test
    void derivedPostQueriesResolveAgainstTheEntityModel() {
        List.of(
            "findByOrganization_IdAndFbPageIdOrderByCreatedAtDesc",
            "findByOrganization_IdAndFbPageIdIsNullOrderByCreatedAtDesc",
            "findByUserAndOrganizationIsNullAndFbPageIdOrderByCreatedAtDesc",
            "findByUserAndOrganizationIsNullAndFbPageIdIsNullOrderByCreatedAtDesc",
            "findByOrganization_IdAndFbPageIdAndStatusOrderByCreatedAtDesc",
            "findByOrganization_IdAndFbPageIdIsNullAndStatusOrderByCreatedAtDesc"
        ).forEach(name -> assertDoesNotThrow(() -> new PartTree(name, Post.class), name));
    }

    @Test
    void derivedFolderQueriesResolveAgainstTheEntityModel() {
        List.of(
            "findByOrganization_IdAndFbPageId",
            "findByOrganization_IdAndFbPageIdIsNull",
            "findByUserAndOrganizationIsNullAndFbPageId",
            "findByUserAndOrganizationIsNullAndFbPageIdIsNull"
        ).forEach(name -> assertDoesNotThrow(() -> new PartTree(name, MediaFolder.class), name));
    }

    @Test
    void handWrittenJpqlCompiles() {
        List.of(
            "select count(distinct p.id) as totalPosts, coalesce(sum(e.likes + e.comments + e.shares), 0) as totalEngagement "
                + "from Post p left join PostEngagement e on e.post = p where p.organization.id = :orgId and p.fbPageId = :pageId",
            "select count(distinct p.id) as totalPosts from Post p left join PostEngagement e on e.post = p "
                + "where p.user = :user and p.organization is null and p.fbPageId = :pageId",
            "update Post p set p.fbPageId = :pageId where p.organization.id = :orgId and p.fbPageId is null",
            "update Post p set p.fbPageId = :pageId where p.user = :user and p.organization is null and p.fbPageId is null",
            "update MediaFolder f set f.fbPageId = :pageId where f.organization.id = :orgId and f.fbPageId is null",
            "update MediaFolder f set f.fbPageId = :pageId where f.user = :user and f.organization is null and f.fbPageId is null",
            "select p from Post p left join fetch p.mediaAsset where p.organization.id = :orgId and p.fbPageId = :pageId "
                + "and p.status = com.ugnay.ugnay.post.Post.PostStatus.SCHEDULED and p.scheduledAt between :windowStart and :windowEnd "
                + "and (:excludePostId is null or p.id <> :excludePostId) order by p.scheduledAt asc",
            "select p from Post p left join fetch p.mediaAsset where p.user = :user and p.organization is null and p.fbPageId = :pageId "
                + "and p.status = com.ugnay.ugnay.post.Post.PostStatus.SCHEDULED and p.scheduledAt between :windowStart and :windowEnd "
                + "and (:excludePostId is null or p.id <> :excludePostId) order by p.scheduledAt asc"
        ).forEach(hql -> assertDoesNotThrow(() -> {
            try (var session = sessionFactory.openSession()) {
                if (hql.startsWith("update")) {
                    session.createMutationQuery(hql);
                } else {
                    session.createQuery(hql, Object.class);
                }
            }
        }, hql));
    }
}
