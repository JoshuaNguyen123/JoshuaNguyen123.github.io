import type { Metadata } from "next";
import Link from "next/link";
import { AdminEditor } from "@/components/blog/AdminEditor";

export const metadata: Metadata = {
  title: "Blog editor — Joshua Nguyen",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <header className="admin-masthead">
        <Link href="/">Joshua Nguyen</Link>
        <span>Private blog editor</span>
      </header>
      <AdminEditor />
    </main>
  );
}
