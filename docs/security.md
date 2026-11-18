# Вход менеджеров и безопасность

Расширение ветки `feat/video-calls` после сдачи исходного ТЗ. Авторизация обязательна:
переключателя публичного доступа к CRM нет. Открыты только `/health`, `/ready`,
получение CSRF-вызова и вход, а также гостевые видео-endpoints с приглашением.

## Первый аккаунт

После запуска Compose и миграций создайте менеджеров и первый аккаунт:

```sh
docker compose exec backend /app/.venv/bin/python -m crm.seed
docker compose exec backend /app/.venv/bin/python -m crm.modules.auth.provision --manager-id 1 --login manager1 --role admin
```

Команда запрашивает пароль скрытым вводом, без передачи пароля в аргументах.
Длина нового пароля — 12–128 символов. Создавайте первый аккаунт один раз:
повторная команда меняет пароль, роль и отзывает все сессии этого аккаунта.
Общего пароля по умолчанию и публичной регистрации нет.

Для локальной разработки есть генератор случайного пароля, из корня:

```sh
uv sync --project backend --frozen
uv run --project backend python -m crm.modules.auth.configure
```

Он записывает `CRM_BOOTSTRAP_LOGIN`, `CRM_BOOTSTRAP_PASSWORD` и ID менеджера только
в игнорируемые `.env` и `backend/.env`, сохраняя другие настройки и существующий
пароль. Затем из backend, с правильно настроенным `CRM_DATABASE_URL`:

```sh
uv run alembic upgrade head
uv run python -m crm.seed
uv run python -m crm.modules.auth.provision --from-env --role admin
```

Генератор сам по себе не создаёт аккаунт в БД. Bootstrap-пароль нужен только оператору
для явного создания/сброса; backend не создаёт пользователей при старте.
В интерфейсе `/login` используйте логин и пароль, а не ключ LiveKit.
Токены, пароли и файлы окружения в Git не добавляются.

Обычный менеджер и отключение аккаунта:

```sh
docker compose exec backend /app/.venv/bin/python -m crm.modules.auth.provision --manager-id 2 --login manager2 --role manager
docker compose exec backend /app/.venv/bin/python -m crm.modules.auth.provision --manager-id 2 --disable
```

При отключении или сбросе пароля серверные сессии отзываются. Для восстановления
выполните создание/сброс с нужной ролью. Пароли хранятся в БД только как Argon2id-хеши
с индивидуальной солью; устаревшие параметры хеша обновляются при успешном входе.

## Сессии и CSRF

- Сессия — случайный непрозрачный идентификатор в `HttpOnly; SameSite=Lax; Path=/`
  cookie, фиксированный срок по умолчанию 8 часов. В PostgreSQL сохраняется SHA-256
  идентификатора, а не его исходное значение; JWT сессий в браузере нет.
- `GET /auth/csrf` выдаёт короткую анонимную сессию на 5 минут перед входом и
  CSRF-токен. Анонимная сессия не даёт доступа к CRM.
- `POST /auth/login` требует эту сессию, `X-CSRF-Token` и точный `Origin`, совпадающий
  с `CRM_FRONTEND_URL`. Успешный вход заменяет ID сессии и CSRF-токен.
- Все изменения закрытых ресурсов требуют сессию, точный `Origin` и CSRF-токен,
  хеш которого связан с серверной сессией. `SameSite` и CORS дополняют эту проверку.
- CSRF-cookie доступна JavaScript для передачи в заголовке; cookie сессии — нет.
  API возвращает `Cache-Control: no-store`, ошибки валидации не повторяют входные
  пароли/токены. Выход удаляет сессию на сервере и очищает cookies.
- При HTTPS имена cookies имеют префикс `__Host-`, флаг `Secure`, без `Domain`.
  Локальный HTTP-режим использует `crm_session`/`crm_csrf` без `Secure` и предназначен
  для разработки на loopback. Перед внешним размещением нужен HTTPS-режим.
- Frontend очищает кеш CRM при выходе и потере сессии; вкладки синхронизируют выход
  через BroadcastChannel. В localStorage и Query cache нет паролей и токенов;
  Query хранит только безопасные сведения о текущем пользователе.

## Права

Организации, звонки и расписания — общие данные команды, доступные после входа.
Менеджер может создавать организации, фиксировать обычные исходы звонка, назначать,
переносить и отменять только свои встречи. Он не может передать свою встречу другому
менеджеру, изменить чужую или связать звонок `meeting_set` с чужой встречей.
Администратор может управлять встречами и видеокомнатами всей команды.
Права проверяются на backend, а при изменении встречи — внутри транзакции под
блокировкой строки. Ограничения frontend нужны для понятного интерфейса.

Менеджер входит в видеокомнату через свою сессию CRM; статические видеоключи больше
не принимаются. Гость использует приглашение без регистрации. После первого входа
ведущего комната привязана к его сессии: выход, истечение, отключение аккаунта или
сброс пароля запрещают новые подключения, а обработчик удаляет комнату на LiveKit.
Отключение уже подключённых клиентов выполняется обычно после следующего цикла
обработчика (10 секунд), при отказе платформы — после восстановления связи.
Закрытая комната не открывается старым JWT благодаря `room.auto_create: false`.

