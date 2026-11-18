# CRM

Основа CRM для организаций, звонков и встреч. Стек: Next.js, TypeScript,
TanStack Query, Zustand, Zod, react-hook-form, Tailwind CSS; FastAPI, SQLAlchemy,
Alembic, Pydantic, PostgreSQL; Docker Compose. Redis доступен отдельным профилем.

## Текущее состояние

Инициализированы приложения, FSD-структура, конфигурация миграций, зависимости
с lock-файлами, Dockerfile и Compose. Backend предоставляет GET /health и GET /ready.
Frontend показывает стартовую страницу. ORM-модели и первая миграция готовы:
PostgreSQL защищает длительность, пересечения менеджера и активную встречу организации.
Есть идемпотентный seed менеджеров и интеграционные тесты ограничений на отдельной БД.
Все обязательные API реализованы: организации, звонки, назначение, перенос,
отмена и расписание. Есть чтение встречи с историей и список менеджеров.
Проверяются рабочие часы, конкурентные конфликты и атомарность изменений.
Frontend пока показывает стартовую страницу; формы CRM не реализованы.
Принятые компромиссы и конкурентность описаны в [REFLECTION.md](REFLECTION.md).

Рекомендации и спорные требования: [docs/architecture.md](docs/architecture.md).
Принятые правила MVP: [docs/api-contract.md](docs/api-contract.md).
План оставшихся работ по приоритету: [docs/tasks.md](docs/tasks.md).

## Запуск Docker Compose

Нужны Docker Engine / Docker Desktop с Linux containers и Docker Compose v2.
Конфигурация находится в `docker-compose.yml` в корне репозитория.
Команда из корня, без обязательных предварительных файлов:

```sh
docker compose up --build
```

- Приложение: http://localhost:3000
- Swagger: http://localhost:8000/docs
- Liveness: http://localhost:8000/health
- Readiness (соединение с PostgreSQL): http://localhost:8000/ready

Compose запускает миграции перед API. Для демонстрационных менеджеров после старта:

```sh
docker compose exec backend /app/.venv/bin/python -m crm.seed
```

Команда идемпотентна; ID менеджеров 1 и 2, данные демонстрационные.
Frontend в Compose запускается в development-режиме; после изменения файлов
повторить команду с --build. Production target подготовлен отдельно.

Для изменения портов и параметров PostgreSQL скопировать `.env.example` в `.env`
в корне и изменить значения. Настройки backend в Compose передаются напрямую,
локальные `backend/.env` и `frontend/.env.local` ему не нужны.
Локальные пароли из примеров не использовать для публичного развёртывания.

Опционально Redis:

```sh
docker compose --profile redis up --build
```

Redis пока не подключён к backend и не нужен для работы API.
Остановка без удаления данных: `docker compose down`.
Дополнительные замечания: [infra/README.md](infra/README.md).

## Локальная разработка

Нужны Node.js 22+, npm, Python 3.11+ и uv 0.11.8+.
Команды npm в PowerShell при запрете скриптов можно выполнять как `npm.cmd`.

Запустить БД из корня:

```sh
docker compose up -d postgres
```

Backend, отдельный терминал:

```sh
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run python -m crm.seed
uv run uvicorn crm.main:app --app-dir src --reload
```

Настройки по умолчанию соответствуют Compose. Для изменения скопировать
`backend/.env.example` в `backend/.env`. Все переменные backend имеют префикс CRM_.
Если меняются реквизиты PostgreSQL в корневом .env, обновить CRM_DATABASE_URL
в backend/.env отдельно. Не коммитить реальные .env.

Frontend, ещё один терминал:

```sh
cd frontend
npm ci
npm run dev
```

По умолчанию прокси обращается к http://127.0.0.1:8000. Для изменения скопировать
`frontend/.env.example` в `frontend/.env.local` и настроить API_INTERNAL_URL.

## API и демонстрация

Полный контракт и допущения: [docs/api-contract.md](docs/api-contract.md).
Последовательные примеры для VS Code REST Client: [docs/requests.http](docs/requests.http).
Swagger доступен на /docs. В примерах используются только демонстрационные данные;
их удобнее выполнять на свежей базе после seed менеджеров.

Все шесть обязательных эндпоинтов реализованы. Дополнительно доступны GET /managers
и GET /meetings/{id} для чтения менеджеров и истории встречи.
Дата расписания относится к Almaty, но timestamps принимаются и возвращаются в UTC.
У организации не более одной scheduled-встречи вообще; PATCH с action=complete
после окончания встречи либо action=cancel освобождает организацию.
Статус организации отражает последний звонок и не пересчитывается при отмене встречи.
Для meeting_set сначала создаётся встреча, затем звонок с её ID; это два независимых
запроса. Успешное создание встречи не откатывается, если запись звонка не удалась.

Время в прошлом разрешено: запрет не задан ТЗ. Праздники, обеденные перерывы,
авторизация, роли, очереди, уведомления и Redis-кэш не реализованы.
Для тестов интеграции используется одна отдельная БД crm_test; запускать этот набор
последовательно, без параллельного pytest-xdist против того же экземпляра БД.

## Проверки

Интеграционные тесты используют исключительно БД `crm_test` (не рабочую `crm`).
Из корня запустить отдельную PostgreSQL с временным хранилищем:

```sh
docker compose --profile test up -d --wait postgres-test
```

Скопировать `backend/.env.test.example` в `backend/.env.test`. Можно вместо файла
задать CRM_TEST_DATABASE_URL через окружение. Тесты применяют миграции и очищают
предметные таблицы **только в crm_test**. При отсутствии настройки интеграционные
тесты пропускаются с явным сообщением; для полной проверки их нельзя пропускать.

Из backend:

```sh
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run alembic upgrade head --sql
```

Из frontend:

```sh
npm run lint
npm run typecheck
npm run build
```

Из корня: `docker compose config --quiet`.
Полный запуск контейнеров требует запущенного Docker Engine.

## Миграции при дальнейшей разработке

После создания моделей импортировать их в src/crm/db/models.py. С запущенной БД,
из backend:

```sh
uv run alembic revision --autogenerate -m "create crm tables"
uv run alembic upgrade head
```

Проверять сгенерированный SQL вручную. PostgreSQL EXCLUDE и частичные индексы
должны быть явно проверены/добавлены в миграции; autogenerate не заменяет ревью.
