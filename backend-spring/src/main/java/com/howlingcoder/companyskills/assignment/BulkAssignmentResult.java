package com.howlingcoder.companyskills.assignment;

import java.util.List;
import java.util.UUID;

public record BulkAssignmentResult(List<UUID> created, List<UUID> updated, List<UUID> skipped) {
}
