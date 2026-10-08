import type { Metadata } from "next";
import Workspace from "@/components/workspace/Workspace";
import "./workspace.css";

export const metadata: Metadata = {
  title: "QuickExit Workspace — Interactive Trading Demo",
  description:
    "Explore the QuickExit simulated trade-to-bank experience. All prices, positions, and transfers are mock data. No real funds or trades.",
  robots: { index: false, follow: true },
};
export default function AppPage() {
  return <Workspace />;
}
