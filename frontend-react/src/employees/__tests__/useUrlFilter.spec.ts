import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTER } from "../employee-filter-url";
import { useUrlFilter } from "../useUrlFilter";

function withUrl(query: string) {
  window.history.replaceState(null, "", `/${query}`);
  return renderHook(() => useUrlFilter());
}

describe("useUrlFilter", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("reads the filter from the URL", () => {
    const { result } = withUrl("?q=mus&min_level=2");

    expect(result.current[0]).toEqual({
      ...EMPTY_FILTER,
      q: "mus",
      minLevel: 2,
    });
  });

  it("writes a new filter to the URL without a history entry", () => {
    const { result } = withUrl("");
    const entries = window.history.length;

    act(() =>
      result.current[1]({
        ...EMPTY_FILTER,
        skills: ["python", "go"],
        skillMatch: "or",
      }),
    );

    expect(window.location.search).toBe(
      "?skills=python&skills=go&skill_match=or",
    );
    expect(window.history.length).toBe(entries);
    expect(result.current[0].skills).toEqual(["python", "go"]);
  });

  it("keeps the filter the URL can hold, e.g. trimmed text", () => {
    const { result } = withUrl("");

    act(() => result.current[1]({ ...EMPTY_FILTER, q: "  max  " }));

    expect(result.current[0].q).toBe("max");
  });

  it("leaves a clean URL for the empty filter", () => {
    const { result } = withUrl("?q=max");

    act(() => result.current[1](EMPTY_FILTER));

    expect(window.location.search).toBe("");
    expect(result.current[0]).toEqual(EMPTY_FILTER);
  });

  it("follows the URL on back and forward", () => {
    const { result } = withUrl("");

    act(() => {
      window.history.replaceState(null, "", "/?q=anna");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current[0].q).toBe("anna");
  });

  it("removes its popstate listener when the component is gone", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = withUrl("");
    const listener = add.mock.calls.find(([type]) => type === "popstate")?.[1];

    unmount();

    expect(listener).toBeDefined();
    expect(remove).toHaveBeenCalledWith("popstate", listener);
  });
});
