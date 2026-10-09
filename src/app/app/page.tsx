import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { workspaceView } from "@/lib/workspace-navigation";
import Workspace from "@/components/workspace/Workspace";
import "./workspace.css";
import "./mobile.css";

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0b0e0d",
};

export const metadata: Metadata = {
  title: "QuickExit Workspace — Interactive Trading Demo",
  description:
    "Explore the QuickExit simulated trade-to-bank experience. All trades, funds, and transfers are simulated. Optional accounts save paper trading across devices. No real funds or trades.",
  robots: { index: false, follow: true },
};
async function RequestedWorkspace({ searchParams }: {searchParams: Promise<{view?: string | string[]}>}) {
  const params = await searchParams;
  return <Workspace initialView={workspaceView(typeof params.view === "string" ? params.view : null)} />;
}

export default function AppPage(props: {searchParams: Promise<{view?: string | string[]}>}) {
 return <Suspense fallback={<main className="qw-main" aria-busy="true"><p role="status">Preparing your workspace…</p></main>}><RequestedWorkspace {...props} /></Suspense>;
}
