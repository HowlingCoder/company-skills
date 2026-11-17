package com.howlingcoder.companyskills.assignment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface SkillAssignmentRepository
        extends JpaRepository<SkillAssignment, UUID>, JpaSpecificationExecutor<SkillAssignment> {

    List<SkillAssignment> findBySkillIdAndEmployeeIdIn(UUID skillId, Collection<UUID> employeeIds);
}