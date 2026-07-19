"use client";

import { useParams } from "next/navigation";

import { ChatShell } from "@/components/chat/ChatShell";

export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ChatShell mode="renter" selectedId={id} />;
}
