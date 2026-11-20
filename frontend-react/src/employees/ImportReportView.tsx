import { Alert, List, Text } from "@mantine/core";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import type { ImportReport } from "../api/models";

interface ImportReportViewProps {
  /** The whole file was rejected, e.g. a missing column. */
  fileError?: string;
  /** Answer of a finished import; only rows with errors are shown here. */
  report?: ImportReport;
}

/** Result of a CSV import inside the import dialog; a full success is shown as a toast instead. */
export function ImportReportView({ fileError, report }: ImportReportViewProps) {
  if (fileError) {
    return (
      <Alert
        color="red"
        icon={<IconAlertCircle />}
        title="File could not be imported"
        mt="md"
      >
        <Text size="sm">{fileError}</Text>
      </Alert>
    );
  }

  if (!report || report.errors.length === 0) {
    return null;
  }

  const total = report.imported_count + report.errors.length;
  return (
    <>
      <Alert
        color="yellow"
        icon={<IconAlertTriangle />}
        title={`${report.imported_count} of ${total} rows imported`}
        mt="md"
      >
        <Text size="sm">Correct the rows below and import the file again.</Text>
      </Alert>
      <List mt="sm" size="sm" aria-label="Rows that were not imported">
        {report.errors.map((rowError) => (
          <List.Item key={rowError.line}>
            Line {rowError.line}: {rowError.message}
          </List.Item>
        ))}
      </List>
    </>
  );
}
