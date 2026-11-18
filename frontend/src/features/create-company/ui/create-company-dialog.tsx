"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { companyKeys, createCompany, type Company } from "@/entities/company";
import { Button, ErrorNotice, Field, Modal, useToast } from "@/shared/ui";

const schema = z.object({
  name: z.string().trim().min(1, "Введите название организации").max(200, "Не больше 200 символов"),
  bin: z.string().regex(/^[0-9]{12}$/, "БИН должен содержать 12 цифр"),
  phone: z
    .string()
    .trim()
    .min(5, "Введите телефон: не менее 5 символов")
    .max(32, "Не больше 32 символов"),
});
type Values = z.infer<typeof schema>;

export function CreateCompanyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (company: Company) => void;
}) {
  const cache = useQueryClient();
  const notify = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", bin: "", phone: "" },
  });
  const mutation = useMutation({
    mutationFn: createCompany,
    onSuccess: async (company) => {
      await cache.invalidateQueries({ queryKey: companyKeys.all });
      notify("Организация добавлена в базу");
      onCreated(company);
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая организация"
      description="Добавьте контакт — и переходите к первому звонку."
      busy={mutation.isPending}
    >
      <form noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <fieldset disabled={mutation.isPending}>
          <Field
            label="Название организации"
            htmlFor="company-name"
            error={form.formState.errors.name?.message}
          >
            <input
              id="company-name"
              className="input"
              autoComplete="organization"
              placeholder="Например, ТОО «Компания»"
              maxLength={200}
              aria-invalid={!!form.formState.errors.name}
              aria-describedby="company-name-error"
              {...form.register("name")}
            />
          </Field>
          <Field
            label="БИН"
            htmlFor="company-bin"
            error={form.formState.errors.bin?.message}
            hint="12 цифр, без пробелов"
          >
            <input
              id="company-bin"
              className="input mono"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000000000000"
              maxLength={12}
              aria-invalid={!!form.formState.errors.bin}
              aria-describedby="company-bin-error"
              {...form.register("bin")}
            />
          </Field>
          <Field
            label="Телефон"
            htmlFor="company-phone"
            error={form.formState.errors.phone?.message}
          >
            <input
              id="company-phone"
              className="input"
              type="tel"
              autoComplete="tel"
              placeholder="+7 (___) ___-__-__"
              maxLength={32}
              aria-invalid={!!form.formState.errors.phone}
              aria-describedby="company-phone-error"
              {...form.register("phone")}
            />
          </Field>
        </fieldset>
        {mutation.isError && <ErrorNotice error={mutation.error} />}
        <div className="form-footer">
          <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            <Building2 size={16} />
            Добавить организацию
          </Button>
        </div>
      </form>
    </Modal>
  );
}
