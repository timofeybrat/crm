"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { companiesOptions } from "../api/queries";
import type { Company } from "../model/company";
import { useDebounced } from "@/shared/lib/use-debounced";

export function CompanyPicker({ id, value, onChange }: {
  id: string; value: Company | null; onChange: (company: Company | null) => void;
}) {
  const [search, setSearch] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(search);
  const query = useQuery(companiesOptions({ search: debounced, limit: 20 }));
  const options = query.data?.items ?? [];
  function select(company: Company) { onChange(company); setSearch(company.name); setOpen(false); }
  return <div className="picker" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <input id={id} className="input" role="combobox" autoComplete="off" placeholder="Название, БИН или телефон"
      aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
      aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
      value={search} maxLength={200} onFocus={() => setOpen(true)}
      onChange={(event) => { setSearch(event.target.value); onChange(null); setOpen(true); setActive(0); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
        }
        if (event.key === "Enter" && open) { event.preventDefault(); if (options[active]) select(options[active]); }
      }} />
    {open && <div className="picker-list" id={`${id}-list`} role="listbox" aria-label="Организации">
      {query.isError ? <p className="picker-hint">Не удалось загрузить организации. Попробуйте ещё раз.</p>
        : query.isPending ? <p className="picker-hint">Ищем организации…</p>
        : options.length === 0 ? <p className="picker-hint">Ничего не найдено. Сначала добавьте организацию в базу.</p>
        : options.map((company, index) => <button type="button" role="option" aria-selected={index === active}
          id={`${id}-${index}`} key={company.id} className={`picker-option ${index === active ? "picker-option-active" : ""}`}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => select(company)}>
          <span>{company.name}</span><small>{company.bin}</small>
        </button>)}
    </div>}
  </div>;
}
