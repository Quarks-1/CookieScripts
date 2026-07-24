import { useEffect, useState } from "react";

import type { CatalogGroup, CatalogPickerRetailer, CatalogSet, CatalogSubgroup } from "@ext/core/types/index.ts";

import { CatalogProductRow } from "./CatalogProductRow.tsx";

type CatalogGroupSectionProps = {
  group: CatalogGroup;
  setIndex: Map<string, CatalogSet>;
  selectedSets: Record<CatalogPickerRetailer, ReadonlySet<string>>;
  activeQuery: string;
  disabled?: boolean;
  onSelectAll: (retailer: CatalogPickerRetailer) => void;
  onClearGroup: (retailer: CatalogPickerRetailer) => void;
  onToggleFirstParty: (
    retailer: CatalogPickerRetailer,
    rowIndex: string,
    cell: CatalogGroup["subgroups"][number]["rows"][number]["cells"][CatalogPickerRetailer],
  ) => void;
  onToggleMarketplace: (retailer: CatalogPickerRetailer, sku: string) => void;
};

function SubgroupHeaderRow({ label, first }: { label: string; first?: boolean }) {
  return (
    <tr>
      <th
        colSpan={3}
        scope="colgroup"
        className={`${first ? "pt-0" : "pt-3"} pb-1 text-left text-xs font-medium uppercase tracking-wide text-zinc-500`}
      >
        {label}
      </th>
    </tr>
  );
}

function SubgroupRows({
  subgroup,
  setIndex,
  selectedSets,
  disabled,
  first,
  onToggleFirstParty,
  onToggleMarketplace,
}: {
  subgroup: CatalogSubgroup;
  setIndex: Map<string, CatalogSet>;
  selectedSets: Record<CatalogPickerRetailer, ReadonlySet<string>>;
  disabled?: boolean;
  first?: boolean;
  onToggleFirstParty: CatalogGroupSectionProps["onToggleFirstParty"];
  onToggleMarketplace: CatalogGroupSectionProps["onToggleMarketplace"];
}) {
  return (
    <>
      <SubgroupHeaderRow label={subgroup.label} first={first} />
      {subgroup.rows.map((row) => (
        <CatalogProductRow
          key={row.product.id}
          row={row}
          setIndex={setIndex}
          selectedSets={selectedSets}
          disabled={disabled}
          onToggleFirstParty={(retailer) => onToggleFirstParty(retailer, row.product.id, row.cells[retailer])}
          onToggleMarketplace={onToggleMarketplace}
        />
      ))}
    </>
  );
}

export function CatalogGroupSection({
  group,
  setIndex,
  selectedSets,
  activeQuery,
  disabled,
  onSelectAll,
  onClearGroup,
  onToggleFirstParty,
  onToggleMarketplace,
}: CatalogGroupSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [alsoOpen, setAlsoOpen] = useState(false);

  useEffect(() => {
    if (activeQuery.trim()) {
      setExpanded(true);
    }
  }, [activeQuery]);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="font-medium text-zinc-200">{group.label}</span>
        <span className="text-xs text-zinc-500">{expanded ? "−" : "+"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-800 px-3 py-2">
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-400">
            <span>
              Target: {group.totals.target.selected} / {group.totals.target.available}
            </span>
            <span>
              Walmart: {group.totals.walmart.selected} / {group.totals.walmart.available}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap gap-4 text-xs">
            {(["target", "walmart"] as const).map((retailer) => {
              const label = retailer === "target" ? "Target" : "Walmart";
              const available = group.totals[retailer].available;
              return (
                <div key={retailer} className="flex items-center gap-2">
                  <span className="text-zinc-500">{label}:</span>
                  <button
                    type="button"
                    disabled={disabled || available === 0}
                    onClick={() => onSelectAll(retailer)}
                    className="text-sky-300 hover:underline disabled:opacity-50"
                  >
                    All ({available})
                  </button>
                  <span className="text-zinc-600">/</span>
                  <button
                    type="button"
                    disabled={disabled || group.totals[retailer].selected === 0}
                    onClick={() => onClearGroup(retailer)}
                    className="text-sky-300 hover:underline disabled:opacity-50"
                  >
                    None
                  </button>
                </div>
              );
            })}
          </div>

          <table className="catalog-product-table w-full text-sm">
            <colgroup>
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-1 pr-3 font-medium">Product</th>
                <th className="catalog-retailer-col pb-1 pr-3 font-medium">Target</th>
                <th className="catalog-retailer-col pb-1 font-medium">Walmart</th>
              </tr>
            </thead>
            <tbody>
              {group.subgroups.map((subgroup, index) => (
                <SubgroupRows
                  key={subgroup.id}
                  subgroup={subgroup}
                  setIndex={setIndex}
                  selectedSets={selectedSets}
                  disabled={disabled}
                  first={index === 0}
                  onToggleFirstParty={onToggleFirstParty}
                  onToggleMarketplace={onToggleMarketplace}
                />
              ))}

              {group.alsoContains.length > 0 ? (
                <>
                  <tr>
                    <td colSpan={3} className="pt-3">
                      <button
                        type="button"
                        className="text-xs text-zinc-400 hover:text-zinc-300"
                        aria-expanded={alsoOpen}
                        onClick={() => setAlsoOpen((current) => !current)}
                      >
                        Also contains
                      </button>
                    </td>
                  </tr>
                  {alsoOpen
                    ? group.alsoContains.map((subgroup) => (
                        <SubgroupRows
                          key={subgroup.id}
                          subgroup={subgroup}
                          setIndex={setIndex}
                          selectedSets={selectedSets}
                          disabled={disabled}
                          onToggleFirstParty={onToggleFirstParty}
                          onToggleMarketplace={onToggleMarketplace}
                        />
                      ))
                    : null}
                </>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
