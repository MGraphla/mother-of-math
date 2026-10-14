import { Redirect } from "expo-router";

/** The overview now lives on the student landing route; kept so old links resolve. */
export default function StudentOverviewRedirect() {
  return <Redirect href="/(roles)/student" />;
}
