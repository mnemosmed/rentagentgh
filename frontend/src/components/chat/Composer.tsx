"use client";

import { FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

type Props = {
  canSend: boolean;
  disabled?: boolean;
  onSend: (content: string, file: File | null) => Promise<void>;
  renewHref?: string;
};

export function Composer({ canSend, disabled, onSend, renewHref = "/access" }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!canSend) {
    return (
      <div className="border-t border-[#edf2f7] bg-amber-50 px-4 py-4 text-center">
        <p className="mb-2 text-sm font-semibold text-navy">
          Your access has expired. Renew to keep messaging agents.
        </p>
        <Button href={renewHref} size="sm">
          Renew access
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(text.trim(), file);
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-[#edf2f7] bg-white p-3">
      {file && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-graybg px-3 py-2 text-xs">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            className="ml-2 font-semibold text-pop"
            onClick={() => {
              setFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Remove
          </button>
        </div>
      )}
      {error && <p className="mb-2 text-xs font-semibold text-red-600">{error}</p>}
      <div className="flex items-end gap-2">
        <label className="shrink-0 cursor-pointer rounded-xl border border-[#d8e0ea] px-3 py-2.5 text-sm font-semibold text-navy hover:bg-graybg">
          Attach
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Write a message…"
          className="max-h-28 min-h-[2.75rem] flex-1 resize-y rounded-xl border border-[#d8e0ea] px-3.5 py-2.5 text-sm outline-none focus:border-pop"
          disabled={disabled || sending}
        />
        <Button type="submit" size="sm" disabled={disabled || sending || (!text.trim() && !file)}>
          {sending ? "…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
