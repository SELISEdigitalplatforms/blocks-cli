import { write } from "./fs.js";

// Small presentational atoms: PageHeader, StatusPill, JsonPanel, ActionButton, Chip, Skeleton, Alert, LoadingScreen, EmptyState, ErrorState, FormField, DataTable.
export async function writeUiBasics(root: string): Promise<void> {
  await write(root, "src/shared/ui/PageHeader.tsx", [
    "import type { ReactNode } from \"react\";",
    "",
    "export function PageHeader({ actions, subtitle, title }: { actions?: ReactNode; subtitle: string; title: string }) {",
    "  return <header className=\"page-header\"><div><h2>{title}</h2><p>{subtitle}</p></div>{actions ? <div className=\"page-actions\">{actions}</div> : null}</header>;",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/StatusPill.tsx", [
    "export function StatusPill({ tone, children }: { tone: \"good\" | \"warn\" | \"neutral\"; children: string }) {",
    "  return <span className={`pill pill-${tone}`}>{children}</span>;",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/JsonPanel.tsx", [
    "export function JsonPanel({ value }: { value: unknown }) {",
    "  return <pre>{typeof value === \"string\" ? value : JSON.stringify(value ?? {}, null, 2)}</pre>;",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/ActionButton.tsx", [
    "import type { ButtonHTMLAttributes, ReactNode } from \"react\";",
    "",
    "type Props = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; variant?: \"primary\" | \"icon\" };",
    "",
    "export function ActionButton({ children, icon, variant = \"primary\", ...props }: Props) {",
    "  return <button className={variant === \"icon\" ? \"icon-button\" : \"primary-button\"} {...props}>{icon}{children}</button>;",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/Chip.tsx", [
    "export function ChipList({ empty, items }: { empty: string; items?: string[] }) {",
    "  if (!items || items.length === 0) return <p className=\"muted\">{empty}</p>;",
    "",
    "  return (",
    "    <div className=\"chips\">",
    "      {items.map((item) => <span key={item} className=\"chip\">{item}</span>)}",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/Skeleton.tsx", [
    "import type { CSSProperties } from \"react\";",
    "",
    "export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {",
    "  return <span className={[\"skeleton\", className].filter(Boolean).join(\" \")} style={style} />;",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/Alert.tsx", [
    "import type { ReactNode } from \"react\";",
    "",
    "export function Alert({ children, tone = \"warn\" }: { children: ReactNode; tone?: \"error\" | \"info\" | \"warn\" }) {",
    "  return <div className={`alert alert-${tone}`}>{children}</div>;",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/LoadingScreen.tsx", [
    "export function LoadingScreen() {",
    "  return (",
    "    <div className=\"loading-screen\">",
    "      <span className=\"spinner\" />",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n"));


  await write(root, "src/shared/ui/EmptyState.tsx", [
    "import type { ReactNode } from \"react\";",
    "",
    "export function EmptyState({ action, description, icon, title }: { action?: ReactNode; description: string; icon?: ReactNode; title: string }) {",
    "  return (",
    "    <div className=\"empty-state\">",
    "      {icon ? <div className=\"empty-icon\">{icon}</div> : null}",
    "      <h3>{title}</h3>",
    "      <p>{description}</p>",
    "      {action}",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/ErrorState.tsx", [
    "import { AlertTriangle } from \"lucide-react\";",
    "",
    "export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {",
    "  return (",
    "    <div className=\"error-state\">",
    "      <AlertTriangle size={20} />",
    "      <span>{message}</span>",
    "      {onRetry ? <button className=\"link-button\" onClick={onRetry}>Retry</button> : null}",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/FormField.tsx", [
    "import type { InputHTMLAttributes } from \"react\";",
    "",
    "export function FormField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {",
    "  return (",
    "    <label className=\"form-field\">",
    "      <span>{label}</span>",
    "      <input {...props} />",
    "    </label>",
    "  );",
    "}",
    ""
  ].join("\n"));

  await write(root, "src/shared/ui/DataTable.tsx", [
    "import type { ReactNode } from \"react\";",
    "",
    "export type Column<T> = { key: string; header: ReactNode; render: (row: T) => ReactNode };",
    "",
    "export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {",
    "  return (",
    "    <div className=\"table-shell\">",
    "      <table>",
    "        <thead>",
    "          <tr>{columns.map((column) => <th key={column.key}>{column.header}</th>)}</tr>",
    "        </thead>",
    "        <tbody>",
    "          {rows.map((row, index) => (",
    "            <tr key={String((row as Record<string, unknown>).itemId ?? (row as Record<string, unknown>).id ?? index)}>",
    "              {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}",
    "            </tr>",
    "          ))}",
    "        </tbody>",
    "      </table>",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n"));

}
