import {
  ActionIcon,
  AppShell,
  Container,
  Group,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { EmployeeOverview } from "./employees/EmployeeOverview";

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  // "auto" resolved to the actual scheme, so the label is always light or dark
  const isDark = useComputedColorScheme("light") === "dark";

  return (
    <ActionIcon
      variant="subtle"
      size="lg"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setColorScheme(isDark ? "light" : "dark")}
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </ActionIcon>
  );
}

function App() {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Company Skill Management (React)</Title>
          <ThemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl">
          <EmployeeOverview />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
