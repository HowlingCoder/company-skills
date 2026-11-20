import { ActionIcon, Button, Group, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { setSkills } from "../api/employee-api";
import { errorMessage } from "../api/http";
import type { Employee, Skill } from "../api/models";
import { ErrorAlert } from "../components/ErrorAlert";
import { LevelSelect } from "../skills/LevelSelect";
import { skillLabel } from "../skills/levels";
import { SkillPicker } from "../skills/SkillPicker";
import {
  skillsSavedNotification,
  toSkillEntries,
  toSkillLevels,
} from "./dialog-messages";
import { fullName } from "./employee-name";
import { EMPLOYEES_KEY } from "./useEmployees";

interface SkillsDialogProps {
  employee: Employee;
  onClose: () => void;
}

/** Edits all skills of one employee and saves them as one full state. */
export function SkillsDialog({ employee, onClose }: SkillsDialogProps) {
  // the dialog is mounted on every open, so the rows start from the current employee
  const [entries, setEntries] = useState(() => toSkillEntries(employee));
  const listRef = useRef<HTMLUListElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const assignedIds = entries.map((entry) => entry.skillId);
  const canSave = entries.every((entry) => entry.level !== null);

  function add(skill: Skill): void {
    if (assignedIds.includes(skill.id)) return;
    setEntries((prev) => [
      ...prev,
      { skillId: skill.id, label: skillLabel(skill), level: null },
    ]);
  }

  function setLevel(skillId: string, level: number | null): void {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.skillId === skillId ? { ...entry, level } : entry,
      ),
    );
  }

  function remove(skillId: string): void {
    const index = entries.findIndex((entry) => entry.skillId === skillId);
    // render the removal right away, so the remaining buttons can be found below
    flushSync(() =>
      setEntries((prev) => prev.filter((entry) => entry.skillId !== skillId)),
    );
    // the clicked button is gone: go on with the row that took its place, else the one before
    const buttons =
      listRef.current?.querySelectorAll<HTMLButtonElement>(".remove-skill") ??
      [];
    const next = buttons[Math.min(index, buttons.length - 1)];
    if (next) next.focus();
    else pickerRef.current?.focus();
  }

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => setSkills(employee.id, toSkillLevels(entries)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
      notifications.show(skillsSavedNotification(employee));
      onClose();
    },
  });

  const saving = mutation.isPending;
  // 404: the employee or a skill was deleted in the meantime; the backend names it
  const error = mutation.isError
    ? errorMessage(mutation.error, 404)
    : undefined;

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Skills of ${fullName(employee)}`}
      size="lg"
      // Escape must not throw away unsaved changes
      closeOnEscape={false}
    >
      {error && (
        <ErrorAlert title="Skills could not be saved" message={error} />
      )}

      {entries.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "grid",
            gap: "var(--mantine-spacing-xs)",
          }}
          aria-label="Assigned skills"
          ref={listRef}
        >
          {entries.map((entry) => (
            <Group component="li" key={entry.skillId} wrap="nowrap">
              <Text flex={1}>{entry.label}</Text>
              <LevelSelect
                label={`Level of ${entry.label}`}
                value={entry.level}
                onChange={(level) => setLevel(entry.skillId, level)}
              />
              <ActionIcon
                className="remove-skill"
                variant="subtle"
                color="gray"
                aria-label={`Remove ${entry.label}`}
                onClick={() => remove(entry.skillId)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          ))}
        </ul>
      ) : (
        <Text c="dimmed" my="md">
          No skills assigned yet.
        </Text>
      )}
      <SkillPicker
        id="skills-dialog-add"
        label="Add skill"
        excludedSkillIds={assignedIds}
        ref={pickerRef}
        onSkillSelected={add}
      />

      <Group justify="flex-end" mt="lg" data-dialog-footer>
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!canSave}
          loading={saving}
          onClick={() => mutation.mutate()}
        >
          Save
        </Button>
      </Group>
    </Modal>
  );
}
