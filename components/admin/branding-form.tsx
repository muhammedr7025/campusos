"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { brandingSchema, type BrandingInput } from "@/lib/validators/tenant";
import { updateBranding, uploadBrandingAsset } from "@/lib/actions/tenant";

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#([0-9a-fA-F]{6})$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded border"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </Field>
  );
}

export function BrandingForm({ initial }: { initial: BrandingInput }) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BrandingInput>({ resolver: zodResolver(brandingSchema), defaultValues: initial });

  const values = watch();

  async function onSubmit(data: BrandingInput) {
    const result = await updateBranding(data);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Branding updated.");
    router.refresh();
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadBrandingAsset(formData);
    setUploadingLogo(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setValue("logoUrl", result.data.url, { shouldDirty: true });
    toast.success("Logo uploaded.");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Institute name</FieldLabel>
            <Input id="name" {...register("name")} />
            <FieldError errors={errors.name ? [errors.name] : undefined} />
          </Field>

          <Field>
            <FieldLabel>Logo</FieldLabel>
            <div className="flex items-center gap-2">
              <Input placeholder="https://…" {...register("logoUrl")} />
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
              <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? <Loader2 className="animate-spin" /> : <Upload />}
              </Button>
            </div>
          </Field>

          <ColorField label="Primary color" value={values.primaryColor} onChange={(v) => setValue("primaryColor", v)} error={errors.primaryColor?.message} />
          <ColorField label="Secondary color" value={values.secondaryColor} onChange={(v) => setValue("secondaryColor", v)} error={errors.secondaryColor?.message} />
          <ColorField label="Accent color" value={values.accentColor} onChange={(v) => setValue("accentColor", v)} error={errors.accentColor?.message} />
        </FieldGroup>

        <Button type="submit" className="mt-6" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save branding
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm font-medium">Live preview</p>
        <Card style={{ borderColor: values.secondaryColor }}>
          <CardContent
            className="flex flex-col gap-4 rounded-lg p-6"
            style={{ background: values.secondaryColor }}
          >
            <div className="flex items-center gap-2">
              {values.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.logoUrl} alt="Logo" className="size-8 rounded" />
              ) : (
                <div
                  className="flex size-8 items-center justify-center rounded text-sm font-semibold text-white"
                  style={{ background: values.primaryColor }}
                >
                  {values.name.charAt(0) || "?"}
                </div>
              )}
              <span className="font-semibold">{values.name || "Institute name"}</span>
            </div>
            <button
              type="button"
              className="w-fit rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ background: values.primaryColor }}
            >
              Primary button
            </button>
            <span
              className="w-fit rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ background: values.accentColor }}
            >
              Accent badge
            </span>
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-xs">Save to apply this everywhere — nav, buttons, and badges across the whole institute.</p>
      </div>
    </div>
  );
}
