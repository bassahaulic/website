// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "./page";

test("renders the application shell", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "HaulPilot Dispatch" })).toBeDefined();
});
