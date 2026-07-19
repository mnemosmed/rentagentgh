import { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-[#d8e0ea] bg-white px-3.5 py-3 text-base text-navy outline-none transition focus:border-pop focus:shadow-[0_0_0_3px_rgba(255,90,95,0.15)] ${className}`}
      {...props}
    />
  );
}
