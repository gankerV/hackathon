import styles from "./Avatar.module.css";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, role, size = "md" }: { name: string; role?: string; size?: "sm" | "md" | "lg" }) {
  const tone = role === "admin" ? styles.admin : role === "teacher" ? styles.teacher : role === "student" ? styles.student : styles.other;
  return (
    <span className={[styles.avatar, styles[size], tone].join(" ")} aria-hidden>
      {initials(name)}
    </span>
  );
}
