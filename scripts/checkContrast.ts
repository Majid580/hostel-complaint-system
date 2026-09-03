/**
 * Contrast audit of the design tokens.
 *
 *   npm run check:contrast
 *
 * Run it after ANY palette change. Amber and green are the ones that catch
 * people out: they are used as TEXT on badges like "Past deadline", not only as
 * fills, and a colour bright enough to look good as a fill is usually too light
 * to read as text. Amber was 2.74:1 before this audit existed.
 *
 * Values here mirror src/app/globals.css — update both together.
 */

type Colour = [L: number, C: number, h: number];

function oklchToLinearSrgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const clamp = (c: number) => Math.max(0, Math.min(1, c));

function relativeLuminance([L, C, h]: Colour): number {
  const [r, g, b] = oklchToLinearSrgb(L, C, h).map(clamp);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: Colour, bg: Colour): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const light = {
  background: [0.985, 0.005, 80] as Colour,
  card: [0.997, 0.002, 80] as Colour,
  foreground: [0.2, 0.024, 266] as Colour,
  mutedForeground: [0.487, 0.018, 266] as Colour,
  primary: [0.475, 0.16, 272] as Colour,
  primaryForeground: [0.99, 0.005, 272] as Colour,
  destructive: [0.552, 0.208, 27] as Colour,
  success: [0.545, 0.128, 157] as Colour,
  warning: [0.565, 0.152, 68] as Colour,
  warningForeground: [0.99, 0.01, 68] as Colour,
  tag: [0.945, 0.016, 272] as Colour,
  tagForeground: [0.34, 0.09, 272] as Colour,
};

const dark: typeof light = {
  background: [0.172, 0.018, 266],
  card: [0.214, 0.021, 266],
  foreground: [0.958, 0.004, 80],
  mutedForeground: [0.722, 0.016, 266],
  primary: [0.735, 0.135, 274],
  primaryForeground: [0.17, 0.035, 274],
  destructive: [0.672, 0.185, 27],
  success: [0.712, 0.13, 157],
  warning: [0.792, 0.148, 74],
  warningForeground: [0.2, 0.05, 74],
  tag: [0.278, 0.045, 274],
  tagForeground: [0.855, 0.06, 274],
};

let failures = 0;

function report(name: string, t: typeof light): void {
  console.log("");
  console.log(`  ${name}`);

  const checks: Array<[string, Colour, Colour, number]> = [
    ["body text on background", t.foreground, t.background, 4.5],
    ["body text on card", t.foreground, t.card, 4.5],
    ["muted text on background", t.mutedForeground, t.background, 4.5],
    ["muted text on card", t.mutedForeground, t.card, 4.5],
    ["primary text on background", t.primary, t.background, 4.5],
    ["text on primary fill (buttons)", t.primaryForeground, t.primary, 4.5],
    ["destructive text on card", t.destructive, t.card, 4.5],
    ["success text on card", t.success, t.card, 4.5],
    ["warning text on card", t.warning, t.card, 4.5],
    ["text on warning fill", t.warningForeground, t.warning, 4.5],
    ["job tag text on tag", t.tagForeground, t.tag, 4.5],
  ];

  for (const [label, fg, bg, min] of checks) {
    const ratio = contrast(fg, bg);
    const pass = ratio >= min;
    if (!pass) failures++;
    console.log(
      `    ${pass ? "PASS" : "FAIL"}  ${ratio.toFixed(2)}:1  (min ${min})  ${label}`,
    );
  }
}

report("LIGHT", light);
report("DARK", dark);

console.log("");
if (failures === 0) {
  console.log("  All pairs meet WCAG AA (4.5:1).");
} else {
  console.log(`  ${failures} pair(s) below WCAG AA - fix globals.css before shipping.`);
}
console.log("");

process.exit(failures === 0 ? 0 : 1);
