import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ImportReport } from "../../api/models";
import { renderWithProviders } from "../../test/render";
import { ImportReportView } from "../ImportReportView";

const success: ImportReport = {
  imported_count: 2,
  failed_count: 0,
  imported: [
    { lastname: "Muster", firstname: "Max", email: "max@example.com", age: 30 },
    { lastname: "Doe", firstname: "Jane", email: "jane@example.com", age: 41 },
  ],
  errors: [],
};

const partial: ImportReport = {
  ...success,
  failed_count: 2,
  errors: [
    { line: 3, message: "Age must be a number" },
    { line: 5, message: "E-Mail is missing" },
  ],
};

describe("ImportReportView", () => {
  it("shows nothing before an import", () => {
    renderWithProviders(<ImportReportView />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows nothing for a full success, which is reported as a toast", () => {
    renderWithProviders(<ImportReportView report={success} />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows why the whole file was rejected", () => {
    renderWithProviders(<ImportReportView fileError="Column Age is missing" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "File could not be imported",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Column Age is missing",
    );
  });

  it("counts imported rows against all rows of a partial import", () => {
    renderWithProviders(<ImportReportView report={partial} />);

    expect(screen.getByRole("alert")).toHaveTextContent("2 of 4 rows imported");
  });

  it("lists every rejected row with its line number", () => {
    renderWithProviders(<ImportReportView report={partial} />);

    const list = screen.getByRole("list", {
      name: "Rows that were not imported",
    });
    expect(list).toHaveTextContent("Line 3: Age must be a number");
    expect(list).toHaveTextContent("Line 5: E-Mail is missing");
  });
});
