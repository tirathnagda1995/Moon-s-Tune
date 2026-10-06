import en from "@/locales/world/en";
export function worldMessages(locale: string) {
  return {
    ...en,
    ...(locale.startsWith("ar")
      ? {
          world: "العالم",
          me: "أنا",
          patterns: "الأنماط",
          add: "أضف لحظة",
          title: "العالم، الآن.",
          intro: "لحظات عادية. أماكن مختلفة. أقرب قليلًا.",
          search: "أي مدينة تثير فضولك؟",
          live: "العالم المباشر",
          preview: "معاينة المنتج",
          close: "إغلاق",
          cancel: "إلغاء",
          onlyMe: "أنا فقط",
        }
      : locale.startsWith("hi")
        ? {
            world: "दुनिया",
            me: "मैं",
            patterns: "पैटर्न",
            add: "पल जोड़ें",
            title: "दुनिया, इस पल।",
            intro: "रोज़मर्रा के पल। अलग जगहें। थोड़ा और करीब।",
            search: "किस शहर के बारे में जानना चाहेंगे?",
            live: "लाइव दुनिया",
            preview: "उत्पाद की झलक",
            close: "बंद करें",
            cancel: "रद्द करें",
            onlyMe: "सिर्फ़ मैं",
          }
        : {}),
  };
}
export type WorldMessages = typeof en;
