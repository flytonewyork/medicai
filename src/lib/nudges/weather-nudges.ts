import type { FeedItem } from "~/types/feed";
import type { CurrentWeather } from "~/lib/weather/open-meteo";
import { weatherCondition } from "~/lib/weather/open-meteo";
import type { CycleContext } from "~/types/treatment";
import type { LocalizedText } from "~/types/localized";

export interface WeatherNudgeInputs {
  weather: CurrentWeather | null;
  cycleContext: CycleContext | null;
}

export function computeWeatherNudges({
  weather,
  cycleContext,
}: WeatherNudgeInputs): FeedItem[] {
  if (!weather) return [];
  const out: FeedItem[] = [];
  const cond = weatherCondition(weather.weather_code);
  const daysSinceDose =
    cycleContext && cycleContext.is_dose_day
      ? 0
      : cycleContext
        ? mostRecentDoseOffset(cycleContext)
        : null;
  const withinColdDysaesthesiaWindow =
    daysSinceDose !== null && daysSinceDose >= 0 && daysSinceDose <= 3;
  const onOxaliplatin =
    cycleContext?.protocol.id === "mffx" ||
    cycleContext?.protocol.id === "nalirifox";

  const minT = weather.min_temp_c_24h;
  const maxT = weather.max_temp_c_24h;
  const nowT = weather.temperature_c;

  // ── Cold + post-dose → cold dysaesthesia reminder (FOLFIRINOX strongest)
  if (minT <= 10) {
    if (withinColdDysaesthesiaWindow && onOxaliplatin) {
      out.push({
        id: "weather_cold_post_oxaliplatin",
        priority: 25,
        category: "weather",
        tone: "warning",
        title: {
          en: "Cold day — keep oxaliplatin cold rules in mind",
          zh: "低温天 —— 记得奥沙利铂的遇冷注意事项",
        },
        body: {
          en: `Forecast ${Math.round(minT)}–${Math.round(maxT)} °C. For 48–72 h after oxaliplatin, cold air, drinks, or food can trigger sharp throat and hand spasms. Scarf + gloves before going out, room-temp drinks only.`,
          zh: `预计 ${Math.round(minT)}–${Math.round(maxT)} °C。奥沙利铂用药后 48–72 小时内，冷空气、冷饮、冷食可能诱发咽喉与手部痉挛。外出戴围巾手套，饮食以常温为宜。`,
        },
        icon: "thermo",
        source: "weather",
      });
    } else if (withinColdDysaesthesiaWindow) {
      out.push({
        id: "weather_cold_post_dose",
        priority: 45,
        category: "weather",
        tone: "caution",
        title: {
          en: "Cold day — ease into outdoor air",
          zh: "低温天 —— 外出循序渐进",
        },
        body: {
          en: `Forecast ${Math.round(minT)}–${Math.round(maxT)} °C. Post-dose days, cold air can worsen cold-dysaesthesia and mouth/throat sensitivity. Wrap up and avoid cold drinks today.`,
          zh: `预计 ${Math.round(minT)}–${Math.round(maxT)} °C。用药后遇冷可能加重感觉异常与口咽不适。注意保暖，今日避免冷饮。`,
        },
        icon: "thermo",
        source: "weather",
      });
    }
  }

  // ── Heat + on chemo → hydration reminder
  if (maxT >= 32) {
    out.push({
      id: "weather_hot",
      priority: 55,
      category: "weather",
      tone: "caution",
      title: {
        en: "Hot day — hydration plan",
        zh: "高温天 —— 记得补水",
      },
      body: {
        en: `Forecast up to ${Math.round(maxT)} °C. Chemo + heat dehydrates fast. Aim 2 L+ fluids, avoid mid-day outings, keep PERT timing tight to meals.`,
        zh: `最高 ${Math.round(maxT)} °C。化疗加上高温容易脱水。今日目标 2 升以上饮水，避开中午外出，胰酶与进餐严格对时。`,
      },
      icon: "sun",
      source: "weather",
    });
  }

  // ── UV high → sun protection (Australia default, chemo skin sensitivity)
  if (typeof weather.uv_index_max_today === "number" && weather.uv_index_max_today >= 8) {
    out.push({
      id: "weather_uv_high",
      priority: 65,
      category: "weather",
      tone: "info",
      title: {
        en: "High UV today",
        zh: "今日紫外线强",
      },
      body: {
        en: `UV peaks at ${Math.round(weather.uv_index_max_today)}. Many chemo agents make skin more photosensitive. Broad-spectrum SPF 50, hat, long sleeves — especially 10 am – 4 pm.`,
        zh: `最高 UV ${Math.round(weather.uv_index_max_today)}。化疗使皮肤对紫外线更敏感。上午十点至下午四点做好防晒 —— SPF 50、帽子、长袖。`,
      },
      icon: "sun",
      source: "weather",
    });
  }

  // ── Rain / thunderstorm → swap outdoor walk for indoor
  if (
    (cond === "rain" || cond === "thunderstorm") &&
    (weather.precip_probability_max_today ?? 0) >= 60
  ) {
    out.push({
      id: "weather_rainy",
      priority: 78,
      category: "weather",
      tone: "info",
      title: {
        en: "Rain likely — indoor movement today",
        zh: "今日多雨 —— 改做室内运动",
      },
      body: {
        en: "Swap the walk for gentle hallway / stairs work or stretching + resistance bands. Keep moving — even 10 minutes protects muscle.",
        zh: "今日雨大，步行改为走廊 / 楼梯、伸展 + 弹力带训练。哪怕 10 分钟也能保护肌肉。",
      },
      icon: "drop",
      source: "weather",
    });
  }

  // ── Very cold (<5 °C) + nadir → stay warm, avoid crowds
  if (minT <= 5 && cycleContext?.phase?.key === "nadir") {
    out.push({
      id: "weather_cold_nadir",
      priority: 20,
      category: "weather",
      tone: "warning",
      title: {
        en: "Cold + nadir window",
        zh: "低温遇上骨髓抑制低谷",
      },
      body: {
        en: "Neutrophil nadir + cold = higher infection risk. Keep inside as much as you can, layer up when you must go out, avoid unwell visitors.",
        zh: "骨髓低谷遇上低温 —— 感染风险更高。尽量在家，外出多层穿着，避开有感冒的访客。",
      },
      icon: "shield",
      source: "weather",
    });
  }

  // ── Passive weather line (always — low priority)
  if (!out.some((n) => n.category === "weather")) {
    out.push({
      id: "weather_passive",
      priority: 92,
      category: "weather",
      tone: "info",
      title: {
        en: `${weather.city} · ${Math.round(nowT)} °C`,
        zh: `${weather.city} · ${Math.round(nowT)} °C`,
      },
      body: {
        en: `${conditionLabel(cond, "en")} today. ${Math.round(minT)}–${Math.round(maxT)} °C range.`,
        zh: `${conditionLabel(cond, "zh")}。温度 ${Math.round(minT)}–${Math.round(maxT)} °C。`,
      },
      icon: "sun",
      source: "weather",
    });
  }

  return out;
}

function mostRecentDoseOffset(ctx: CycleContext): number | null {
  const day = ctx.cycle_day;
  const past = ctx.protocol.dose_days.filter((d) => d <= day);
  if (past.length === 0) return null;
  return day - (past[past.length - 1] ?? 0);
}

function conditionLabel(
  c: ReturnType<typeof weatherCondition>,
  locale: "en" | "zh",
): string {
  const labels: Record<typeof c, LocalizedText> = {
    clear: { en: "Clear", zh: "晴天" },
    cloud: { en: "Cloudy", zh: "多云" },
    rain: { en: "Rain", zh: "有雨" },
    snow: { en: "Snow", zh: "有雪" },
    thunderstorm: { en: "Thunderstorms", zh: "雷暴" },
    fog: { en: "Fog", zh: "有雾" },
    other: { en: "Mixed", zh: "多变" },
  };
  return labels[c][locale];
}
