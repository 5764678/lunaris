"use client";

import { Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeError } from "@/lib/api/client";
import { useCreateSite } from "@/lib/api/queries";
import { validateCoordinateInput, type CoordinateInputErrors } from "@/lib/geo/selenographic";
import { useMissionStore } from "@/store/mission-store";

/** Register a user-defined candidate site by planetocentric MOON_ME coordinates. */
export function SiteForm({ disabled }: { disabled?: boolean }) {
  const formId = useId();
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [errors, setErrors] = useState<CoordinateInputErrors & { name?: string }>({});
  const createSite = useCreateSite();
  const selectSite = useMissionStore((s) => s.selectSite);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: CoordinateInputErrors & { name?: string } = validateCoordinateInput(
      latitude,
      longitude,
    );
    if (!name.trim()) nextErrors.name = "Enter a name.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    createSite.mutate(
      { name: name.trim(), latitude_deg: Number(latitude), longitude_deg: Number(longitude) },
      {
        onSuccess: (site) => {
          setName("");
          setLatitude("");
          setLongitude("");
          selectSite(site.id);
        },
      },
    );
  }

  const fieldError = (key: keyof typeof errors) =>
    errors[key] ? (
      <p id={`${formId}-${key}-error`} className="mt-1 text-3xs text-critical">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Register candidate site" className="space-y-2">
      <div>
        <Label htmlFor={`${formId}-name`}>Site name</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ridge survey point A"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${formId}-name-error` : undefined}
          disabled={disabled}
          className="mt-1"
        />
        {fieldError("name")}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <div>
          <Label htmlFor={`${formId}-lat`}>Lat °</Label>
          <Input
            id={`${formId}-lat`}
            name="latitude_deg"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="−89.450"
            aria-invalid={Boolean(errors.latitude)}
            aria-describedby={errors.latitude ? `${formId}-latitude-error` : undefined}
            disabled={disabled}
            className="numeric mt-1 font-mono"
          />
        </div>
        <div>
          <Label htmlFor={`${formId}-lon`}>Lon °E</Label>
          <Input
            id={`${formId}-lon`}
            name="longitude_deg"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="222.690"
            aria-invalid={Boolean(errors.longitude)}
            aria-describedby={errors.longitude ? `${formId}-longitude-error` : undefined}
            disabled={disabled}
            className="numeric mt-1 font-mono"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled || createSite.isPending}
          aria-label="Add site"
        >
          <Plus />
          {createSite.isPending ? "Adding…" : "Add"}
        </Button>
      </div>
      {fieldError("latitude")}
      {fieldError("longitude")}
      {createSite.isError && (
        <p role="alert" className="text-3xs text-critical">
          {describeError(createSite.error)}
        </p>
      )}
      <p className="text-3xs leading-relaxed text-dim">
        Planetocentric latitude, east longitude (−180…360 accepted, stored 0…360), frame MOON_ME. Sites added
        here are user-defined (USER); cited sites come only from the published catalogue (CITED).
      </p>
    </form>
  );
}
