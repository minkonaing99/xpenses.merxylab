import type { Account, Category, TxnType } from "../../api/types";
import { Segmented } from "../../ui/Segmented";
import type { LedgerFilters, LedgerListFilter } from "./ledgerFilters";

type Filter = "all" | TxnType;

const TYPES: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "transfer", label: "Transfers" },
];

interface Props {
  open: boolean;
  filters: LedgerFilters;
  accounts: Account[];
  categories: Category[];
  onTypeChange: (value: TxnType | null) => void;
  onListToggle: (name: LedgerListFilter, value: string) => void;
}

export function LedgerFilterPanel({
  open,
  filters,
  accounts,
  categories,
  onTypeChange,
  onListToggle,
}: Props) {
  const selectedType: Filter = filters.type ?? "all";
  return (
    <section id="ledger-filter-panel" className="ledger__filter-panel" aria-label="Ledger filters" hidden={!open}>
      <div className="ledger__filter-type">
        <span className="ledger__filter-label">Type</span>
        <Segmented
          options={TYPES}
          value={selectedType}
          onChange={(value) => onTypeChange(value === "all" ? null : value)}
          label="Filter by type"
        />
      </div>
      <div className="ledger__check-groups">
        <ChecklistGroup
          title="Accounts"
          emptyText="No accounts yet."
          options={accounts}
          selected={filters.accountIds}
          onToggle={(value) => onListToggle("accountId", value)}
        />
        <ChecklistGroup
          title="Categories"
          emptyText="No categories yet."
          options={categories}
          selected={filters.categoryIds}
          onToggle={(value) => onListToggle("categoryId", value)}
        />
      </div>
    </section>
  );
}

function ChecklistGroup({
  title,
  emptyText,
  options,
  selected,
  onToggle,
}: {
  title: string;
  emptyText: string;
  options: { id: string; name: string }[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="ledger__check-group">
      <legend>{title}</legend>
      <p className="ledger__check-status">{selected.length === 0 ? "All" : `${selected.length} selected`}</p>
      {options.length === 0 ? <p className="ledger__check-empty">{emptyText}</p> : (
        <div className="ledger__check-list">
          {options.map((option) => (
            <label className="ledger__check" key={option.id}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => onToggle(option.id)}
              />
              <span>{option.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