Миграция безопасности отзывает прежние комнаты и приглашения, созданные до привязки
к сессиям. Встречи CRM и их история сохраняются; создайте комнату и ссылку заново.

## HTTPS/WSS

Из корня, после настройки LiveKit и создания аккаунта:

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml --profile video up -d --build --wait
```

Адрес CRM — `https://localhost:8443`, медиасервер — `wss://localhost:8444`.
В этом режиме используется production target Next.js, прямые порты frontend/backend
не публикуются, Caddy направляет `/api/*` в FastAPI и проксирует WebSocket в LiveKit.
`CRM_ENVIRONMENT=production` запрещает debug, HTTP frontend и незащищённые сессии,
а при включённой видеосвязи требует WSS.

Для localhost Caddy создаёт локальный CA. Получите **публичный** корневой сертификат:

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml --profile video cp gateway:/data/caddy/pki/authorities/local/root.crt .cache/crm-local-root.crt
```

Для ручной проверки доверьте этот сертификат в хранилище доверенных корневых CA
текущего пользователя/браузера. Папку `.cache` при необходимости создайте заранее.
Закрытые ключи CA остаются в Docker volume; в репозиторий они не попадают.
Игнорирование ошибок сертификата используется только в изолированном Playwright
тесте локального CA, а не в приложении или production-конфигурации.

Для публичного размещения задайте в корневом `.env` свои параметры, например:

```dotenv
CRM_APP_ADDRESS=crm.example.com
CRM_MEDIA_ADDRESS=video.example.com
CRM_HTTPS_BIND_ADDRESS=0.0.0.0
CRM_HTTPS_PORT=443
CRM_HTTP_PORT=80
CRM_HTTPS_FRONTEND_URL=https://crm.example.com
CRM_HTTPS_LIVEKIT_PUBLIC_URL=wss://video.example.com
```

Нужны ваши DNS-записи и доступные порты 80/443: Caddy получает и обновляет публичные
сертификаты автоматически. Это пример доменов, не выполненное публичное развёртывание.
Отдельно настройте внешний ICE IP и доступные RTC-порты/TURN в LiveKit либо используйте
LiveKit Cloud: локальный `infra/livekit.yaml` рекламирует `127.0.0.1` и подходит
для теста на одном компьютере. HTTPS сам по себе не настраивает маршрутизацию медиа.

Для возврата к локальному HTTP используйте базовый Compose и остановите gateway:

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml --profile video stop gateway
docker compose --profile video up -d --build --wait
```

Не смешивайте адреса localhost/127.0.0.1 или HTTP/HTTPS: cookies привязаны к хосту,
а сервер проверяет origin. После переключения войдите заново.

## Ограничение попыток

По умолчанию: 5 неудачных входов на логин за 15 минут, 30 попыток входа на IP за
15 минут, 60 CSRF-вызовов/минуту на IP. Успешный вход сбрасывает счётчик логина,
но не IP. Для гостевого видео отдельно ограничены проверки приглашения и вход.
При превышении — 429 с `Retry-After`.
Счётчики атомарны и общие для процессов/реплик в PostgreSQL; перезапуск API их
не сбрасывает. Истёкшие записи и сессии удаляются фоновым обработчиком.
Логины/IP в ключах счётчиков хешируются. `X-Forwarded-For` учитывается только от
доверенных proxy-сетей. HTTPS override доверяет выделенной сети Caddy, а не
произвольным клиентским заголовкам. Не расширяйте доверие до `0.0.0.0/0`.

## Проверки

Обычный `pytest` проверяет Argon2, сессии, CSRF, роли, конкурентные лимиты и отзыв
видеодоступа. `npm run test:e2e` проверяет CRM и вход, `npm run test:e2e:video` —
реальный медиасервер через HTTP/WS в изолированном окружении.
Для HTTPS/WSS из корня:

```sh
docker compose --profile test --profile test-video --profile test-tls up -d --wait postgres-test livekit-test gateway-test
cd frontend
npm run test:e2e:secure
```

Нужны настроенная `.env.test` и зависимости по README. TLS-тест использует порты
18443/18444, Next.js 3001, FastAPI 18001, только crm_test и фиктивные учётные данные.
На Docker Desktop тестовый proxy обращается к хосту через host.docker.internal;
другие платформы требуют соответствующего маршрута к хосту. Наборы запускаются
последовательно: тестовый сервер очищает crm_test.

Источники решений: [FastAPI/pwdlib](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/),
[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[Caddy HTTPS](https://caddyserver.com/docs/automatic-https),
[LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/).

Примеры `docs/requests.http` начинаются с CSRF и входа. Для VS Code REST Client
скопируйте `docs/.env.example` в игнорируемый `docs/.env` и укажите свои реквизиты:
расширение читает `.env` рядом с `.http`. Сохранение cookies должно быть включено,
а TLS-клиент должен доверять локальному CA. Для HTTP dev смените baseUrl на
`http://localhost:8000`, origin — на `http://localhost:3000`.
Синтаксис переменных и cookies: [REST Client](https://github.com/Huachao/vscode-restclient).
