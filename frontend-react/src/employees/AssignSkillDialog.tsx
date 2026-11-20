import {
  Alert,
  Box,
  Button,
  Group,
  List,
  Modal,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "../api/http";
import type { Employee, Skill } from "../api/models";
import { bulkAssign } from "../api/skill-assignment-api";
import { ErrorAlert } from "../components/ErrorAlert";
import { LevelSelect } from "../skills/LevelSelect";
import { skillLabel } from "../skills/levels";
import { SkillPicker } from "../skills/SkillPicker";
import {
  assignNotification,
  conflictHeading,
  findConflicts,
} from "./dialog-messages";
import { fullName } from "./employee-name";
import { EMPLOYEES_KEY } from "./useEmployees";

interface AssignSkillDialogProps {
  employees: Employee[];
  onClose: () => void;
  /** The skill was assigned; the dialog is done. */
  onAssigned: () => void;
}

/** Assigns one skill with one level to all selected employees. */
export function AssignSkillDialog({
  employees,
  onClose,
  onAssigned,
}: AssignSkillDialogProps) {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [level, setLevel] = useState<number | null>(null);

  const conflicts = findConflicts(employees, skill?.id);

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: {
      skill: Skill;
      level: number;
      overwrite: boolean;
    }) =>
      bulkAssign(
        {
          employee_ids: employees.map((employee) => employee.id),
          skill_id: variables.skill.id,
          proficiency_level: variables.level,
        },
        variables.overwrite,
      ),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
      notifications.show(assignNotification(variables.skill.name, result));
      onAssigned();
    },
  });

  function submit(overwrite: boolean): void {
    if (skill && level !== null) mutation.mutate({ skill, level, overwrite });
  }

  const saving = mutation.isPending;
  // 404: an employee or the skill was deleted in the meantime; nothing was written
  const error = mutation.isError
    ? errorMessage(mutation.error, 404)
    : undefined;

  const canSubmit = skill !== null && level !== null && !saving;

  return (
    <Modal
      opened
      onClose={onClose}
      title="Assign skill"
      size="lg"
      // Escape must not throw away a choice that is not assigned yet
      closeOnEscape={false}
    >
      {error && (
        <ErrorAlert title="Skill could not be assigned" message={error} />
      )}

      <Box component="section" my="md">
        <Title order={5} id="assign-skill-employees" mb="xs">
          Selected employees ({employees.length})
        </Title>
        <Group
          component="ul"
          gap="xs"
          p={0}
          m={0}
          style={{ listStyle: "none" }}
          aria-labelledby="assign-skill-employees"
        >
          {employees.map((employee) => (
            <Text
              component="li"
              key={employee.id}
              size="sm"
              px="xs"
              bg="var(--mantine-color-default-hover)"
              style={{ borderRadius: 4 }}
            >
              {fullName(employee)}
            </Text>
          ))}
        </Group>
      </Box>

      <Box mb="md">
        {skill ? (
          <Group>
            <Text>
              <Text span fw={600} size="sm">
                Skill:
              </Text>{" "}
              {skillLabel(skill)}
            </Text>
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={() => setSkill(null)}
            >
              Change
            </Button>
          </Group>
        ) : (
          <SkillPicker
            id="assign-skill-skill"
            label="Skill"
            onSkillSelected={setSkill}
          />
        )}
      </Box>

      <LevelSelect value={level} onChange={setLevel} />

      {conflicts.length > 0 && (
        <Box component="section" mt="lg">
          <Alert
            color="yellow"
            icon={<IconAlertTriangle />}
            title={conflictHeading(conflicts.length)}
          >
            <Text size="sm">
              Keep their levels, or overwrite them with the level chosen above.
            </Text>
          </Alert>
          <List
            mt="sm"
            size="sm"
            aria-label="Employees who already have this skill"
          >
            {conflicts.map((conflict) => (
              <List.Item key={conflict.employeeId}>
                {conflict.name}: level {conflict.level}
              </List.Item>
            ))}
          </List>
        </Box>
      )}

      <Group justify="flex-end" mt="lg" data-dialog-footer>
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        {conflicts.length > 0 ? (
          <>
            {/* secondary: overwriting can also lower levels */}
            <Button
              variant="default"
              disabled={!canSubmit}
              loading={saving}
              onClick={() => submit(true)}
            >
              Overwrite levels
            </Button>
            <Button
              disabled={!canSubmit}
              loading={saving}
              onClick={() => submit(false)}
            >
              Keep existing levels
            </Button>
          </>
        ) : (
          <Button
            disabled={!canSubmit}
            loading={saving}
            onClick={() => submit(false)}
          >
            Assign
          </Button>
        )}
      </Group>
    </Modal>
  );
}
