import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const api = "http://127.0.0.1:18001";
const names = [
  "Atlas Logistics",
  "Студия Forma",
  "Northline Group",
  "Арман Строй",
  "Digital Partners",
  "Бюро Aspan",
  "Eco Market",
  "Qadam Consulting",
  "Vector Systems",
  "Terra Foods",
  "Nova Education",
  "Steppe Travel",
];
const seeded: { id: number; name: string; bin: string }[] = [];
let sequence = 0;
function bin() {
  return String(Date.now() + sequence++).slice(-12);
}
async function add(request: APIRequestContext, name: string) {
  const response = await request.post(`${api}/companies`, {
    data: { name, bin: bin(), phone: "00000" },
  });
  expect(response.status()).toBe(201);
  return response.json() as Promise<{ id: number; name: string; bin: string }>;
}
async function openCompany(page: Page, name: string) {
  await page.goto(`/companies?q=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name, exact: true }).click();
  return page.getByRole("dialog", { name: "Карточка организации", exact: true });
}
test.beforeAll(async ({ request }) => {
  for (const [index, name] of names.entries()) {
    const company = await add(request, `Демо · ${name}`);
    seeded.push(company);
    if (index % 4 === 3) {
      const response = await request.post(`${api}/meetings`, {
        data: {
          company_id: company.id,
          manager_id: 1,
          starts_at: `2026-11-23T${String(4 + Math.floor(index / 4) * 2).padStart(2, "0")}:00:00Z`,
        },
      });
      expect(response.status()).toBe(201);
      const meeting = await response.json();
      await request.post(`${api}/calls`, {
        data: { company_id: company.id, result: "meeting_set", meeting_id: meeting.id },
      });
    } else if (index % 4)
      await request.post(`${api}/calls`, {
        data: { company_id: company.id, result: index % 4 === 1 ? "no_answer" : "refused" },
      });
  }
});

test("company list, search, filters and real pagination", async ({ page }, info) => {
  await page.goto("/companies");
  await expect(page.getByRole("heading", { name: "Организации", exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.screenshot({ path: info.outputPath("companies-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Следующая страница" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Отказ", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "Все", exact: true }).click();
  await page.getByRole("searchbox", { name: "Поиск организаций" }).fill(seeded[0].bin);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("button", { name: seeded[0].name, exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("несуществующая организация qa");
  await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();
  await page.getByRole("button", { name: "Очистить поиск", exact: true }).click();
  await page.getByRole("searchbox").pressSequentially("Atlas", { delay: 10 });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("Atlas");
});

test("create, record call, schedule, move, inspect history and cancel", async ({
  page,
  request,
}, info) => {
  await page.goto("/companies");
  await page.getByRole("button", { name: "Добавить организацию", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Новая организация", exact: true });
  await create.getByRole("button", { name: "Добавить организацию" }).click();
  await expect(create.getByText("Введите название организации", { exact: true })).toBeVisible();
  await create.getByLabel("Название организации", { exact: true }).fill("Демо · Новый контакт");
  await create.getByLabel("БИН", { exact: true }).fill(seeded[0].bin);
  await create.getByLabel("Телефон", { exact: true }).fill("00000");
  await create.getByRole("button", { name: "Добавить организацию" }).click();
  await expect(create.getByText("Организация с таким БИН уже есть в базе.")).toBeVisible();
  const newBin = bin();
  await create.getByLabel("БИН", { exact: true }).fill(newBin);
  await create.getByRole("button", { name: "Добавить организацию" }).click();
  const drawer = page.getByRole("dialog", { name: "Карточка организации", exact: true });
  await expect(drawer.getByText("Демо · Новый контакт", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Сохранить результат", exact: true }).click();
  await expect(drawer.locator(".detail-facts .status-badge")).toHaveText("Не ответили");
  await drawer.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Назначить встречу", exact: true });
  await editor.getByLabel("Менеджер", { exact: true }).selectOption("2");
  await editor.getByLabel("Дата", { exact: true }).fill("2026-11-24");
  await editor.getByLabel("Время, Алматы", { exact: true }).selectOption("10:00");
  await editor.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(drawer.locator(".detail-facts .status-badge")).toHaveText("Встреча назначена");
  await drawer.getByRole("button", { name: "Перенести", exact: true }).click();
  const move = page.getByRole("dialog", { name: "Перенести встречу", exact: true });
  await move.getByLabel("Дата", { exact: true }).fill("2026-11-25");
  await move.getByLabel("Время, Алматы", { exact: true }).selectOption("11:00");
  await move.getByRole("button", { name: "Сохранить перенос", exact: true }).click();
  await expect(move).not.toBeVisible();
  await drawer.getByRole("button", { name: "История", exact: true }).click();
  const history = page.getByRole("dialog", { name: "История встречи", exact: true });
  await expect(history.getByText("Встреча перенесена", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("meeting-history.png"), fullPage: true });
  await history.getByRole("button", { name: "Закрыть", exact: true }).click();
  await drawer.getByRole("button", { name: "Отменить", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Отменить встречу?", exact: true })
    .getByRole("button", { name: "Да, отменить", exact: true })
    .click();
  await expect(drawer.getByText("Активных встреч пока нет", { exact: true })).toBeVisible();
  const company = (await (await request.get(`${api}/companies?search=${newBin}`)).json()).items[0];
  const data = await (await request.get(`${api}/companies/${company.id}`)).json();
  expect(data.recent_calls).toHaveLength(2);
  const details = await (await request.get(`${api}/meetings/${data.recent_meetings[0].id}`)).json();
  expect(details.original_starts_at).toBe("2026-11-24T05:00:00Z");
  expect(details.history.map((event: { action: string }) => event.action)).toEqual([
    "create",
    "reschedule",
    "cancel",
  ]);
});

test("partial call failure retries only the call, never duplicates the meeting", async ({
  page,
  request,
}) => {
  const company = await add(request, "Демо · Проверка повтора");
  const drawer = await openCompany(page, company.name);
  await drawer.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Назначить встречу", exact: true });
  await editor.getByLabel("Дата", { exact: true }).fill("2026-11-26");
  await editor.getByLabel("Менеджер", { exact: true }).selectOption("2");
  await page.route("**/api/calls", (route) =>
    route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
  );
  await editor.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  await expect(editor.getByText("Встреча уже создана", { exact: true })).toBeVisible();
  await page.unroute("**/api/calls");
  await editor.getByRole("button", { name: "Повторить запись звонка", exact: true }).click();
  await expect(editor).not.toBeVisible();
  const data = await (await request.get(`${api}/companies/${company.id}`)).json();
  expect(data.recent_meetings).toHaveLength(1);
  expect(data.recent_calls).toHaveLength(1);
});

test("concurrent conflict stays understandable and preserves form values", async ({
  page,
  request,
}) => {
  const company = await add(request, "Демо · Проверка конфликта");
  const drawer = await openCompany(page, company.name);
  await drawer.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Назначить встречу", exact: true });
  await editor.getByLabel("Дата", { exact: true }).fill("2026-11-21");
  await editor.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  await expect(
    editor.getByText("Выберите будний день: понедельник–пятница", { exact: true }),
  ).toBeVisible();
  await editor.getByLabel("Дата", { exact: true }).fill("2026-11-27");
  await editor.getByLabel("Менеджер", { exact: true }).selectOption("2");
  await page.route("**/api/meetings", (route) =>
    route.fulfill({
      status: 409,
      json: { detail: "Manager already has a meeting in this time interval" },
    }),
  );
  await editor.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  await expect(
    editor.getByText("Это время уже занято. Выберите другой слот или менеджера.", { exact: true }),
  ).toBeVisible();
  await expect(editor.getByLabel("Дата", { exact: true })).toHaveValue("2026-11-27");
});

test("daily schedule, keyboard focus and mobile layouts", async ({ page }, info) => {
  await page.goto("/schedule?date=2026-11-23&manager=1");
  await expect(page.locator(".timeline-meeting")).toHaveCount(3);
  await page.screenshot({ path: info.outputPath("schedule-desktop.png"), fullPage: true });
  const opener = page.locator(".timeline-meeting").first();
  await opener.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Карточка организации", exact: true });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(opener).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/companies");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath("companies-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Добавить организацию", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Новая организация", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.goto("/schedule?date=2026-11-23&manager=1");
  await expect(page.locator(".timeline-meeting")).toHaveCount(3);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath("schedule-mobile.png"), fullPage: true });
});

test("schedule hour picker creates a meeting and invalidates its old day on move", async ({
  page,
}) => {
  await page.goto("/schedule?date=2026-11-30&manager=2");
  await page.getByRole("button", { name: "Назначить встречу на 09:00", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Назначить встречу", exact: true });
  await editor.getByRole("combobox", { name: "Организация", exact: true }).fill(seeded[0].name);
  await editor.getByRole("option").filter({ hasText: seeded[0].name }).click();
  await expect(editor.getByLabel("Время, Алматы", { exact: true })).toHaveValue("09:00");
  await editor.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.locator(".timeline-meeting")).toHaveCount(1);
  await page.locator(".timeline-meeting").click();
  const drawer = page.getByRole("dialog", { name: "Карточка организации", exact: true });
  await drawer.getByRole("button", { name: "Перенести", exact: true }).click();
  const move = page.getByRole("dialog", { name: "Перенести встречу", exact: true });
  await move.getByLabel("Дата", { exact: true }).fill("2026-12-01");
  await move.getByRole("button", { name: "Сохранить перенос", exact: true }).click();
  await expect(move).not.toBeVisible();
  await drawer.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".timeline-meeting")).toHaveCount(0);
  await page.getByRole("button", { name: "Следующий день", exact: true }).click();
  await expect(page.locator(".timeline-meeting")).toHaveCount(1);
});

test("ended meetings can be completed from the company drawer", async ({ page, request }) => {
  const company = await add(request, "Демо · Завершённая встреча");
  const response = await request.post(`${api}/meetings`, {
    data: { company_id: company.id, manager_id: 2, starts_at: "2020-01-06T05:00:00Z" },
  });
  expect(response.status()).toBe(201);
  const meeting = await response.json();
  const drawer = await openCompany(page, company.name);
  await drawer.getByRole("button", { name: "Завершить", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Завершить встречу?", exact: true })
    .getByRole("button", { name: "Завершить встречу", exact: true })
    .click();
  await expect(drawer.getByText("Активных встреч пока нет", { exact: true })).toBeVisible();
  expect((await (await request.get(`${api}/meetings/${meeting.id}`)).json()).status).toBe(
    "completed",
  );
});
