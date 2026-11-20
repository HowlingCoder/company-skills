import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * render() with the providers the app has in main.tsx. Every call gets its own QueryClient,
 * so no cached answer leaks from one test into the next; it is returned for tests that
 * invalidate queries themselves.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  // no retries: a failing request should show its error at once, not after three attempts
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Providers({ children }: { children: ReactNode }) {
    return (
      // env="test" turns off transitions and portals, as the Mantine testing guide recommends
      <MantineProvider env="test">
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </MantineProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Providers, ...options }) };
}
