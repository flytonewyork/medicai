"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Cite } from "~/components/nutrition/cite";
import { getSource } from "~/lib/nutrition/sources";

// "Chemotherapy safety at home" — Cancer Institute NSW (eviq.org.au)
// patient information sheet, ID 3095 v7, Sept 2025. JPCC distributes
// this verbatim. We render the contents bilingually so dad (zh) and
// the carers (en) read the same advice. Every clinical claim carries
// an inline Cite to the eviq sheet.

export default function ChemoAtHomePage() {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <Link
        href="/safety"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === "zh" ? "返回" : "Back"}
      </Link>

      <PageHeader
        eyebrow={locale === "zh" ? "居家化疗安全" : "CHEMO SAFETY AT HOME"}
        title={
          locale === "zh"
            ? "用药后 48 小时如何保护家人"
            : "Protecting the household for 48 hours after each dose"
        }
        subtitle={
          locale === "zh"
            ? "化疗后 48 小时内（部分药物最长 7 天），体液中可能含化疗药物。"
            : "Within ~48 hours of treatment (some agents up to 7 days), body fluids may contain chemotherapy."
        }
      />

      {locale === "zh" ? <ContentZH /> : <ContentEN />}
    </div>
  );
}

function ContentEN() {
  const eviq = getSource("eviq_chemo_safety_2025");
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Why this matters</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            Chemotherapy stays in body fluids for some time after each
            treatment. For most regimens that&apos;s ~48 hours; some agents
            stay up to 7 days; continuous-infusion pumps stay 7 days
            after the <em>last</em> dose.
            <Cite source="eviq_chemo_safety_2025" />
          </p>
          <p className="text-[13px] leading-snug text-ink-700">
            <strong>Children and people who are pregnant or breastfeeding</strong>{" "}
            should not touch chemotherapy medicines or body fluids that
            might contain them.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Toilet</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>Sit down on the toilet seat to use it.</li>
            <li>Close the lid, then flush with a full flush.</li>
            <li>Wash hands with soap and water.</li>
            <li>
              Use sanitary / incontinence pads if needed; protect cushions
              and mattresses.
            </li>
            <li>
              Septic tanks, composting toilets, and eco-friendly systems may
              be harmed by body fluids containing chemotherapy — check with
              the manufacturer.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">
            Vomiting (in a bowl or bag)
          </h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              Vomit into a plastic bowl or sealable plastic bag with no holes.
            </li>
            <li>
              <strong>Bowl:</strong> wear gloves, empty into the toilet, close
              the lid, full flush. If within 48 hours of treatment (or on a
              continuous pump),{" "}
              <strong>flush a second time</strong>. Wash bowl with soapy water,
              dry with paper towels, and reserve it only for vomit until
              treatment ends.
            </li>
            <li>
              <strong>Bag:</strong> seal it; double-bag if thin or damaged;
              put in general rubbish.
            </li>
            <li>Wash hands with soap and water afterward.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">
            Cleaning spills (urine, stool, blood, vomit, chemo)
          </h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>Wear disposable gloves; soak up with paper towels.</li>
            <li>
              Wash the surface with disposable cloths and soapy water, then
              dry with paper towels.
            </li>
            <li>
              Bag the towels, cloths and gloves; tie the bag; put in general
              rubbish. Wash hands.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">
            Laundry with body fluids on it
          </h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>Gloves on to handle. Wash straight away if you can.</li>
            <li>
              If not, seal in a plastic bag until it can be washed. Bag and
              bin gloves after loading the machine.
            </li>
            <li>
              <strong>No hand-washing.</strong> Machine wash on the longest
              cycle, hot or cold, with detergent.
            </li>
            <li>
              <strong>Run a second full wash cycle</strong> (twice in total).
            </li>
            <li>Dry outside if possible. Then use as normal.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">
            Used pads, nappies, colostomy / urine bags
          </h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>Gloves on. Place items in a sealed plastic bag.</li>
            <li>Add the gloves into the bag, tie it, general rubbish.</li>
            <li>Wash skin with soap and water. Wash hands.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Skin / eye contact</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>Eyes:</strong> rinse with water or eyewash for 10–15 min;
              call the team immediately.
            </li>
            <li>
              <strong>Skin:</strong> wash with soap and water; if redness or
              stinging, call the team.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Sex and protection</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              Use effective contraception during treatment — chemo can harm an
              unborn baby.
            </li>
            <li>
              Use a condom, dental dam, or other physical barrier for any
              sex during the precaution window (usually 48 h, up to 7 days
              for some agents — confirm with the team).
            </li>
            <li>
              Clean sex toys / aids with soapy water and dry with paper
              towels.
            </li>
            <li>
              <strong>No open-mouth kissing</strong> for 48 h (up to 7 days
              for some agents); saliva may contain chemotherapy.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">If you take medicines at home</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              Store all tablets, capsules, liquids and injections in a safe
              place away from children and animals; follow the label.
            </li>
            <li>
              Dispose of needles and syringes in the sharps container the
              team gave you. Return leftover medicines to your hospital
              pharmacy.
            </li>
            <li>
              Family / carers should not touch the medicines bare-handed; use
              gloves if needed.
            </li>
            <li>Wash hands after every dose or waste handling.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">Common questions</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>Hugs and touch?</strong> Yes, safe.
            </li>
            <li>
              <strong>Same toilet as the rest of the household?</strong> Yes.
              If body fluids splash on the seat, gloves on, soapy-water wash.
            </li>
            <li>
              <strong>Same drinking glass / utensils?</strong> Yes — washed
              with detergent in between.
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
            <Cite source="eviq_chemo_safety_2025" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ContentZH() {
  const eviq = getSource("eviq_chemo_safety_2025");
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">为什么需要这些措施</h3>
          <p className="text-[13px] leading-snug text-ink-700">
            化疗药物在每次治疗后会在体液中残留一段时间。多数方案约
            48 小时；部分药物可达 7 天；持续输注的泵会在<em>最后一次</em>
            用药后再持续 7 天。
            <Cite source="eviq_chemo_safety_2025" />
          </p>
          <p className="text-[13px] leading-snug text-ink-700">
            <strong>儿童、孕妇及哺乳期家人</strong>
            应避免接触化疗药物或可能含药的体液。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">如厕</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>坐着如厕。</li>
            <li>用后盖上马桶盖，按全冲水。</li>
            <li>用肥皂和水洗手。</li>
            <li>如有失禁，用卫生垫，并在椅垫和床垫上加保护垫。</li>
            <li>
              化粪池、堆肥马桶、环保马桶系统可能因含药体液而受损 —— 请联系制造商确认。
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">呕吐处理</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>使用塑料盆或可密封的塑料袋（无破口）接呕吐物。</li>
            <li>
              <strong>塑料盆：</strong>戴一次性手套，将呕吐物倒入马桶，盖上马桶盖，按全冲水。
              <strong>用药后 48 小时内（或正在用持续泵）需冲水两次</strong>。
              用肥皂水清洗盆子、清水冲洗、纸巾擦干，化疗结束前此盆只用于接呕吐物。
            </li>
            <li>
              <strong>塑料袋：</strong>密封后丢入垃圾桶；袋子薄或破损则套两层。
            </li>
            <li>用肥皂和水洗手。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">清理体液或药物泼洒</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>戴一次性手套，用纸巾吸附液体。</li>
            <li>用一次性湿布加肥皂水擦洗表面，再用纸巾擦干。</li>
            <li>所有用过的纸巾、布、手套装入塑料袋，扎紧后丢入普通垃圾桶。洗手。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">含体液的衣物 / 毛巾 / 床单清洗</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>戴手套处理。能立刻洗就立刻洗。</li>
            <li>
              暂时不能洗就用塑料袋密封保存。装入洗衣机后，把手套也丢进塑料袋扎紧、丢垃圾桶。
            </li>
            <li><strong>不要手洗。</strong>洗衣机最长程序，冷水或热水均可，加洗涤剂。</li>
            <li><strong>再完整洗一次</strong>（一共洗两遍）。</li>
            <li>尽量户外晾晒。然后即可正常使用。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">用过的护垫 / 尿布 / 造口袋 / 尿袋</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>戴一次性手套，物品装入塑料袋。</li>
            <li>把手套也放进袋子，扎紧后丢入普通垃圾桶。</li>
            <li>用肥皂和水清洁皮肤，最后洗手。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">皮肤 / 眼睛接触</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>
              <strong>眼睛：</strong>用水或人工泪液冲洗 10–15 分钟，立即联系医护人员。
            </li>
            <li>
              <strong>皮肤：</strong>用肥皂和水冲洗，如有发红或刺痛立即联系医护人员。
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">性生活与防护</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>治疗期间使用有效避孕措施 —— 化疗药物可能伤害未出生的孩子。</li>
            <li>
              防护期内（一般 48 小时，部分药物 7 天，请向医生确认）任何性行为都使用避孕套、
              口交膜或其他物理屏障。
            </li>
            <li>性玩具用肥皂水清洗，用纸巾擦干。</li>
            <li>
              <strong>避免开口式深吻</strong>，48 小时内（部分药物 7 天），唾液中可能含药物。
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">居家用药</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li>所有口服药、胶囊、液体或注射剂存放在远离儿童与动物的地方，按药品说明储存。</li>
            <li>针头与针筒丢入医护提供的锐器盒。剩余药物退回医院药房处置。</li>
            <li>家属 / 护理者不要徒手碰药物，必要时戴手套。</li>
            <li>每次给药或处理废弃物后用肥皂洗手。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h3 className="serif text-base text-ink-900">常见问题</h3>
          <ul className="ml-4 list-disc space-y-1 text-[13px] text-ink-700">
            <li><strong>能拥抱、触碰家人吗？</strong> 可以，安全。</li>
            <li>
              <strong>能与家人共用马桶吗？</strong> 可以。
              如果体液溅到马桶圈，戴手套用肥皂水清洁后再让别人用。
            </li>
            <li><strong>能共用杯子餐具吗？</strong> 可以 —— 用之间用洗涤剂清洗即可。</li>
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
            <Cite source="eviq_chemo_safety_2025" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
