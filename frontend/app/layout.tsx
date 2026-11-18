import type { Metadata } from "next";
import { AppProviders } from "@/app/providers";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { CompanyWorkspace } from "@/widgets/company-workspace";
import "@/app/styles/globals.css";
import "@livekit/components-styles";
import "@/app/styles/video.css";

export const metadata: Metadata = {
  title: "Пульс — CRM команды",
  description: "Учёт организаций, звонков и встреч",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <AppProviders>
          <WorkspaceShell>{children}</WorkspaceShell>
          <CompanyWorkspace />
        </AppProviders>
      </body>
    </html>
  );
}
