import Workbench from "@/components/Workbench";
import { DEFAULT_SOURCE_IDS, SOURCES } from "@/lib/sources";

export default function Home() {
  // The registry is static, so it ships with the HTML rather than costing a
  // round trip before the admin can pick sources.
  return <Workbench sources={SOURCES} defaultSourceIds={DEFAULT_SOURCE_IDS} />;
}
