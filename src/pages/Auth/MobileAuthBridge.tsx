import { useEffect, useState } from "react";

const APP_DEEP_LINK = "motherofmath://auth/callback";

/**
 * Tiny HTTPS bridge for mobile Google OAuth.
 *
 * Supabase can redirect to this site URL after Google. We must NOT exchange the
 * PKCE `code` here (the verifier lives in the mobile app). We immediately forward
 * query + hash to the app deep link so the in-app browser closes and the app
 * finishes sign-in.
 */
const MobileAuthBridge = () => {
  const [message, setMessage] = useState("Opening the Mama Math app…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      const fail = new URLSearchParams();
      fail.set("error", error);
      if (errorDescription) fail.set("error_description", errorDescription);
      window.location.href = `${APP_DEEP_LINK}?${fail.toString()}`;
      setMessage("Sign-in failed. Returning to the app…");
      return;
    }

    // Forward Supabase params (code, etc.) and any hash tokens untouched.
    const search = window.location.search; // includes leading ?
    const hash = window.location.hash; // includes leading #
    window.location.href = `${APP_DEEP_LINK}${search}${hash}`;

    // If the deep link doesn't close the sheet (rare), show a manual tip.
    const t = window.setTimeout(() => {
      setMessage(
        "If the app did not open, close this window and return to Mama Math.",
      );
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ecfdf5",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "28px 24px",
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 16px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #009E3F, #047857)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 22,
          }}
        >
          M
        </div>
        <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>{message}</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
          Completing Google sign-in…
        </p>
      </div>
    </div>
  );
};

export default MobileAuthBridge;
