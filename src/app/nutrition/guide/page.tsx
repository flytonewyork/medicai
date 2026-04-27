"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Cite } from "~/components/nutrition/cite";
import { getSource } from "~/lib/nutrition/sources";

// Static, evidence-based diet guidance for the patient and family.
// Every clinical claim carries an inline citation pill (Cite) that
// expands to the full reference + Ryan Surace's contact details, so
// the family reads "JPCC Nutrition Guide says X" not "Anchor says X".

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
            : "Function preservation through pancreatic cancer + chemo."
        }
      />

      {locale === "zh" ? <ContentZH /> : <ContentEN />}
    </div>
  );
}

function ContentEN() {
  const jpcc = getSource("jpcc_2021");
  return (
    <div className="space-y-3">
      <Link
        href="/safety"
        className="block rounded-md border border-ink-100 bg-paper-2/40 px-4 py-2.5 text-[12px] text-ink-700 hover:border-ink-300"
      >
        See also: <strong>chemo safety at home</strong> and{" "}
        <strong>neutropenia / infection prevention</strong> →
      </Link>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Two policies, one strategy</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            Anchor runs <strong>two</strong> dietary playbooks and switches
            between them based on your weight and appetite. The dashboard
            tells you which one is active.
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>Low-carb</strong> when weight is stable and appetite is
              good — protects lean mass and limits glycaemic load.
              <Cite source="wolpin_2009" />
              <Cite source="cohen_2018" />
            </li>
            <li>
              <strong>Energy-dense</strong> when weight is dropping or
              appetite is poor — calories first, composition second.
              <Cite source="jpcc_2021" page={9} />
              <Cite source="hendifar_2019" />
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">The four priorities</h3>
          <ol className="ml-4 list-decimal space-y-1.5 text-[13px] text-ink-700">
            <li>
              <strong>Protein ≥ 1.2 g/kg/day.</strong> Sarcopenic loss is the
              main driver of ECOG drift on chemo. Lean mass protects function
              for daraxonrasib eligibility.
              <Cite source="mueller_2014" />
            </li>
            <li>
              <strong>Energy density.</strong> Olive oil, avocado, fatty fish,
              eggs, full-cream milk. In energy-dense mode, also cream, honey,
              cheese, milky desserts (the JPCC &ldquo;adding principle&rdquo;).
              <Cite source="jpcc_2021" page={21} />
            </li>
            <li>
              <strong>PERT (Creon) with every meal containing protein or fat.</strong>{" "}
              The pancreas can&apos;t make enough lipase. Untreated steatorrhoea =
              malabsorption + accelerated weight loss.
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              <strong>Hydration.</strong> ~2 L/day, more on chemo infusion days
              and when nauseated. Bone broth, electrolyte drinks count.
              <Cite source="jpcc_2021" page={13} />
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Why low-carb when stable</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            Hyperglycaemic spikes correlate with worse pancreatic-cancer outcomes.
            <Cite source="wolpin_2009" /> A relaxed-keto pattern (≤ 50 g net
            carbs) reduces glycaemic load without the strict-keto
            compliance burden during chemo, and stabilises energy through
            long infusion days.
            <Cite source="cohen_2018" />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">
            Why energy-dense during cachexia
          </h3>
          <p className="text-[13px] leading-snug text-ink-700">
            85% of pancreatic cancer patients lose weight at diagnosis; 80%
            develop cachexia.
            <Cite source="jpcc_2021" page={6} />
            <Cite source="hendifar_2019" />
            When weight is dropping, calories trump composition. The JPCC
            adding principle: full-cream milk in porridge instead of water,
            cream in soups, honey in drinks, cheese on sandwiches, olive oil
            on cooked vegetables.
            <Cite source="jpcc_2021" page={21} />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">PERT (Creon) — the JPCC rules</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              Take with the <em>first mouthful</em> of any meal or snack
              containing protein or fat.
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              <strong>No PERT needed</strong> for fruit, jelly, soft drink,
              juice, water, black tea, black coffee.
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              Split the dose if the meal lasts &gt; 30 minutes.
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              Forgot at the start? Take it halfway through. Remembered
              after the meal? Skip until next meal.
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              Standard initial dose: <span className="mono">25,000–50,000</span>{" "}
              units lipase with main meals; half that with snacks. Titrate
              with Dr Ananda / dietitian if steatorrhoea continues.
            </li>
            <li>Store away from heat (out of sunlight, away from ovens).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">Red flags</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              ≥ 5% weight loss in a month → tell the team.
              <Cite source="jpcc_2021" page={25} />
            </li>
            <li>≥ 2 days of &quot;couldn&apos;t eat anything&quot; → tell the team.</li>
            <li>Persistent oily/floating stools despite PERT → re-dose with team.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">Local source of this advice</h3>
          <p className="text-[12px] leading-snug text-ink-600">
            Most of this page is drawn from the{" "}
            <em>{jpcc.short_label}</em>, written by{" "}
            <strong>{jpcc.author}</strong>. If anything is unclear or you
            want personalised advice:
          </p>
          <p className="mono mt-1 text-[12px] text-ink-700">
            {jpcc.contact}
          </p>
          {jpcc.url && (
            <a
              href={jpcc.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-[12px] text-[var(--tide-2)] underline"
            >
              {jpcc.url}
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContentZH() {
  const jpcc = getSource("jpcc_2021");
  return (
    <div className="space-y-3">
      <Link
        href="/safety"
        className="block rounded-md border border-ink-100 bg-paper-2/40 px-4 py-2.5 text-[12px] text-ink-700 hover:border-ink-300"
      >
        另请参阅：<strong>居家化疗安全</strong> 与{" "}
        <strong>感染防护（中性粒细胞低谷）</strong> →
      </Link>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">两套方案，一个目标</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            Anchor 同时维护<strong>两套</strong>饮食方案，根据体重和食欲自动切换。
            主页会告诉你当前用的是哪一套。
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>低碳水</strong>：体重稳定、食欲良好时使用 ——
              保护瘦肉量、控制糖负荷。
              <Cite source="wolpin_2009" />
              <Cite source="cohen_2018" />
            </li>
            <li>
              <strong>高能量密度</strong>：体重下降或食欲差时使用 ——
              先保热量，再讲配比。
              <Cite source="jpcc_2021" page={9} />
              <Cite source="hendifar_2019" />
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">四个核心目标</h3>
          <ol className="ml-4 list-decimal space-y-1.5 text-[13px] text-ink-700">
            <li>
              <strong>蛋白 ≥ 1.2 g/公斤/天。</strong>
              化疗期最大的功能损失是肌肉流失。保住瘦肉量
              = 保住 ECOG = 保住将来用 daraxonrasib 的机会。
              <Cite source="mueller_2014" />
            </li>
            <li>
              <strong>高热量密度。</strong>
              橄榄油、牛油果、深海鱼、鸡蛋、全脂奶。
              当切换到&quot;高能量密度&quot;时，再加奶油、蜂蜜、奶酪、奶制甜品（JPCC&quot;加料原则&quot;）。
              <Cite source="jpcc_2021" page={21} />
            </li>
            <li>
              <strong>含蛋白或脂肪的餐配胰酶 (Creon)。</strong>
              胰腺产生的脂肪酶不够，未补酶就会导致脂肪泻和加速消瘦。
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              <strong>充足水分。</strong>
              每天 ~2L，化疗当天和恶心时更多。骨头汤、电解质饮料也算。
              <Cite source="jpcc_2021" page={13} />
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">稳定时为什么用低碳水</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            血糖剧烈波动与胰腺癌预后相关。
            <Cite source="wolpin_2009" />
            50g 净碳水的&quot;宽松生酮&quot;既能降低糖负荷，
            也比严格生酮 (&lt;20g) 更易在化疗期间坚持。
            <Cite source="cohen_2018" />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">消瘦时为什么改高能量密度</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            85% 的胰腺癌患者在确诊时已有体重下降；80% 会发生恶病质。
            <Cite source="jpcc_2021" page={6} />
            <Cite source="hendifar_2019" />
            体重在掉时，热量比配比更重要。JPCC 加料原则：
            煮粥用全脂奶代替水、汤里加奶油、饮料加蜂蜜、三明治加奶酪、熟蔬菜淋橄榄油。
            <Cite source="jpcc_2021" page={21} />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">胰酶 (Creon) —— JPCC 用法</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              开始进餐<em>第一口</em>时服用，正餐和含蛋白/脂肪的加餐都要。
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              <strong>不需要补酶</strong>：水果、果冻、汽水、果汁、水、清茶、清咖啡。
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              用餐时间超过 30 分钟时分次服用。
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              开始忘了？吃到一半补也行。整餐结束后才想起？跳过，下一餐再服。
              <Cite source="jpcc_2021" page={19} />
            </li>
            <li>
              正餐建议剂量 <span className="mono">25,000–50,000</span> 单位脂肪酶；
              加餐减半。如果仍有脂肪泻，请与肿瘤科医生或营养师调整。
            </li>
            <li>避热保存（避免阳光、远离烤箱）。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">需要警惕的信号</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              一个月内体重下降 ≥ 5% → 通知医生。
              <Cite source="jpcc_2021" page={25} />
            </li>
            <li>连续两天几乎没吃东西 → 通知医生。</li>
            <li>已服胰酶但仍持续脂肪泻 → 重新调整剂量。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <h3 className="serif text-base text-ink-900">本页内容来自</h3>
          <p className="text-[12px] leading-snug text-ink-600">
            本页主要内容来自 <em>{jpcc.short_label}</em>，作者：
            <strong>Ryan Surace（Epworth Richmond 高级营养师）</strong>。
            如有疑问或需要个性化建议，请联系：
          </p>
          <p className="mono mt-1 text-[12px] text-ink-700">{jpcc.contact}</p>
          {jpcc.url && (
            <a
              href={jpcc.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-[12px] text-[var(--tide-2)] underline"
            >
              {jpcc.url}
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
