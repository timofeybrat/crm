"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  CompanyAvatar,
  CompanyStatusBadge,
  companiesOptions,
  companyKeys,
  useCompanyPanel,
  type CompanyStatus,
} from "@/entities/company";
import { formatDate } from "@/shared/lib/datetime";
import { useDebounced } from "@/shared/lib/use-debounced";
import { Button, ErrorNotice, Loading } from "@/shared/ui";

const tabs: { value: CompanyStatus | ""; label: string }[] = [
  { value: "", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "meeting_set", label: "Встреча назначена" },
  { value: "no_answer", label: "Не ответили" },
  { value: "refused", label: "Отказ" },
];
export function CompanyTable({
  status,
  search,
  page,
  onFilter,
  onCreate,
}: {
  status: CompanyStatus | "";
  search: string;
  page: number;
  onFilter: (values: { status?: string; search?: string; page?: number }) => void;
  onCreate: () => void;
}) {
  const cache = useQueryClient();
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // URL transitions must not overwrite the native draft while the user is typing.
    if (searchInput.current && document.activeElement !== searchInput.current) {
      searchInput.current.value = search;
    }
  }, [search]);
  function clearSearch() {
    if (searchInput.current) {
      searchInput.current.value = "";
      searchInput.current.focus();
    }
    onFilter({ search: "", page: 1 });
  }
  const open = useCompanyPanel((state) => state.open);
  const debounced = useDebounced(search);
  const limit = 8;
  const query = useQuery(
    companiesOptions({
      status: status || undefined,
      search: debounced,
      limit,
      offset: (page - 1) * limit,
    }),
  );
  const data = query.data;
  const count = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(count / limit));
  return (
    <div className="surface">
      <div className="surface-heading">
        <h2 className="surface-title">
          База организаций {data && <span className="count-pill">{count}</span>}
        </h2>
        <button
          className="icon-button"
          title="Обновить данные"
          aria-label="Обновить организации"
          disabled={query.isFetching}
          onClick={() => void cache.invalidateQueries({ queryKey: companyKeys.all })}
        >
          <RefreshCw size={15} className={query.isFetching ? "spin" : ""} />
        </button>
      </div>
      <div className="table-toolbar">
        <div className="tabs" aria-label="Фильтр статуса">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={`tab ${status === tab.value ? "tab-active" : ""}`}
              aria-pressed={status === tab.value}
              onClick={() => onFilter({ status: tab.value, page: 1 })}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="search-box">
          <Search size={14} />
          <input
            aria-label="Поиск организаций"
            type="search"
            placeholder="Название, БИН или телефон"
            ref={searchInput}
            defaultValue={search}
            maxLength={200}
            onChange={(event) => onFilter({ search: event.target.value, page: 1 })}
          />
          {search && (
            <button
              className="icon-button search-clear"
              aria-label="Очистить поиск"
              onClick={clearSearch}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      {query.isError ? (
        <div className="px-6">
          <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        </div>
      ) : (
        <div className="table-wrap" aria-busy={query.isFetching}>
          {query.isPending ? (
            <Loading label="Загружаем организации…" />
          ) : !data?.items.length ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Building2 size={24} strokeWidth={1.5} />
              </div>
              <h3>
                {count > 0
                  ? "На этой странице пока пусто"
                  : search || status
                    ? "Ничего не найдено"
                    : "Начните с первой организации"}
              </h3>
              <p>
                {count > 0
                  ? "Вернитесь к первой странице списка."
                  : search || status
                    ? "Попробуйте другой запрос или сбросьте фильтры."
                    : "Добавьте организацию, чтобы записать звонок и назначить встречу."}
              </p>
              {count > 0 ? (
                <Button variant="secondary" onClick={() => onFilter({ page: 1 })}>
                  К первой странице
                </Button>
              ) : search || status ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (searchInput.current) searchInput.current.value = "";
                    onFilter({ status: "", search: "", page: 1 });
                  }}
                >
                  Сбросить фильтры
                </Button>
              ) : (
                <Button variant="secondary" onClick={onCreate}>
                  Добавить организацию
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="mobile-company-list">
                {data.items.map((company) => (
                  <article className="mobile-company-card" key={company.id}>
                    <div className="mobile-company-top">
                      <button
                        className="company-link min-w-0 flex-1"
                        onClick={() => open(company.id)}
                      >
                        <CompanyAvatar small name={company.name} id={company.id} />
                        <span className="company-link-name">{company.name}</span>
                      </button>
                      <CompanyStatusBadge status={company.status} />
                    </div>
                    <div className="mobile-company-bottom">
                      <span className="mono">БИН {company.bin}</span>
                      <a href={`tel:${company.phone}`} className="phone-link">
                        {company.phone}
                      </a>
                      <button
                        className="icon-button"
                        aria-label={`Карточка ${company.name}`}
                        onClick={() => open(company.id)}
                      >
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <table className="company-table">
                <thead>
                  <tr>
                    <th scope="col">Организация</th>
                    <th scope="col">БИН</th>
                    <th scope="col">Телефон</th>
                    <th scope="col">Статус звонка</th>
                    <th scope="col">Добавлена</th>
                    <th scope="col">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((company) => (
                    <tr key={company.id}>
                      <td>
                        <button className="company-link" onClick={() => open(company.id)}>
                          <CompanyAvatar name={company.name} id={company.id} />
                          <span className="company-link-name">{company.name}</span>
                        </button>
                      </td>
                      <td>
                        <span className="mono">{company.bin}</span>
                      </td>
                      <td>
                        <a className="phone-link" href={`tel:${company.phone}`}>
                          {company.phone}
                        </a>
                      </td>
                      <td>
                        <CompanyStatusBadge status={company.status} />
                      </td>
                      <td>{formatDate(company.created_at, { year: "numeric" })}</td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Открыть ${company.name}`}
                          onClick={() => open(company.id)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
      <div className="table-footer">
        <span>
          {count && data?.items.length
            ? `Показано ${(page - 1) * limit + 1}–${Math.min(page * limit, count)} из ${count}`
            : "0 организаций"}
          {query.isFetching && !query.isPending ? " · Обновляем…" : ""}
        </span>
        <div className="pagination">
          <button
            className="icon-button"
            aria-label="Предыдущая страница"
            disabled={page <= 1 || query.isPlaceholderData}
            onClick={() => onFilter({ page: page - 1 })}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="page-number" aria-label={`Страница ${page} из ${pages}`}>
            {page}
          </span>
          <span className="px-1">из {pages}</span>
          <button
            className="icon-button"
            aria-label="Следующая страница"
            disabled={page >= pages || query.isPlaceholderData}
            onClick={() => onFilter({ page: page + 1 })}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
