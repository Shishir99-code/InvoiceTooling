import { TopNav } from "@/components/top-nav";

// Route-group layout wrapping every authenticated page with the shared top
// nav (D-01/D-02). Route groups do not change URLs. Never rendered on
// /login, which lives outside the (app) group. No <html>/<body> here —
// those stay solely in the root app/layout.tsx.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav />
      <main>{children}</main>
    </>
  );
}
