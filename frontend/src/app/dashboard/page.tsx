"use client";

import Link from "next/link";

import { ChatShell } from "@/components/chat/ChatShell";

export default function DashboardPage() {
  return (
    <div>
      <div className="container-app pt-4">
        <Link
          href="/dashboard/profile"
          className="text-sm font-semibold text-pop hover:underline"
        >
          Edit agent profile →
        </Link>
      </div>
      <ChatShell mode="agent" />
    </div>
  );
}
