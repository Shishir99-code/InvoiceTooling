"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSettingsAction, type SettingsActionState } from "@/lib/actions/settings";

const initialState: SettingsActionState = { fieldErrors: null };

interface SettingsFormProps {
  zelleHandle: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

// SET-01/SET-02: a PAGE form (not a modal) — persistent settings, no
// Discard/Cancel affordance since there is nothing to discard back to.
export function SettingsForm(props: SettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveSettingsAction,
    initialState,
  );

  // Transient "Saved." flash — same "adjust state during render" idiom
  // SessionFormDialog uses to detect a fresh successful submit.
  const [saved, setSaved] = useState(false);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.fieldErrors === null) {
      setSaved(true);
    }
  }

  useEffect(() => {
    if (!saved) return;
    const timeout = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timeout);
  }, [saved]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="zelleHandle">Zelle Handle</Label>
        <p className="text-sm text-zinc-600">
          Email or phone number parents will Zelle payment to.
        </p>
        <Input
          id="zelleHandle"
          name="zelleHandle"
          type="text"
          placeholder="you@example.com or (555) 123-4567"
          defaultValue={props.zelleHandle}
        />
        {state.fieldErrors?.zelleHandle && (
          <p className="text-sm text-red-600">
            {state.fieldErrors.zelleHandle[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="subjectTemplate">Email Subject</Label>
        <p className="text-sm text-zinc-600">
          Supports {"{student}"}, {"{total}"}, {"{zelle}"}, {"{period}"}.
        </p>
        <Input
          id="subjectTemplate"
          name="subjectTemplate"
          type="text"
          defaultValue={props.subjectTemplate}
        />
        {state.fieldErrors?.subjectTemplate && (
          <p className="text-sm text-red-600">
            {state.fieldErrors.subjectTemplate[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bodyTemplate">Email Body</Label>
        <p className="text-sm text-zinc-600">
          Supports {"{invoice}"}, {"{student}"}, {"{total}"}, {"{zelle}"},{" "}
          {"{period}"}. {"{invoice}"} inserts the itemized session list and
          total.
        </p>
        <Textarea
          id="bodyTemplate"
          name="bodyTemplate"
          rows={10}
          defaultValue={props.bodyTemplate}
        />
        {state.fieldErrors?.bodyTemplate && (
          <p className="text-sm text-red-600">
            {state.fieldErrors.bodyTemplate[0]}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {isPending ? "Saving…" : "Save Settings"}
        </Button>
        {saved && <p className="text-sm text-zinc-600">Saved.</p>}
      </div>
    </form>
  );
}
