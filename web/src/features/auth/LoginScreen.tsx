import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { Button } from "../../ui/Button";
import "./LoginScreen.css";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/login", { password });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "RATE_LIMITED"
          ? "Too many attempts. Wait a moment, then try again."
          : "That password didn't work.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login__mark" aria-hidden="true">฿</div>
      <h1 className="login__title">xpenses</h1>
      <p className="login__sub">Your ledger, locked to one key.</p>

      <form className="login__form" onSubmit={submit}>
        <input
          className="login__input"
          type="password"
          inputMode="text"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          aria-label="Password"
          aria-invalid={!!error}
          autoFocus
        />
        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" block disabled={!password || busy}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
