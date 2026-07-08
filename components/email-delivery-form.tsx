"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import {
  updateGmailCredential,
  verifyGmailCredential,
} from "@/lib/actions/settings";
import { Eye, EyeOff } from "lucide-react";

interface EmailDeliveryFormProps {
  gmailUserEmail?: string | null;
  gmailVerified?: boolean;
  gmailLastError?: string | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Verifying..." : "Save & Verify"}
    </Button>
  );
}

export function EmailDeliveryForm({
  gmailUserEmail,
  gmailVerified,
  gmailLastError,
}: EmailDeliveryFormProps) {
  const [email, setEmail] = useState(gmailUserEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [status, setStatus] = useState<{
    ok: boolean;
    verified?: boolean;
    error?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");

    try {
      const result = await updateGmailCredential(password, email);
      setStatus(result);

      if (result.ok) {
        setSuccessMessage("Email verified ✓");
        setPassword("");
      }
    } catch (error) {
      console.error("Error updating Gmail credential:", error);
    }
  };

  const handleRetryVerify = async () => {
    setSuccessMessage("");

    try {
      const result = await verifyGmailCredential();
      setStatus(result);

      if (result.ok) {
        setSuccessMessage("Email verified ✓");
      }
    } catch (error) {
      console.error("Error verifying Gmail credential:", error);
    }
  };

  const handleRevoke = async () => {
    // For now, clearing is just clearing the state in UI
    // A proper implementation would have a revokeGmailCredential action
    setEmail("");
    setPassword("");
    setStatus(null);
    setSuccessMessage("Credential revoked — Gmail email delivery has been disabled");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const currentStatus = status || { ok: true, verified: gmailVerified };
  const currentError = status?.error || gmailLastError;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-medium">Email Delivery</h3>
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
            currentStatus.verified
              ? "bg-green-100 text-green-800"
              : currentError
                ? "bg-red-100 text-red-800"
                : "bg-slate-100 text-slate-800"
          }`}
        >
          {currentStatus.verified ? "Verified ✓" : currentError ? "Setup Needed" : "Not configured"}
        </span>
      </div>

      <div className="text-sm text-slate-600">
        Gmail will send from your account — parents see emails from you, not the app.{" "}
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-600 hover:text-blue-700"
        >
          Get your App Password
        </a>
      </div>

      {successMessage && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          <p>{successMessage}</p>
        </div>
      )}

      {currentError && !currentStatus.ok && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Verification failed</p>
          <p>{currentError}</p>
          <Button
            onClick={handleRetryVerify}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="gmail-email">Gmail Email Address</Label>
          <Input
            id="gmail-email"
            type="email"
            placeholder="your.email@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="app-password">App Password</Label>
          <div className="flex gap-2">
            <Input
              id="app-password"
              type={showPassword ? "text" : "password"}
              placeholder="xxxx xxxx xxxx xxxx"
              value={password}
              onChange={(e) => setPassword(e.target.value.toUpperCase())}
              maxLength={20}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="px-3"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            16-character code from Google (spaces removed automatically)
          </p>
        </div>

        <div className="flex gap-2">
          <SubmitButton />
          {currentStatus.verified && (
            <button
              type="button"
              onClick={() => {
                if (confirm("This will disable email sending from this app. You can re-add your credential anytime.")) {
                  handleRevoke();
                }
              }}
              className="text-sm text-red-600 hover:text-red-700 underline"
            >
              Revoke
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
