import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TagBadge from "./TagBadge";

describe("TagBadge", () => {
  it("renders tag name", () => {
    render(<TagBadge name="JavaScript" color="#f7df1e" />);
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("applies color styling", () => {
    render(<TagBadge name="Test" color="#ff0000" />);
    const badge = screen.getByText("Test").closest("span")!;
    expect(badge.style.color).toBe("rgb(255, 0, 0)");
    // backgroundColor is set with hex + alpha suffix (e.g. "#ff000026")
    // jsdom converts this to rgba format
    expect(badge.style.backgroundColor).toContain("255, 0, 0");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<TagBadge name="Click" color="#000" onClick={onClick} />);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("has cursor-pointer class when onClick provided", () => {
    const onClick = vi.fn();
    render(<TagBadge name="Pointer" color="#000" onClick={onClick} />);
    const badge = screen.getByText("Pointer").closest("span")!;
    expect(badge.className).toContain("cursor-pointer");
  });

  it("shows remove button when onRemove provided", () => {
    const onRemove = vi.fn();
    render(<TagBadge name="Remove" color="#000" onRemove={onRemove} />);
    const removeBtn = screen.getByRole("button");
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("does not show remove button when onRemove not provided", () => {
    render(<TagBadge name="NoRemove" color="#000" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stops propagation when remove button is clicked", () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <TagBadge name="Both" color="#000" onClick={onClick} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledOnce();
    // onClick should not fire because stopPropagation is called
    expect(onClick).not.toHaveBeenCalled();
  });
});
