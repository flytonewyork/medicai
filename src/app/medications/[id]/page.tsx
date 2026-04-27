"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Disclosure } from "~/components/ui/disclosure";
import { Alert } from "~/components/ui/alert";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function MedicationDetailPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const drugId = params?.id as string;

  const drug = drugId ? DRUGS_BY_ID[drugId] : undefined;

  if (!drug) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <PageHeader title="Drug not found" />
        <p className="text-ink-500">
          No medication with ID <code>{drugId}</code> in registry.
        </p>
        <Link href="/medications">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to medications
          </Button>
        </Link>
      </div>
    );
  }

  const displayName = locale === "zh" ? drug.name.zh : drug.name.en;
  const displayClass = locale === "zh" ? drug.drug_class.zh : drug.drug_class.en;
  const displayMechanism =
    locale === "zh" ? drug.mechanism.zh : drug.mechanism.en;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={displayClass}
        title={displayName}
        action={
          <Link href="/medications">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        }
      />

      {drug.aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {drug.aliases.map((alias) => (
            <span key={alias} className="a-chip">
              {alias}
            </span>
          ))}
        </div>
      )}

      {/* Mechanism */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-ink-700">
          <p>{displayMechanism}</p>
          {drug.clinical_note && (
            <p className="mt-3 border-t border-ink-100 pt-3 text-xs italic text-ink-500">
              {locale === "zh"
                ? drug.clinical_note.zh
                : drug.clinical_note.en}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dosing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dosing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {drug.typical_doses.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Typical doses</p>
              <ul className="space-y-1">
                {drug.typical_doses.map((dose, i) => (
                  <li key={i} className="text-sm text-ink-700">
                    {locale === "zh" ? dose.zh : dose.en}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {drug.default_schedules.length > 0 && (
            <div className="border-t border-ink-100 pt-3">
              <p className="eyebrow mb-2">Schedule</p>
              <ul className="space-y-2">
                {drug.default_schedules.map((sched, i) => (
                  <li
                    key={i}
                    className="rounded-[var(--r-sm)] bg-ink-100/60 p-2.5 text-sm"
                  >
                    <div className="font-medium text-ink-900">
                      {sched.label
                        ? locale === "zh"
                          ? sched.label.zh
                          : sched.label.en
                        : `Schedule ${i + 1}`}
                    </div>
                    {sched.kind && (
                      <div className="mono mt-1 text-[11px] text-ink-500">
                        {sched.kind}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Side Effects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Side Effects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {drug.side_effects.common.length > 0 && (
            <Disclosure
              label="Common (usually mild or manageable)"
              defaultOpen={true}
            >
              <ul className="space-y-2 text-sm">
                {drug.side_effects.common.map((effect, i) => (
                  <li key={i} className="flex gap-2 text-ink-700">
                    <span className="text-ink-300">•</span>
                    <span>
                      {locale === "zh" ? effect.zh : effect.en}
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}

          {drug.side_effects.serious.length > 0 && (
            <Disclosure
              label="Serious (require immediate attention)"
              defaultOpen={true}
            >
              <ul className="space-y-2 text-sm">
                {drug.side_effects.serious.map((effect, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[var(--warn)]"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden
                    />
                    <span>
                      {locale === "zh" ? effect.zh : effect.en}
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </CardContent>
      </Card>

      {/* Monitoring */}
      {drug.monitoring.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {drug.monitoring.map((monitor, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                  <ArrowRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-300"
                    aria-hidden
                  />
                  <span>
                    {locale === "zh" ? monitor.zh : monitor.en}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Diet Interactions */}
      {drug.diet_interactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diet & Food Interactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {drug.diet_interactions.map((interaction, i) => (
              <Alert
                key={i}
                variant={interaction.severity === "warning" ? "warn" : "info"}
                title={
                  locale === "zh"
                    ? interaction.food.zh
                    : interaction.food.en
                }
              >
                {locale === "zh"
                  ? interaction.effect.zh
                  : interaction.effect.en}
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Back link */}
      <div className="border-t border-ink-100 pt-4">
        <Link href="/medications">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to all medications
          </Button>
        </Link>
      </div>
    </div>
  );
}
