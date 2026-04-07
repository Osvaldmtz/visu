export const FORMATS = {
  square: { width: 1080, height: 1080, label: "1080 x 1080", ratio: "1/1" },
  portrait: { width: 1080, height: 1350, label: "1080 x 1350", ratio: "4/5" },
} as const;

export type PostFormat = keyof typeof FORMATS;
