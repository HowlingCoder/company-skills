import { Alert, Button, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

interface ErrorAlertProps {
  title: string;
  message: string;
  /** Shows a Retry button when set. */
  onRetry?: () => void;
}

/** Red inline message for a failed request, optionally with a Retry button. */
export function ErrorAlert({ title, message, onRetry }: ErrorAlertProps) {
  return (
    <Alert color="red" icon={<IconAlertCircle />} title={title}>
      <Text size="sm">{message}</Text>
      {onRetry && (
        <Button size="xs" variant="light" color="red" mt="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Alert>
  );
}
