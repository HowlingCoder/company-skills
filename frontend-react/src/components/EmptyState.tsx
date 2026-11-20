import { Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  content: string;
  /** Optional action below the text, e.g. a button. */
  children?: ReactNode;
}

/** Placeholder for a list without entries, with an optional action below the text. */
export function EmptyState({
  icon,
  heading,
  content,
  children,
}: EmptyStateProps) {
  return (
    <Stack align="center" gap="sm" py="xl">
      <ThemeIcon variant="light" size={64} radius="xl">
        {icon}
      </ThemeIcon>
      <Title order={4}>{heading}</Title>
      <Text c="dimmed" ta="center" maw={480}>
        {content}
      </Text>
      {children}
    </Stack>
  );
}
