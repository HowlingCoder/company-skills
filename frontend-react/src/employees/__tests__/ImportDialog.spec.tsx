import { notifications } from "@mantine/notifications";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importEmployees } from "../../api/employee-api";
import { HttpError } from "../../api/http";
import type { ImportReport } from "../../api/models";
import { footerButtons } from "../../test/dialogs";
import { renderWithProviders } from "../../test/render";
import { ImportDialog } from "../ImportDialog";
import { EMPLOYEES_KEY } from "../useEmployees";

vi.mock("../../api/employee-api");
vi.mock("@mantine/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mantine/notifications")>()),
  notifications: { show: vi.fn() },
}));

const file = new File(["Lastname,Firstname,E-Mail,Age\n"], "staff.csv", {
  type: "text/csv",
});

function report(
  imported: number,
  errors: { line: number; message: string }[] = [],
): ImportReport {
  return {
    imported_count: imported,
    failed_count: errors.length,
    imported: [],
    errors,
  };
}

function render() {
  const onClose = vi.fn();
  const result = renderWithProviders(<ImportDialog onClose={onClose} />);
  const invalidate = vi.spyOn(result.queryClient, "invalidateQueries");
  return { onClose, invalidate };
}

function fileInput(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

async function upload(chosen: File = file): Promise<void> {
  await userEvent.upload(fileInput(), chosen);
}

describe("ImportDialog", () => {
  beforeEach(() => {
    vi.mocked(importEmployees).mockReset();
    vi.mocked(notifications.show).mockReset();
  });

  it("accepts CSV files", () => {
    render();

    expect(fileInput()).toHaveAttribute("accept", ".csv");
  });

  it("uploads the chosen file at once", async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(2));
    render();

    await upload();

    await waitFor(() => expect(importEmployees).toHaveBeenCalledOnce());
    expect(vi.mocked(importEmployees).mock.calls[0]![0]).toBe(file);
  });

  it("closes with a success toast and reloads the table when every row was imported", async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(2));
    const { onClose, invalidate } = render();

    await upload();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "green",
        title: "Employees imported",
        message: "2 employees imported.",
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: EMPLOYEES_KEY });
  });

  it("stays open, reloads the table and lists every failed row after a partial import", async () => {
    vi.mocked(importEmployees).mockResolvedValue(
      report(1, [
        { line: 3, message: "Age must be a number" },
        { line: 5, message: "E-Mail is missing" },
      ]),
    );
    const { onClose, invalidate } = render();

    await upload();

    const list = await screen.findByRole("list", {
      name: "Rows that were not imported",
    });
    expect(list).toHaveTextContent("Line 3: Age must be a number");
    expect(list).toHaveTextContent("Line 5: E-Mail is missing");
    expect(screen.getByText("1 of 3 rows imported")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: EMPLOYEES_KEY });
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: "yellow", title: "Import incomplete" }),
    );
  });

  it("shows the reason from the backend when the file is rejected", async () => {
    vi.mocked(importEmployees).mockRejectedValue(
      new HttpError("x", 400, "Missing column Age"),
    );
    const { onClose, invalidate } = render();

    await upload();

    expect(
      await screen.findByText("File could not be imported"),
    ).toBeInTheDocument();
    expect(screen.getByText("Missing column Age")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("shows a generic message when the server fails", async () => {
    vi.mocked(importEmployees).mockRejectedValue(
      new HttpError("x", 500, "Traceback"),
    );
    render();

    await upload();

    expect(
      await screen.findByText(
        "The server did not answer as expected. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Traceback")).toBeNull();
  });

  it("clears an old result when a file is chosen again, even the same one", async () => {
    vi.mocked(importEmployees).mockRejectedValueOnce(
      new HttpError("x", 400, "Missing column"),
    );
    render();
    await upload();
    await screen.findByText("File could not be imported");

    vi.mocked(importEmployees).mockReturnValueOnce(new Promise(() => {}));
    await upload();

    await waitFor(() =>
      expect(screen.queryByText("File could not be imported")).toBeNull(),
    );
  });

  it("closes without an upload on cancel", async () => {
    const { onClose } = render();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(importEmployees).not.toHaveBeenCalled();
  });

  it('offers "Close" instead of "Cancel" once rows were imported', async () => {
    vi.mocked(importEmployees).mockResolvedValue(
      report(1, [{ line: 2, message: "x" }]),
    );
    render();

    await upload();

    await waitFor(() => expect(footerButtons()).toEqual(["Close"]));
  });

  it("tells the user when the file has a header but no employees", async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(0));
    render();

    await upload();

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ color: "blue", title: "Nothing to import" }),
      ),
    );
  });

  it("can be left with Escape", async () => {
    const { onClose } = render();

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
