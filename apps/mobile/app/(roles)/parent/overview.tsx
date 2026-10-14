import { Redirect } from "expo-router";

/** The overview now lives on the parent landing route; kept so old links resolve. */
export default function ParentOverviewRedirect() {
  return <Redirect href="/(roles)/parent" />;
}
