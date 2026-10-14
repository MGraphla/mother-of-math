import { Redirect } from "expo-router";

/** The overview now lives on the teacher landing route; kept so old links resolve. */
export default function TeacherOverviewRedirect() {
  return <Redirect href="/(roles)/teacher" />;
}
