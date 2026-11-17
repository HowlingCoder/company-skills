package com.howlingcoder.companyskills.employee;

import com.howlingcoder.companyskills.assignment.SkillAssignment;
import com.howlingcoder.companyskills.skill.Skill;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.query.EscapeCharacter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Building blocks for the employee search, combined in {@code EmployeeController}.
 */
public final class EmployeeSpecifications {
    // Escape character of the LIKE patterns; matches EscapeCharacter.DEFAULT
    private static final char LIKE_ESCAPE = '\\';

    private EmployeeSpecifications() {
    }

    /**
     * Employees that are not soft-deleted.
     */
    public static Specification<Employee> active() {
        return (root, query, cb) -> cb.isNull(root.get("deletedAt"));
    }

    /**
     * The word is a substring of firstname, lastname or email, ignoring case.
     */
    public static Specification<Employee> containsWord(String word) {
        String pattern = "%" + EscapeCharacter.DEFAULT.escape(word.toLowerCase(Locale.ROOT)) + "%";

        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("firstname")), pattern, LIKE_ESCAPE),
                cb.like(cb.lower(root.get("lastname")), pattern, LIKE_ESCAPE),
                cb.like(cb.lower(root.get("email")), pattern, LIKE_ESCAPE));
    }

    /**
     * Loads the skills together with the employees (one query) and sorts by lastname, then firstname.
     */
    public static Specification<Employee> withSkillsSortedByName() {
        return (root, query, cb) -> {
            root.fetch("skillAssignments", JoinType.LEFT)
                    .fetch("skill", JoinType.LEFT);

            query.orderBy(cb.asc(cb.lower(root.get("lastname"))),
                    cb.asc(cb.lower(root.get("firstname"))));

            return cb.conjunction();
        };
    }

    /**
     * Condition on a skill assignment: the skill is active, matches one of the terms by name or alias
     * (only {@code *} is a wildcard) and the level is at least minLevel. Empty terms / null minLevel skip that part.
     */
    static Predicate assignmentMatches(CriteriaBuilder cb, From<?, SkillAssignment> assignment,
                                       List<String> terms, Integer minLevel) {
        Join<SkillAssignment, Skill> skill = assignment.join("skill");

        List<Predicate> conditions = new ArrayList<>();
        conditions.add(cb.isNull(skill.get("deletedAt")));

        if (!terms.isEmpty()) {
            Predicate[] termMatches = terms.stream()
                    .map(term -> {
                        // Escape first, then turn the user's * into the LIKE wildcard
                        String pattern = EscapeCharacter.DEFAULT
                                .escape(term.strip().toLowerCase(Locale.ROOT))
                                .replace("*", "%");
                        return cb.or(
                                cb.like(cb.lower(skill.get("name")), pattern, LIKE_ESCAPE),
                                cb.like(cb.lower(skill.get("alias")), pattern, LIKE_ESCAPE));
                    })
                    .toArray(Predicate[]::new);
            conditions.add(cb.or(termMatches));
        }

        if (minLevel != null) {
            conditions.add(cb.greaterThanOrEqualTo(assignment.get("proficiencyLevel"), minLevel));
        }

        return cb.and(conditions.toArray(Predicate[]::new));
    }

    /**
     * The employee has at least one assignment that matches (an EXISTS subquery, so rows are not multiplied).
     */
    static Specification<Employee> hasMatchingAssignment(List<String> terms, Integer minLevel) {
        return (root, query, cb) -> {
            Subquery<UUID> sub = query.subquery(UUID.class);
            Root<SkillAssignment> assignment = sub.from(SkillAssignment.class);
            sub.select(assignment.get("id"))
                    .where(cb.equal(assignment.get("employee"), root),
                            assignmentMatches(cb, assignment, terms, minLevel));
            return cb.exists(sub);
        };
    }
}
