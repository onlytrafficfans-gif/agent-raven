import Image from "next/image";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="auth-page">
      <div className="auth-theme"><ThemeToggle compact /></div>
      <section className="auth-visual" aria-hidden="true">
        <Image src="/brand/agent-raven-flagship.png" fill loading="eager" sizes="(max-width: 760px) 100vw, 62vw" alt="" />
        <div className="auth-wordmark">AGENT<span>.</span>RAVEN</div>
      </section>
      <section className="auth-card">
        <div className="auth-card-mark">
          <Image src="/brand/agent-raven-flagship.png" width={190} height={126} loading="eager" alt="" />
          <span>AGENT<span>.</span>RAVEN</span>
        </div>
        <div className="auth-rule" />
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </main>
  );
}
