import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-charcoal">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 text-white">
          <Logo />
        </div>
        <main className="w-full max-w-md">{children}</main>
        <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-white/60">
          Field inspections and corrective actions for quarries, marble
          operations, and stone-processing plants.
        </p>
      </div>
    </div>
  );
}
