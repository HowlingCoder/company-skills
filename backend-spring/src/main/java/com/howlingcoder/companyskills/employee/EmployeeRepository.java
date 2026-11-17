package com.howlingcoder.companyskills.employee;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeRepository extends JpaRepository<Employee, UUID>, JpaSpecificationExecutor<Employee> {
    /** One active employee with skills and their skill rows loaded in a single query. */
    @Query("""
            select e from Employee e
            left join fetch e.skillAssignments a
            left join fetch a.skill
            where e.id = :id and e.deletedAt is null
            """)
    Optional<Employee> findActiveWithSkills(@Param("id") UUID id);

    /** The active (not soft-deleted) employees among the given ids; unknown ids are left out. */
    List<Employee> findByIdInAndDeletedAtIsNull(Collection<UUID> ids);

    /** Employees by lowercase email, including soft-deleted ones: the import must not create a second row for their email. */
    @Query("select e from Employee e where lower(e.email) in :emails")
    List<Employee> findByLowerEmailIn(@Param("emails") Collection<String> emails);
}
