import type { Metadata, Viewport } from "next";
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
export default function AppPage() {
  return <Workspace />;
}
