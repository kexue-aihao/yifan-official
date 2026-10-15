import App from "../../../src/App";
import { SiteProvider } from "../../../src/lib";
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteProvider>
      <App>{children}</App>
    </SiteProvider>
  );
}
