import { ApiError } from "@/shared/api";

const messages: Record<string, string> = {
  "Concurrent update conflict; retry the request":
    "Данные одновременно изменяются другим запросом. Повторите действие.",
  "Authentication required": "Сессия истекла. Войдите в CRM снова.",
  "Invalid login or password": "Неверный логин или пароль.",
  "Invalid CSRF token": "Не удалось проверить запрос. Обновите страницу и повторите действие.",
  "Untrusted request origin":
    "Запрос отправлен с недопустимого адреса. Откройте CRM по настроенному адресу.",
  "Meeting belongs to another manager":
    "Изменять эту встречу может назначенный менеджер или администратор.",
  "Too many login attempts": "Слишком много попыток входа. Подождите и попробуйте позже.",
  "Too many requests": "Слишком много запросов. Подождите немного и повторите действие.",
  "Video calls are disabled":
    "Видеосвязь отключена. Включите интеграцию LiveKit в настройках backend.",
  "Invalid manager key": "Неверный ключ менеджера. Проверьте личный ключ доступа.",
  "Video room belongs to another manager": "Эта встреча назначена другому менеджеру.",
  "Invitation is invalid or expired":
    "Приглашение недействительно или отозвано. Запросите новую ссылку у менеджера.",
  "Video room is closed": "Видеокомната закрыта: созвон завершён или встреча отменена.",
  "Video access window has ended": "Время доступа к видеовстрече истекло.",
  "Video room opens 15 minutes before the meeting":
    "Подключиться можно за 15 минут до начала встречи.",
  "Video room not found": "Комната ещё не создана. Попросите менеджера подготовить созвон.",
  "Video service unavailable": "Медиасервер временно недоступен. Повторите вход немного позже.",
  "Company with this BIN already exists": "Организация с таким БИН уже есть в базе.",
  "Company already has an active meeting":
    "У организации уже есть активная встреча. Сначала завершите или отмените её.",
  "Manager already has a meeting in this time interval":
    "Это время уже занято. Выберите другой слот или менеджера.",
  "Meeting must fit Mon-Fri 09:00-18:00 Asia/Almaty (60 minutes)":
    "Выберите будний день и время с 09:00 до 17:00 по Алматы.",
  "Only a scheduled meeting can be changed":
    "Эта встреча уже завершена или отменена. Обновите данные.",
  "Meeting cannot be completed before it ends": "Завершить встречу можно после её окончания.",
  "Company not found": "Организация не найдена.",
  "Manager not found": "Менеджер не найден. Обновите список.",
  "Meeting not found": "Встреча не найдена. Обновите данные.",
  "meeting_set requires a scheduled meeting": "Для этого результата нужна активная встреча.",
  "Meeting belongs to another company": "Эта встреча относится к другой организации.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = (error.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string")
      return (
        messages[detail] ?? "Не удалось сохранить изменения. Проверьте данные и повторите попытку."
      );
    if (error.status === 422) return "Проверьте введённые данные и повторите попытку.";
    return "Сервис временно недоступен. Попробуйте ещё раз.";
  }
  return "Не удалось получить данные. Проверьте соединение и попробуйте ещё раз.";
}
