import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMenuService } from "./mock-service";

afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("mock menu category CRUD", () => {
  it("round-trips category modifier presets", async () => {
    vi.useFakeTimers();
    const created = await settle(mockMenuService.createCategory({
      venueId: "venue-1",
      name: "Test category",
      description: "Test",
      sortOrder: 99,
      isActive: true,
      modifierGroups: [{
        id: "group-1",
        name: "Washers",
        kind: "washer",
        required: true,
        maxSelections: 2,
        isActive: true,
        options: [{
          id: "option-1",
          name: "Red Bull",
          priceDelta: 6,
          maxQuantity: 4,
          isActive: true,
        }],
      }],
    }));

    const updated = await settle(mockMenuService.updateCategory(created.id, {
      description: "Updated",
    }));

    expect(updated?.modifierGroups[0].options[0].maxQuantity).toBe(4);
    expect(updated?.description).toBe("Updated");
  });

  it("rejects deletion while items reference the category", async () => {
    vi.useFakeTimers();
    const deletion = expect(mockMenuService.deleteCategory("cat-vodka")).rejects.toThrow(
      "Category still has menu items",
    );
    await vi.runAllTimersAsync();
    await deletion;
  });
});
