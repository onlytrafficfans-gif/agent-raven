"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, CircleUserRound, FileText, Handshake, Home, Megaphone, Plug, Search, Send, Settings, SlidersHorizontal, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const items = [
  ["Overview","/overview",Home,false],["Find Businesses","/find-businesses",Search,false],["Prospects","/prospects",Users,false],
  ["Contacts","#",CircleUserRound,true],["Opportunity Intelligence","#",ChartNoAxesCombined,true],["Pipeline","#",SlidersHorizontal,true],
  ["Outreach","#",Send,true],["Appointments","#",CalendarDays,true],["Proposals","#",FileText,true],["Clients","#",Handshake,true],
  ["Campaigns","#",Megaphone,true],["Reports","#",BarChart3,true],
] as const;
const footer = [["Integrations","/integrations",Plug],["Settings","/settings",Settings]] as const;

export function AppShell({ children, organizationName, role }: { children:React.ReactNode; organizationName:string; role:string }) {
  const path=usePathname();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/overview" className="brand" aria-label="Agent.Raven home"><Image src="/brand/agent-raven-flagship.png" width={240} height={160} loading="eager" alt=""/><span className="brand-name">AGENT<span>.</span>RAVEN</span></Link>
      <nav className="nav" aria-label="Primary navigation">
        {items.map(([label,href,Icon,planned])=> planned ? <span key={label} className="nav-item disabled" aria-disabled="true"><Icon/><span>{label}</span><span className="planned">Planned</span></span> : <Link key={label} href={href} className={`nav-item ${path===href?"active":""}`}><Icon/><span>{label}</span></Link>)}
        <div className="nav-sep"/>
        {footer.map(([label,href,Icon])=><Link key={label} href={href} className={`nav-item ${path===href?"active":""}`}><Icon/><span>{label}</span></Link>)}
      </nav>
      <div className="sidebar-user"><div className="user-row"><div className="avatar">RA</div><div className="user-meta"><strong>{organizationName}</strong><span>{role.toLowerCase()}</span></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="workspace-chip"><BriefcaseBusiness/><strong>{organizationName}</strong><span className="role-chip">{role}</span></div><ThemeToggle compact/></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
