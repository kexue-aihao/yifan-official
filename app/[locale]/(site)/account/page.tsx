import Page from "../../../../src/views/Account";
import { Protected } from "../../../../src/App";
export default function RoutePage() {
  return (
    <Protected>
      <Page />
    </Protected>
  );
}
