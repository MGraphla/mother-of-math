import { useState } from "react";
import { Alert } from "react-native";
import { Field, PrimaryButton, ScreenShell } from "../../../src/components/ScreenKit";
import { createTeacherAccount } from "../../../src/services/admin";

export default function AdminCreateTeacherScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [country, setCountry] = useState("Cameroon");
  const [loading, setLoading] = useState(false);

  return (
    <ScreenShell title="Create Teacher">
      <Field value={fullName} onChangeText={setFullName} placeholder="Full name" />
      <Field value={email} onChangeText={setEmail} placeholder="Email" />
      <Field value={password} onChangeText={setPassword} placeholder="Temp password" />
      <Field value={school} onChangeText={setSchool} placeholder="School" />
      <Field value={country} onChangeText={setCountry} placeholder="Country" />
      <PrimaryButton
        label={loading ? "Creating..." : "Create teacher account"}
        disabled={loading}
        onPress={async () => {
          if (!fullName || !email || !password) {
            Alert.alert("Missing fields");
            return;
          }
          setLoading(true);
          try {
            await createTeacherAccount({
              email: email.trim(),
              password,
              full_name: fullName.trim(),
              school_name: school,
              country,
            });
            Alert.alert("Created", "Teacher account created.");
            setFullName("");
            setEmail("");
            setPassword("");
            setSchool("");
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : String(e));
          } finally {
            setLoading(false);
          }
        }}
      />
    </ScreenShell>
  );
}
