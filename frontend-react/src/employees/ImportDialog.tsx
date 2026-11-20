import { Button, FileInput, Group, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { importEmployees } from "../api/employee-api";
import { errorMessage } from "../api/http";
import { importNotification } from "./dialog-messages";
import { ImportReportView } from "./ImportReportView";
import { EMPLOYEES_KEY } from "./useEmployees";

interface ImportDialogProps {
  onClose: () => void;
}

/** Uploads a CSV file; stays open after a partial import to show the failed rows. */
export function ImportDialog({ onClose }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: importEmployees,
    onSuccess: (report) => {
      void queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
      notifications.show(importNotification(report));
      // after a partial import the dialog stays open and lists the failed rows
      if (report.failed_count === 0) onClose();
    },
  });

  const uploading = mutation.isPending;
  const report = mutation.data;
  // 400: the backend explains what is wrong with the file
  const fileError = mutation.isError
    ? errorMessage(mutation.error, 400)
    : undefined;
  const imported = (report?.imported_count ?? 0) > 0;

  // empties the file field, so the same file (fixed in the meantime) can be chosen again
  const resetFileInput = useRef<() => void>(null);

  return (
    <Modal opened onClose={onClose} title="Import employees" size="lg">
      <Text size="sm" mb="md">
        CSV file with the columns Lastname, Firstname, E-Mail and Age. Employees
        that already exist are updated by their e-mail address.
      </Text>

      <FileInput
        label="CSV file"
        placeholder="Choose CSV file"
        accept=".csv"
        leftSection={<IconUpload size={16} />}
        disabled={uploading}
        // always empty: a chosen file is uploaded at once
        value={null}
        resetRef={resetFileInput}
        onChange={(file) => {
          if (file) mutation.mutate(file);
          resetFileInput.current?.();
        }}
      />

      <ImportReportView fileError={fileError} report={report} />

      <Group justify="flex-end" mt="lg" data-dialog-footer>
        <Button variant="default" onClick={onClose}>
          {imported ? "Close" : "Cancel"}
        </Button>
      </Group>
    </Modal>
  );
}
