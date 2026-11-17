package com.howlingcoder.companyskills.skill;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface SkillRepository extends JpaRepository<Skill, UUID> {

    /**
     * Active skills whose name or alias contains {@code q}, ignoring case, sorted by name.
     * An empty {@code q} matches every skill. {@code %}, {@code _} and {@code \\} in {@code q}
     * must be escaped by the caller (see {@code EscapeCharacter}), the query uses {@code \\}
     * as escape character.
     */
    @Query("""
            select s from Skill s
            where s.deletedAt is null
              and (lower(s.name) like lower(concat('%', :q, '%')) escape '\\'
                   or lower(s.alias) like lower(concat('%', :q, '%')) escape '\\')
            order by lower(s.name)
            """)
    List<Skill> search(@Param("q") String q);

    /**
     * The active (not soft-deleted) skills among the given ids; unknown ids are left out.
     */
    List<Skill> findByIdInAndDeletedAtIsNull(Collection<UUID> ids);
}
