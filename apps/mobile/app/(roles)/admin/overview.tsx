import { Redirect } from "expo-router";

/** The overview now lives on the admin landing route; kept so old links resolve. */
export default function AdminOverviewRedirect() {
  return <Redirect href="/(roles)/admin" />;
}
