import { Redirect } from "expo-router";

/** The overview now lives on the monitor landing route; kept so old links resolve. */
export default function MonitorOverviewRedirect() {
  return <Redirect href="/(roles)/monitor" />;
}
