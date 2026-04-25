"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";

// Static, evidence-based diet guidance for the patient and family. Not
// an interactive surface — a one-page reference card.
export default function DietGuidePage() {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <Link
        href="/nutrition"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === "zh" ? "返回" : "Back"}
      </Link>

      <PageHeader
        eyebrow={locale === "zh" ? "饮食策略" : "DIET STRATEGY"}
        title={
          locale === "zh"
            ? "为什么这样吃"
            : "Why we eat this way"
        }
        subtitle={
          locale === "zh"
            ? "胰腺癌 + 化疗的功能保留方案。"
            : "Function preservation through PDAC + chemo."
        }
      />

      {locale === "zh" ? <ContentZH /> : <ContentEN />}
    </div>
  );
}

function ContentEN() {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">The four priorities</h3>
          <ol className="ml-4 list-decimal space-y-1.5 text-[13px] text-ink-700">
            <li>
              <strong>Protein ≥ 1.2 g/kg/day.</strong> Sarcopenic loss is the
              main driver of ECOG drift on chemo. Lean mass protects function
              for daraxonrasib eligibility.
            </li>
            <li>
              <strong>Energy density without carb load.</strong> Olive oil,
              avocado, fatty fish, eggs. Net carbs ≤ 50 g/day works for most
              days; relax it on poor-appetite days.
            </li>
            <li>
              <strong>PERT (Creon) with every meal containing fat.</strong> The
              pancreas can&apos;t make enough lipase. Untreated steatorrhoea =
              malabsorption + accelerated weight loss.
            </li>
            <li>
              <strong>Hydration.</strong> ~2 L/day, more on chemo infusion days
              and when nauseated. Bone broth and electrolyte drinks count.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Why low-carb / keto</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            Hyperglycaemic spikes correlate with worse PDAC outcomes
            (Wolpin 2009, Liao 2019). Tumour cells are heavy glucose
            consumers. A relaxed-keto pattern (50 g net carbs) reduces
            glycaemic load without the strict-keto compliance burden during
            chemo. It also stabilises energy through long infusion days.
          </p>
          <p className="text-[13px] leading-snug text-ink-700">
            Strict ketogenic diets (&lt; 20 g) have shown safety and
            feasibility in PDAC pilot studies (Cohen 2018), but adherence
            during cytotoxic chemo is hard. Aim for moderate; honour the
            patient&apos;s appetite.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Net carbs explained</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            <span className="mono">net carbs = total − fibre − sugar alcohols</span>.
            Fibre doesn&apos;t raise blood glucose; sugar alcohols mostly don&apos;t.
            Use net carbs as the daily counter, not total. The picker
            colour-codes every food this way.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">PERT (Creon)</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            Standard initial dose: <span className="mono">25,000–50,000</span> units of
            lipase with main meals, half that with snacks. Take{" "}
            <em>before</em> the first bite. If steatorrhoea continues, the
            dose is too low — discuss with the dietitian / Dr Ananda.
          </p>
          <p className="text-[13px] leading-snug text-ink-700">
            The dashboard flags any meal logged with ≥ 15 g fat as a PERT
            prompt. Tap the prompt once you&apos;ve taken the dose.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Bad days playbook</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>Mucositis:</strong> rice congee, steamed egg custard,
              soft tofu, smoothies with whey.
            </li>
            <li>
              <strong>Nausea:</strong> bone broth, plain rice, cucumber, ginger
              tea. Small frequent sips.
            </li>
            <li>
              <strong>Diarrhoea:</strong> banana, white rice, plain toast,
              cooked apple. Stop dairy temporarily. Replace electrolytes.
            </li>
            <li>
              <strong>No appetite:</strong> Ensure Plus or whey + full-fat milk
              shake. Liquid calories beat zero calories.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">Red flags</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>≥ 5% weight loss in a month → tell the team.</li>
            <li>≥ 2 days of &quot;couldn&apos;t eat anything&quot; → tell the team.</li>
            <li>Persistent oily/floating stools despite PERT → re-dose with team.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ContentZH() {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">四个核心目标</h3>
          <ol className="ml-4 list-decimal space-y-1.5 text-[13px] text-ink-700">
            <li>
              <strong>蛋白 ≥ 1.2 g/公斤/天。</strong>
              化疗期最大的功能损失来源是肌肉流失。保住瘦肉量
              = 保住 ECOG = 保住将来用 daraxonrasib 的机会。
            </li>
            <li>
              <strong>高热量密度，控制碳水。</strong>
              橄榄油、牛油果、深海鱼、鸡蛋。每天净碳水
              ≤ 50g 是合理目标；食欲差时可放宽。
            </li>
            <li>
              <strong>含脂肪的餐配胰酶 (Creon)。</strong>
              胰腺产生的脂肪酶不够，未补酶就会导致脂肪泻
              和加速消瘦。
            </li>
            <li>
              <strong>充足水分。</strong>
              每天 ~2L，化疗当天和恶心时更多。骨头汤、电
              解质饮料也算。
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">为什么低碳水</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            血糖剧烈波动与胰腺癌的预后相关 (Wolpin 2009 等)。
            肿瘤细胞是糖的大户。50g 净碳水的&quot;宽松生酮&quot;既能
            降低糖负荷，也比严格生酮 (&lt;20g) 更易在化疗期间坚持。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">净碳水的算法</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            <span className="mono">净碳水 = 总碳水 − 纤维 − 糖醇</span>。
            纤维不升血糖，糖醇大部分也不升。每日记录看的是净
            碳水。挑选食物时直接看色块即可。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">胰酶 (Creon)</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            正餐建议剂量 <span className="mono">25,000–50,000</span> 单位脂肪酶；
            加餐减半。请在开始吃饭前服用。如果仍有脂肪泻，
            说明剂量不足，请与 Sumitra 医生或营养师讨论加量。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">不舒服时怎么吃</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>口腔溃疡：</strong>白粥、蒸蛋羹、嫩豆腐、加蛋白粉的奶昔。
            </li>
            <li>
              <strong>恶心：</strong>骨头汤、清米饭、黄瓜、姜茶，少量多次。
            </li>
            <li>
              <strong>腹泻：</strong>香蕉、白米、白吐司、煮苹果。暂停乳制品，补电解质。
            </li>
            <li>
              <strong>没胃口：</strong>Ensure Plus 或乳清蛋白 + 全脂牛奶。喝下去比一口不吃强。
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">需要警惕的信号</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>一个月内体重下降 ≥ 5% → 通知医生。</li>
            <li>连续两天几乎没吃东西 → 通知医生。</li>
            <li>已服胰酶但仍持续脂肪泻 → 重新调整剂量。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
