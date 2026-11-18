"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "@/entities/session";
import { Button, ErrorNotice, Field } from "@/shared/ui";

const schema = z.object({
  login: z.string().trim().min(3, "Введите логин").max(64),
  password: z.string().min(1, "Введите пароль").max(128),
});
type Values = z.infer<typeof schema>;

export function SignInForm() {
  const session = useSession();
  const [error, setError] = useState<unknown>(null);
  const guard = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { login: "", password: "" },
  });
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          if (guard.current) return;
          guard.current = true;
          setError(null);
          try {
            await session.login(values.login, values.password);
          } catch (err) {
            setError(err);
          } finally {
            guard.current = false;
          }
        })(event);
      }}
      className="login-form"
    >
      <Field label="Логин" htmlFor="login-name" error={errors.login?.message}>
        <input
          id="login-name"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          {...register("login")}
          aria-invalid={!!errors.login}
        />
      </Field>
      <Field label="Пароль" htmlFor="login-password" error={errors.password?.message}>
        <input
          id="login-password"
          className="input"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
      </Field>
      {error != null && <ErrorNotice error={error} />}
      <Button type="submit" loading={isSubmitting}>
        Войти в CRM
      </Button>
    </form>
  );
}
