"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveSettingsAction, type SettingsActionState } from "@/lib/actions/settings";
import { US_TIMEZONES } from "@/lib/settings/timezones";

const initialState: SettingsActionState = { fieldErrors: null };

interface SettingsFormProps {
  zelleHandle: string;
  subjectTemplate: string;
  bodyTemplate: string;
  timezone: string | null;
  invoiceCadenceEnabled: boolean;
  invoiceCadenceDay: number | null;
  invoiceCadenceLastDay: boolean;
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

  // SET-03 / D-11: the timezone Select defaults to the stored zone, or — on a
  // first visit (props.timezone null) — the BROWSER-detected zone. The server
  // can't know the browser zone, so detection is derived via
  // useSyncExternalStore (server snapshot "", client snapshot the real zone),
  // which resolves the value on the client with NO hydration mismatch and no
  // setState-in-effect. A user selection then overrides it.
  const detectedTz = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  const [override, setOverride] = useState<string | null>(
    props.timezone ?? null,
  );
  const tz = override ?? detectedTz;

  // Inject the current zone as its own option when it's not in the US
  // shortlist, so her real zone is selectable and never silently dropped.
  const tzOptions =
    tz && !US_TIMEZONES.some((option) => option.value === tz)
      ? [{ value: tz, label: `${tz} (detected)` }, ...US_TIMEZONES]
      : US_TIMEZONES;

  // RINV-01: cadence configuration state
  const [cadenceEnabled, setCadenceEnabled] = useState<string>(
    props.invoiceCadenceEnabled ? "on" : "off",
  );
  const cadenceDaySel =
    props.invoiceCadenceLastDay ? "last" : (props.invoiceCadenceDay?.toString() ?? "1");
  const [cadenceDay, setCadenceDay] = useState<string>(cadenceDaySel);

  const handleCadenceEnabledChange = (value: string | null) => {
    if (value !== null) setCadenceEnabled(value);
  };

  const handleCadenceDayChange = (value: string | null) => {
    if (value !== null) setCadenceDay(value);
  };

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

      <div className="flex flex-col gap-2">
        <Label>Timezone</Label>
        <p className="text-sm text-zinc-600">
          Used later to schedule classes and time invoices.
        </p>
        <Select
          value={tz}
          onValueChange={(value) => setOverride(value as string)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            {tzOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Mirror the Select value into the form submit (same hidden-input
            pattern session-form-dialog uses for studentId/date). */}
        <input type="hidden" name="timezone" value={tz} />
        {state.fieldErrors?.timezone && (
          <p className="text-sm text-red-600">
            {state.fieldErrors.timezone[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Automatic Invoicing</Label>
        <p className="text-sm text-zinc-600">
          Enable to auto-generate invoices on a monthly cadence.
        </p>
        <Select value={cadenceEnabled} onValueChange={handleCadenceEnabledChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on">On</SelectItem>
            <SelectItem value="off">Off</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="invoiceCadenceEnabled" value={cadenceEnabled} />

        <Label className="mt-4">Invoice Day of Month</Label>
        <p className="text-sm text-zinc-600">
          The run fires monthly on this day; late/skipped runs self-heal the next day.
        </p>
        <Select value={cadenceDay} onValueChange={handleCadenceDayChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select day" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <SelectItem key={day} value={day.toString()}>
                {day}
              </SelectItem>
            ))}
            <SelectItem value="last">Last day of month</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="invoiceCadenceLastDay"
          value={cadenceDay === "last" ? "on" : "off"}
        />
        <input
          type="hidden"
          name="invoiceCadenceDay"
          value={cadenceDay === "last" ? "" : cadenceDay}
        />
        {state.fieldErrors?.invoiceCadenceDay && (
          <p className="text-sm text-red-600">
            {state.fieldErrors.invoiceCadenceDay[0]}
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
