import { describe, expect, it } from "vitest";

import { MAX_SKUS_PER_LIST } from "@ext/core/lib/constants.ts";
import { normalizeTargetSku } from "@ext/domains/target/lib/sku-watch.ts";
import { mergePastedPillItems } from "@shared/lib/merge-pasted-pill-items.ts";

const SKU_A = "95120834";
const SKU_B = "94860231";
const SKU_C = "94712345";

describe("mergePastedPillItems", () => {
  it("returns null when pasted text has no separator", () => {
    expect(mergePastedPillItems([], SKU_A, normalizeTargetSku)).toBeNull();
  });

  it("merges comma-separated SKUs", () => {
    expect(mergePastedPillItems([], `${SKU_A},${SKU_B}`, normalizeTargetSku)).toEqual([
      SKU_A,
      SKU_B,
    ]);
  });

  it("tolerates whitespace around comma separators", () => {
    expect(mergePastedPillItems([], `${SKU_A}, ${SKU_B}`, normalizeTargetSku)).toEqual([
      SKU_A,
      SKU_B,
    ]);
  });

  it("merges newline-separated SKUs", () => {
    expect(mergePastedPillItems([], `${SKU_A}\n${SKU_B}`, normalizeTargetSku)).toEqual([
      SKU_A,
      SKU_B,
    ]);
  });

  it("merges tab-separated SKUs", () => {
    expect(mergePastedPillItems([], `${SKU_A}\t${SKU_B}`, normalizeTargetSku)).toEqual([
      SKU_A,
      SKU_B,
    ]);
  });

  it("dedupes within the pasted batch", () => {
    expect(
      mergePastedPillItems([], `${SKU_A},${SKU_A},${SKU_B}`, normalizeTargetSku),
    ).toEqual([SKU_A, SKU_B]);
  });

  it("skips duplicates against existing items", () => {
    expect(
      mergePastedPillItems([SKU_A], `${SKU_A},${SKU_B}`, normalizeTargetSku),
    ).toEqual([SKU_A, SKU_B]);
  });

  it("skips invalid segments", () => {
    expect(
      mergePastedPillItems([], `abc,12345,${SKU_A}`, normalizeTargetSku),
    ).toEqual([SKU_A]);
  });

  it("skips empty segments from consecutive separators", () => {
    expect(
      mergePastedPillItems([], `${SKU_A},,${SKU_B}`, normalizeTargetSku),
    ).toEqual([SKU_A, SKU_B]);
  });

  it("returns unchanged list for all-invalid pasted segments", () => {
    expect(mergePastedPillItems([], "1,2,3", normalizeTargetSku)).toEqual([]);
  });

  it("auto-commits a single SKU with trailing newline", () => {
    expect(mergePastedPillItems([], `${SKU_A}\n`, normalizeTargetSku)).toEqual([SKU_A]);
  });

  it("truncates at maxItems", () => {
    const existing = Array.from({ length: MAX_SKUS_PER_LIST - 1 }, (_, index) =>
      String(9_000_000_00 + index),
    );
    const merged = mergePastedPillItems(
      existing,
      `${SKU_A},${SKU_B}`,
      normalizeTargetSku,
      MAX_SKUS_PER_LIST,
    );

    expect(merged).toHaveLength(MAX_SKUS_PER_LIST);
    expect(merged).toContain(SKU_A);
    expect(merged).not.toContain(SKU_B);
  });

  it("preserves existing order and appends new SKUs in paste order", () => {
    expect(
      mergePastedPillItems([SKU_C], `${SKU_A},${SKU_B}`, normalizeTargetSku),
    ).toEqual([SKU_C, SKU_A, SKU_B]);
  });
});
