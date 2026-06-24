import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-label-sm uppercase tracking-[0.05em] text-text-secondary">
          Creative Review Workspace
        </span>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
        <h1 className="text-heading text-text-primary">Design tokens ready</h1>
        <p className="text-body text-text-secondary">
          Neutral grayscale with functional severity colors. Toggle the theme
          using the control in the header to verify light and dark modes.
        </p>
        <div className="flex items-center gap-3 text-body-emphasis">
          <span className="text-risk">risk</span>
          <span className="text-minor">minor</span>
          <span className="text-pass">pass</span>
        </div>
      </main>
    </div>
  );
}
