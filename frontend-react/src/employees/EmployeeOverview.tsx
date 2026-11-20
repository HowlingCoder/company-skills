import {
  ActionIcon,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Table,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { IconEdit, IconSearch, IconUsers } from "@tabler/icons-react";
import { useState } from "react";
import { UNEXPECTED_ERROR } from "../api/http";
import type { Employee } from "../api/models";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { AssignSkillDialog } from "./AssignSkillDialog";
import { EmployeeFilters } from "./EmployeeFilters";
import {
  type ActiveFilter,
  EMPTY_FILTER,
  isFilterActive,
  noMatchText,
} from "./employee-filter-url";
import { fullName } from "./employee-name";
import { ImportDialog } from "./ImportDialog";
import { SkillBadges } from "./SkillBadges";
import { SkillsDialog } from "./SkillsDialog";
import { useEmployees } from "./useEmployees";
import { useUrlFilter } from "./useUrlFilter";

/** Which dialog is open, with the data it needs; null: none. */
type OpenDialog =
  | { kind: "import" }
  | { kind: "skills"; employee: Employee }
  | { kind: "assign"; employees: Employee[] }
  | null;

export function EmployeeOverview() {
  const [filter, setFilter] = useUrlFilter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // the ticked rows belong to the old search
  const applyFilter = (next: ActiveFilter) => {
    setFilter(next);
    setSelectedIds(new Set());
  };

  const [dialog, setDialog] = useState<OpenDialog>(null);
  const closeDialog = () => setDialog(null);

  const { data, status, refetch } = useEmployees(filter);

  const employees = data ?? [];
  const selectedEmployees = employees.filter((e) => selectedIds.has(e.id));
  const selectedCount = selectedEmployees.length;
  const allSelected =
    employees.length > 0 && selectedCount === employees.length;
  const someSelected = selectedCount > 0 && !allSelected;

  function toggle(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (status === "pending") {
    return (
      <Center py="xl">
        <Loader aria-label="Loading employees" />
      </Center>
    );
  }

  if (status === "error") {
    return (
      <ErrorAlert
        title="Employees could not be loaded"
        message={UNEXPECTED_ERROR}
        onRetry={refetch}
      />
    );
  }

  const assignButton = (
    <Button
      variant="default"
      disabled={selectedCount === 0}
      title={selectedCount ? undefined : "Select employees in the table first"}
      onClick={() =>
        setDialog({ kind: "assign", employees: selectedEmployees })
      }
    >
      Assign skill{selectedCount ? ` (${selectedCount})` : ""}
    </Button>
  );

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Employees</Title>
        <Group>
          {assignButton}
          <Button onClick={() => setDialog({ kind: "import" })}>
            Import CSV
          </Button>
        </Group>
      </Group>

      <EmployeeFilters filter={filter} onChange={applyFilter} />

      {employees.length === 0 && isFilterActive(filter) ? (
        <EmptyState
          icon={<IconSearch size={32} />}
          heading="No employees match"
          content={noMatchText(filter)}
        >
          <Button variant="default" onClick={() => applyFilter(EMPTY_FILTER)}>
            Reset filters
          </Button>
        </EmptyState>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={32} />}
          heading="No employees yet"
          content="Import a CSV file to add employees."
        >
          <Button
            variant="default"
            onClick={() => setDialog({ kind: "import" })}
          >
            Import CSV
          </Button>
        </EmptyState>
      ) : (
        <>
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox
                      aria-label="Select all employees"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={() =>
                        setSelectedIds(
                          allSelected
                            ? new Set()
                            : new Set(employees.map((e) => e.id)),
                        )
                      }
                    />
                  </Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Age</Table.Th>
                  <Table.Th>Skills</Table.Th>
                  <Table.Th w={56}>
                    <VisuallyHidden>Actions</VisuallyHidden>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {employees.map((employee) => {
                  const name = fullName(employee);
                  const selected = selectedIds.has(employee.id);
                  return (
                    <Table.Tr
                      key={employee.id}
                      bg={
                        selected
                          ? "var(--mantine-primary-color-light)"
                          : undefined
                      }
                    >
                      <Table.Td>
                        <Checkbox
                          aria-label={`Select ${name}`}
                          checked={selected}
                          onChange={() => toggle(employee.id)}
                        />
                      </Table.Td>
                      <Table.Td>{name}</Table.Td>
                      <Table.Td>{employee.email}</Table.Td>
                      <Table.Td>{employee.age}</Table.Td>
                      <Table.Td>
                        <SkillBadges skills={employee.skills} />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          aria-label={`Manage skills of ${name}`}
                          onClick={() =>
                            setDialog({ kind: "skills", employee })
                          }
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {selectedCount > 0 && (
            // second button after the table, so keyboard users need not tab back through all rows
            <Group mt="lg">
              <Text>{selectedCount} selected</Text>
              {assignButton}
            </Group>
          )}
        </>
      )}

      {/* mounted only while open: every open starts with fresh state, no reset needed */}
      {dialog?.kind === "import" && <ImportDialog onClose={closeDialog} />}
      {dialog?.kind === "skills" && (
        <SkillsDialog employee={dialog.employee} onClose={closeDialog} />
      )}
      {dialog?.kind === "assign" && (
        <AssignSkillDialog
          employees={dialog.employees}
          onClose={closeDialog}
          onAssigned={() => {
            setSelectedIds(new Set());
            closeDialog();
          }}
        />
      )}
    </>
  );
}
