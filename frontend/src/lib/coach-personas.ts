export type CoachPersona = {
  id: string;
  name: string;
  mbti: string;
  tagline: string;
  style: string;
  greeting: string;
  accentClass: string;
  gradientClass: string;
};

export const coachPersonas: CoachPersona[] = [
  {
    id: "mira",
    name: "Mira",
    mbti: "INTP",
    tagline: "拆解目标，给你清晰的执行路径",
    style: "理性分析型",
    greeting: "我是 Mira，会把你的目标拆成可执行的小步骤。",
    accentClass: "text-violet-700",
    gradientClass: "from-violet-500 via-fuchsia-500 to-pink-400",
  },
  {
    id: "jun",
    name: "阿峻",
    mbti: "ENFJ",
    tagline: "陪你稳定坚持，不靠意志力硬扛",
    style: "陪伴鼓励型",
    greeting: "我是阿峻，我会盯住节奏和情绪波动，陪你稳稳往前走。",
    accentClass: "text-emerald-700",
    gradientClass: "from-emerald-500 via-teal-500 to-cyan-400",
  },
  {
    id: "nova",
    name: "Nova",
    mbti: "ENTJ",
    tagline: "直给反馈，帮你把执行力拉满",
    style: "强推动员型",
    greeting: "我是 Nova，我会直接告诉你今天该做什么，别拖。",
    accentClass: "text-amber-700",
    gradientClass: "from-orange-500 via-amber-500 to-yellow-400",
  },
];

export function getCoachPersona(id: string | null | undefined) {
  return coachPersonas.find((persona) => persona.id === id) ?? coachPersonas[0];
}
