"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ChatShell } from "@/components/chat/ChatShell";

export default function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>();
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
      <ChatShell mode="agent" selectedId={id} />
    </div>
  );
}
