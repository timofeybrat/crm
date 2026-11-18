"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, LockKeyhole, ShieldCheck } from "lucide-react";
import { useSession } from "@/entities/session";
import { SignInForm } from "@/features/sign-in";

function LoginContent() {
  const { user, loading } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "";
  const destination = /^\/(?:companies|schedule|video\/meetings\/[1-9]\d*)(?:\?[^\\]*)?$/.test(next)
    ? next
    : "/companies";
  useEffect(() => {
    if (user && !loading) router.replace(destination);
  }, [user, loading, router, destination]);
  return (
    <main className="login-page">
      <div className="login-intro">
        <span className="video-brand">
          <Activity size={27} />
          пульс<span>.</span>
        </span>
        <h1>
          Хороший день
          <br />
          начинается с контакта.
        </h1>
        <p>Организации, встречи и разговоры вашей команды — в одном рабочем пространстве.</p>
        <span className="login-security">
          <ShieldCheck size={17} />
          Доступ только для вашей команды
        </span>
      </div>
      <section className="video-access-card login-card">
        <span className="video-access-icon">
          <LockKeyhole size={24} />
        </span>
        <h2>Добро пожаловать</h2>
        <p>Войдите в свой аккаунт менеджера.</p>
        <SignInForm />
        <p className="login-help">Нет доступа? Обратитесь к администратору команды.</p>
      </section>
    </main>
  );
}
export function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
