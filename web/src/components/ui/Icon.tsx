type Name = "lock" | "unlock" | "check" | "cross" | "clock" | "key" | "shield" | "node" | "paper" | "users" | "seal" | "arrow" | "power" | "warn" | "eye" | "chain";

const paths: Record<Name, string> = {
  lock: "M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5zM12 14v3",
  unlock: "M6 10V7a6 6 0 0 1 11.3-2.8M5 10h14v11H5zM12 14v3",
  check: "M4 12.5l5 5L20 6.5",
  cross: "M6 6l12 12M18 6L6 18",
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2",
  key: "M14.5 3a6.5 6.5 0 1 1-4.6 11.1L4 20v-3h-2v-3l6.4-6.4A6.5 6.5 0 0 1 14.5 3M16 8h.01",
  shield: "M12 3l8 3v6c0 4.6-3.4 8.2-8 9c-4.6-.8-8-4.4-8-9V6zM8.5 12l2.5 2.5L15.5 10",
  node: "M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M5 21v-1a7 7 0 0 1 14 0v1",
  paper: "M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 15h7M9 19h4",
  users: "M9 4a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6",
  seal: "M12 2l2.2 2.1l3-.4l.9 2.9l2.7 1.4l-.9 2.9l1.3 2.7l-2.6 1.6l-.4 3l-3 .1L12 22l-2.2-2.1l-3 .4l-.9-2.9l-2.7-1.4l.9-2.9L2.8 10.4l2.6-1.6l.4-3l3-.1zM8.5 12l2.5 2.5L15.5 10",
  arrow: "M5 12h14M13 6l6 6l-6 6",
  power: "M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0",
  warn: "M12 3L2 20h20zM12 10v4M12 17.5h.01",
  eye: "M2 12s3.6-7 10-7s10 7 10 7s-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  chain: "M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1",
};

export type IconName = Name;

export function Icon({ name, size = 16, label }: { name: Name; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={paths[name]} />
    </svg>
  );
}
