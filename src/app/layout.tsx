import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Agent.Raven", description: "Agency business discovery and prospect operations" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{const t=localStorage.getItem('agent-raven-theme');if(t==='light'){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light'}}catch(e){}`}}/></head><body>{children}</body></html>;
}
