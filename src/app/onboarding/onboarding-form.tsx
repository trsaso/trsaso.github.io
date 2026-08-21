"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/auth";
import { onboardAction } from "@/app/(auth)/actions";

export function OnboardingForm() {
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { orgName: "", siteName: "", siteCode: "" },
  });

  function onSubmit(values: OnboardingInput) {
    startTransition(async () => {
      const result = await onboardAction(values);
      if (result?.error) {
        toast.error(result.error);
      }
      // On success the server action redirects to /today.
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="orgName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Pelagonia Marble" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="siteName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First site</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Sivec White Marble Quarry"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A quarry, pit, or processing plant. Add more sites later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="siteCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site code</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. SIVEC"
                  className="uppercase"
                  maxLength={16}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Short code used on reports and exports.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Creating your operation…
            </>
          ) : (
            <>
              <Factory aria-hidden="true" />
              Create organization
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
