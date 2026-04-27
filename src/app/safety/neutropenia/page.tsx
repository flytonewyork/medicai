"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Cite } from "~/components/nutrition/cite";
import { getSource } from "~/lib/nutrition/sources";

// "Reducing your risk of infection during cancer treatment" —
// Cancer Institute NSW (eviq.org.au), Jan 2025. Distributed by JPCC.
// Bilingual rendering. The infection-risk peak is days 7–14 after
// each dose (the "nadir" phase), so the feed nudge points here when
// the patient enters that window.

export default function NeutropeniaPage() {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <Link
        href="/safety"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === "zh" ? "返回" : "Back"}
      </Link>

      <PageHeader
        eyebrow={locale === "zh" ? "感染防护" : "INFECTION PREVENTION"}
        title={
          locale === "zh"
            ? "免疫力低时如何避免感染"
            : "Protecting yourself when your white cells are low"
        }
        subtitle={
          locale === "zh"
            ? "化疗后 7–14 天感染风险最高（中性粒细胞低谷）。"
            : "Infection risk peaks 7–14 days after each dose (the neutrophil nadir)."
        }
      />

      {locale === "zh" ? <ContentZH /> : <ContentEN />}
    </div>
  );
}

function ContentEN() {
  const eviq = getSource("eviq_neutropenia_2025");
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">When the risk is highest</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            The biggest risk of neutropenia and infection is{" "}
            <strong>7–14 days after each chemotherapy treatment</strong>, but
            infections can happen at any time.
            <Cite source="eviq_neutropenia_2025" />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Hand hygiene</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            Wash hands with soap and water:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>before eating or preparing meals</li>
            <li>after touching raw meat</li>
            <li>after going to the toilet</li>
            <li>after being in public places</li>
          </ul>
          <p className="text-[13px] leading-snug text-ink-700">
            Use alcohol-based hand rub if you can&apos;t access soap and water.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Look after your body</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              Brush teeth after each meal and before bed (soft brush,
              alcohol-free mouthwash).
            </li>
            <li>Shower or bath every day.</li>
            <li>Keep the bottom area clean after going to the toilet.</li>
            <li>Keep cuts and scrapes clean.</li>
            <li>Wear sunscreen.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Keep away from germs</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>Stay away from people who are sick (cold, flu, chickenpox).</li>
            <li>Try to avoid crowds.</li>
            <li>Don&apos;t share food, cups, utensils, toothbrushes.</li>
            <li>Wash or peel fruit and vegetables before eating.</li>
            <li>
              No raw fish, seafood, meat, or eggs. Cook meat well.
            </li>
            <li>
              Avoid drinking or cooking with untreated water (rainwater,
              bores, rivers). Boil and cool first if needed.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">
            Call the team or go to ED if you have:
          </h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>Temperature ≥ 38 °C</strong> — this is{" "}
              <strong>febrile neutropenia</strong> if your white cells are
              low. Urgent.
            </li>
            <li>Chills, sweats, shivers, or shakes.</li>
            <li>Headache or stiff neck.</li>
            <li>Sore throat, cough, or cold.</li>
            <li>Shortness of breath.</li>
            <li>Faint, dizzy, or fast heartbeat.</li>
            <li>Mouth sores or a white coating on the tongue.</li>
            <li>Rash or skin redness.</li>
            <li>
              Swelling, redness or tenderness — especially around a wound,
              catheter site, or rectal area.
            </li>
            <li>Uncontrolled diarrhoea or vomiting.</li>
            <li>Cloudy urine, pain or blood passing urine.</li>
          </ul>
          <p className="text-[12px] leading-snug text-ink-500">
            Tell them you are having cancer treatment.{" "}
            <strong>You can have an infection without a fever — call if you feel ill.</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Other things to watch</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>Medicines:</strong> ask before taking anything new.
              Paracetamol, aspirin, and ibuprofen can hide a fever.
            </li>
            <li>
              <strong>Vaccinations:</strong> ask the team before any vaccine.
            </li>
            <li>
              <strong>Pets:</strong> wash hands after touching them. Don&apos;t
              clean cat litter, fish tanks, bird cages, or dog poo.
            </li>
            <li>
              <strong>Gardening:</strong> gloves on; avoid compost and potting
              mix.
            </li>
            <li>
              <strong>Building / renovations:</strong> avoid the dust.
            </li>
            <li>
              <strong>Swimming:</strong> no rivers, lakes, public pools, or
              hot tubs.
            </li>
            <li>
              <strong>Dental work:</strong> talk to the team before any
              dental procedure.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">Source</h3>
          <p className="text-[12px] leading-snug text-ink-600">
            All advice on this page is drawn from{" "}
            <em>{eviq.short_label}</em> — {eviq.full_citation}
          </p>
          {eviq.url && (
            <a
              href={eviq.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-[12px] text-[var(--tide-2)] underline"
            >
              {eviq.url}
            </a>
          )}
          <p className="mt-2 text-[12px] text-ink-500">
            <Cite source="eviq_neutropenia_2025" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ContentZH() {
  const eviq = getSource("eviq_neutropenia_2025");
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">什么时候风险最高</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            <strong>每次化疗后第 7–14 天</strong>感染风险最高，但任何时候都可能发生。
            <Cite source="eviq_neutropenia_2025" />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">手卫生</h3>
          <p className="text-[13px] leading-snug text-ink-700">用肥皂和水洗手：</p>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>进食或备餐前</li>
            <li>接触生肉后</li>
            <li>如厕后</li>
            <li>外出回到家后</li>
          </ul>
          <p className="text-[13px] leading-snug text-ink-700">
            如无肥皂水可用，使用酒精洗手液。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">日常照护</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>每餐后及睡前刷牙（软毛牙刷、不含酒精的漱口水）。</li>
            <li>每天淋浴或泡澡。</li>
            <li>如厕后保持肛门会阴清洁。</li>
            <li>保持伤口清洁。</li>
            <li>外出涂防晒霜。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">远离病菌</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>避开生病的人（感冒、流感、水痘）。</li>
            <li>尽量不去人多的地方。</li>
            <li>不与他人共用饭菜、杯具、餐具、牙刷等个人用品。</li>
            <li>水果蔬菜洗净或削皮后再吃。</li>
            <li>不吃生鱼、生海鲜、生肉、生蛋。肉要彻底煮熟。</li>
            <li>不要饮用或烹调使用未经处理的水（雨水、井水、河水）；如必须使用，先煮沸后冷却再用。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">出现以下情况请立即联系医护或前往急诊</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>体温 ≥ 38 °C</strong> —— 若白细胞偏低这就是
              <strong>发热性中性粒细胞减少</strong>，需紧急处理。
            </li>
            <li>畏寒、出汗、寒颤、发抖。</li>
            <li>头痛或颈僵。</li>
            <li>咽痛、咳嗽、感冒症状。</li>
            <li>气促。</li>
            <li>头晕、晕厥、心跳加速。</li>
            <li>口腔溃疡或舌头有白苔。</li>
            <li>皮疹或皮肤发红。</li>
            <li>伤口、导管处或肛周肿胀、发红、压痛。</li>
            <li>无法控制的腹泻或呕吐。</li>
            <li>尿液浑浊、排尿疼痛或带血。</li>
          </ul>
          <p className="text-[12px] leading-snug text-ink-500">
            联系时请告知您正在接受癌症治疗。
            <strong>感染未必伴随发热 —— 感觉不适就联系医护。</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">其他注意事项</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li><strong>药物：</strong>用任何新药前先咨询医生。扑热息痛、阿司匹林、布洛芬可能掩盖发热。</li>
            <li><strong>疫苗：</strong>接种前务必询问医护。</li>
            <li><strong>宠物：</strong>触碰后洗手。不要清理猫砂、鱼缸、鸟笼或狗粪。</li>
            <li><strong>园艺：</strong>戴手套，避免接触堆肥与栽培土。</li>
            <li><strong>建筑装修：</strong>避免接触灰尘。</li>
            <li><strong>游泳：</strong>不要在江河、湖泊、公共泳池或热水浴缸中游泳。</li>
            <li><strong>牙科：</strong>任何牙科操作前先与医生沟通。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">资料来源</h3>
          <p className="text-[12px] leading-snug text-ink-600">
            本页面所有建议均出自 <em>{eviq.short_label}</em> —— {eviq.full_citation}
          </p>
          {eviq.url && (
            <a
              href={eviq.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-[12px] text-[var(--tide-2)] underline"
            >
              {eviq.url}
            </a>
          )}
          <p className="mt-2 text-[12px] text-ink-500">
            <Cite source="eviq_neutropenia_2025" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
