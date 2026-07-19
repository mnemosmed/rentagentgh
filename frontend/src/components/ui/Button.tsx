import Link from "next/link";
import { ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary:
    "bg-pop text-white shadow-[0_8px_20px_rgba(255,90,95,0.28)] hover:brightness-105",
  outline: "bg-white border-[1.5px] border-navy text-navy hover:bg-graybg",
  ghost: "bg-transparent text-navy hover:bg-graybg",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-[0.9375rem]",
  lg: "px-7 py-3.5 text-base",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  href?: string;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  className = "",
  children,
  onClick,
  ...props
}: Props) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick as never}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
