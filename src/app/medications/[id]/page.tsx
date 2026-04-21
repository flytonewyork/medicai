"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Disclosure } from "~/components/ui/disclosure";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function MedicationDetailPage() {
  const locale = useLocale();
  const t = useT();
  const params = useParams<{ id: string }>();
  const drugId = params?.id as string;

  const drug = drugId ? DRUGS_BY_ID[drugId] : undefined;

  if (!drug) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <PageHeader title="Drug not found" />
        <p className="text-ink-500">No medication with ID "{drugId}" in registry.</p>
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
      <div className="flex items-center gap-2">
        <Link href="/medications">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{displayName}</h1>
          <p className="text-sm text-ink-500">{displayClass}</p>
        </div>
      </div>

      {drug.aliases.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {drug.aliases.map((alias) => (
            <span
              key={alias}
              className="rounded-full bg-paper-1 px-2.5 py-1 text-xs font-medium text-ink-600"
            >
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
              <p className="mb-2 text-xs font-semibold uppercase text-ink-500">
                Typical doses
              </p>
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
              <p className="mb-2 text-xs font-semibold uppercase text-ink-500">
                Schedule
              </p>
              <ul className="space-y-2">
                {drug.default_schedules.map((sched, i) => (
                  <li key={i} className="rounded bg-paper-1 p-2 text-sm">
                    <div className="font-medium text-ink-900">
                      {sched.label
                        ? locale === "zh"
                          ? sched.label.zh
                          : sched.label.en
                        : `Schedule ${i + 1}`}
                    </div>
                    {sched.kind && (
                      <div className="mt-1 text-xs text-ink-500">
                        Kind: <span className="font-mono">{sched.kind}</span>
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
              title="Common (usually mild or manageable)"
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
              title="Serious (require immediate attention)"
              defaultOpen={true}
            >
              <ul className="space-y-2 text-sm">
                {drug.side_effects.serious.map((effect, i) => (
                  <li key={i} className="flex gap-2 text-red-700">
                    <span className="font-bold text-red-600">⚠</span>
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
                <li key={i} className="flex gap-2 text-sm text-ink-700">
                  <span className="text-ink-300">→</span>
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
              <div
                key={i}
                className={`rounded border p-3 ${
                  interaction.severity === "warning"
                    ? "border-red-200 bg-red-50"
                    : "border-yellow-200 bg-yellow-50"
                }`}
              >
                <div className="font-medium text-ink-900">
                  {locale === "zh"
                    ? interaction.food.zh
                    : interaction.food.en}
                </div>
                <div className="mt-1 text-sm text-ink-700">
                  {locale === "zh"
                    ? interaction.effect.zh
                    : interaction.effect.en}
                </div>
              </div>
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
