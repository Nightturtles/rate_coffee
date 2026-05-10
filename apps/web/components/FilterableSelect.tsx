"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  comboboxListClass,
  comboboxOptionActiveClass,
  comboboxOptionClass,
  inputClass,
} from "@/lib/form-classes";
import { cn } from "@/lib/utils";

export type FilterableOption = { id: string; label: string };

export type FilterableSelectProps = {
  id: string;
  options: FilterableOption[];
  value: string | undefined;
  onValueChange: (id: string | undefined) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  emptyText?: string;
  /** When false, keep `value` in the parent until blur/commit (needed for roaster so coffee filter stays valid while typing). */
  clearSelectionOnInput?: boolean;
  /** Fires when the combobox draft text changes (typing, blur, pick). Use with `value` to resolve free-text producers on submit. */
  onDraftChange?: (draft: string) => void;
};

export function FilterableSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder,
  required,
  disabled,
  emptyText = "No matches",
  clearSelectionOnInput = true,
  onDraftChange,
}: FilterableSelectProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurResolve = useRef(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedLabel = useMemo(() => options.find((o) => o.id === value)?.label ?? "", [options, value]);

  /** When there is no committed option, keep showing typed text after blur (e.g. new producer name). */
  const displayValue = focused ? draft : value ? selectedLabel : draft;

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, draft]);

  useEffect(() => {
    if (highlight >= filtered.length) {
      setHighlight(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, highlight]);

  useEffect(() => {
    if (value) {
      setDraft(selectedLabel);
    }
  }, [value, selectedLabel]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  function commit(optionId: string, label: string) {
    skipBlurResolve.current = true;
    onValueChange(optionId);
    setDraft(label);
    setOpen(false);
    setFocused(false);
    inputRef.current?.blur();
    requestAnimationFrame(() => {
      skipBlurResolve.current = false;
    });
  }

  function resolveFromDraft(currentDraft: string) {
    const t = currentDraft.trim().toLowerCase();
    const exact = options.filter((o) => o.label.toLowerCase() === t);
    if (exact.length === 1) {
      onValueChange(exact[0].id);
      setDraft(exact[0].label);
      return;
    }
    if (value && selectedLabel.toLowerCase() === t) {
      setDraft(selectedLabel);
      return;
    }
    onValueChange(undefined);
    setDraft(currentDraft.trim());
  }

  return (
    <div className="relative mt-1">
      {required ? <input type="hidden" value={value ?? ""} required readOnly aria-hidden tabIndex={-1} /> : null}
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={placeholder}
        className={inputClass}
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          setFocused(true);
          setOpen(true);
          if (clearSelectionOnInput) {
            onValueChange(undefined);
          }
          setHighlight(0);
        }}
        onFocus={() => {
          setFocused(true);
          setDraft((prev) => (value ? selectedLabel : prev));
          setOpen(true);
          setHighlight(0);
        }}
        onBlur={() => {
          setOpen(false);
          setFocused(false);
          if (skipBlurResolve.current) return;
          const raw = inputRef.current?.value ?? draft;
          resolveFromDraft(raw);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setFocused(false);
            setDraft(selectedLabel);
            inputRef.current?.blur();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
            return;
          }
          if (e.key === "Enter" && open && filtered.length > 0) {
            e.preventDefault();
            const pick = filtered[highlight] ?? filtered[0];
            if (pick) commit(pick.id, pick.label);
          }
        }}
      />
      {open && !disabled && (
        <ul id={listId} role="listbox" className={comboboxListClass}>
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">{emptyText}</li>
          ) : (
            filtered.map((opt, i) => (
              <li key={opt.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === opt.id}
                  className={cn(comboboxOptionClass, i === highlight && comboboxOptionActiveClass)}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    commit(opt.id, opt.label);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
