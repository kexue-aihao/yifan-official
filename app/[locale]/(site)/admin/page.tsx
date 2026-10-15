import Page from "../../../../src/views/Admin";
import { Protected } from "../../../../src/App";
export default function RoutePage() {
  return (
    <Protected admin>
      <Page />
    </Protected>
  );
}
