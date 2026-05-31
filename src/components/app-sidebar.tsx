import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, Database, FileText, FlaskConical, MessageSquarePlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import logo from "@/assets/adadd-logo.png";
import {
  createBlankThread,
  deleteThread,
  loadThreads,
  upsertThread,
} from "@/lib/storage";
import type { Thread } from "@/lib/types";

export function AppSidebar() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setThreads(loadThreads());
    const refresh = () => setThreads(loadThreads());
    window.addEventListener("storage", refresh);
    window.addEventListener("adadd:threads-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("adadd:threads-updated", refresh);
    };
  }, []);

  const handleNewThread = () => {
    const t = createBlankThread();
    upsertThread(t);
    window.dispatchEvent(new CustomEvent("adadd:threads-updated"));
    navigate({ to: "/c/$threadId", params: { threadId: t.id } });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    deleteThread(id);
    window.dispatchEvent(new CustomEvent("adadd:threads-updated"));
    if (pathname.includes(id)) navigate({ to: "/" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <img src={logo} alt="ADADD" width={32} height={32} className="h-8 w-8 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide">ADADD</span>
            <span className="text-[10px] text-muted-foreground">
              AI 辅助药物发现平台
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleNewThread} className="gap-2">
                  <MessageSquarePlus className="h-4 w-4" />
                  <span>新建研究任务</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/jobs"}>
                  <Link to="/jobs" className="gap-2">
                    <Activity className="h-4 w-4" />
                    <span>任务监控</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/reports"}>
                  <Link to="/reports" className="gap-2">
                    <FileText className="h-4 w-4" />
                    <span>历史报告</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/wetlab"}>
                  <Link to="/wetlab" className="gap-2">
                    <FlaskConical className="h-4 w-4" />
                    <span>湿实验报告</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/files"}>
                  <Link to="/files" className="gap-2">
                    <Database className="h-4 w-4" />
                    <span>研究文件库</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex min-h-0 flex-1 flex-col">
          <SidebarGroupLabel>历史对话</SidebarGroupLabel>
          <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto">
            <SidebarMenu>
              {threads.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  暂无历史对话
                </div>
              )}
              {threads.map((t) => {
                const active = pathname === `/c/${t.id}`;
                return (
                  <SidebarMenuItem key={t.id}>
                    <div className="group/row flex items-center">
                      <SidebarMenuButton asChild isActive={active} className="flex-1">
                        <Link
                          to="/c/$threadId"
                          params={{ threadId: t.id }}
                          className="block truncate"
                        >
                          <span className="truncate">{t.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <button
                        onClick={(e) => handleDelete(t.id, e)}
                        aria-label="删除"
                        className="ml-1 hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/20 hover:text-destructive group-hover/row:flex"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
          数据本地保存在浏览器中
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}