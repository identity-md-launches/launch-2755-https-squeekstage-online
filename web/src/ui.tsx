import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./graphics";
export interface Notice {
  text: string;
  error?: boolean;
}
export const NoticeContext = createContext<(notice: Notice) => void>(() => {});
export const useNotice = () => useContext(NoticeContext);
export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
export function Panel({
  title,
  icon,
  aside,
  className = "",
  children,
}: {
  title: string;
  icon?: IconName;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2>
          {icon && <Icon name={icon} />}
          <span>{title}</span>
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function EmptyState({
  icon = "activity",
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={28} />
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function CopyButton({
  value,
  label = "Copy link",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const notify = useNotice();
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      className={`button button-outline ${className}`}
      onClick={async () => {
        try {
          if (!navigator.clipboard) throw new Error("Clipboard unavailable");
          await navigator.clipboard.writeText(value);
          setCopied(true);
          notify({ text: "Link copied." });
        } catch {
          notify({
            text: "Clipboard is unavailable. Select and copy the link shown on this page.",
            error: true,
          });
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} />
      {copied ? "Copied" : label}
    </button>
  );
}
