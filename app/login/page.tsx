"use client";

import { useActionState } from "react";

import { loginAction, type LoginActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  // D-05 / UI-SPEC Color exception: the lockout message is muted-neutral, not
  // destructive-red — distinguishes "just waiting" from "you did something wrong".
  const isLockout = state.error?.startsWith("Too many attempts");

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[360px] rounded-lg bg-zinc-100 p-6">
        <h1 className="mb-6 text-center text-xl leading-tight font-semibold text-zinc-900">
          TutorInvoice
        </h1>
        <form action={formAction} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
              className="h-11"
            />
            {state.error && (
              <p
                className={
                  isLockout
                    ? "text-sm text-zinc-500"
                    : "text-sm text-red-600"
                }
              >
                {state.error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending ? "Unlocking…" : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}
