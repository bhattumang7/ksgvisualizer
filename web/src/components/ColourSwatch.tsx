const BACKGROUNDS: Record<string, string> = {
  red: "#b3263f",
  pink: "#e98aa9",
  orange: "#ea8a3c",
  yellow: "#f1cb3f",
  white: "linear-gradient(135deg,#fffdf8,#e9e2d3)",
  mauve: "#a07fbb",
  bicolour: "linear-gradient(135deg,#e98aa9 50%,#fff3e2 50%)",
  multicolour: "conic-gradient(#b3263f,#f1cb3f,#e98aa9,#a07fbb,#b3263f)",
};

/** A flat colour block standing in for a photo. Photos are only loaded on a rose's own page. */
export function ColourSwatch({ group, className = "" }: { group: string; className?: string }) {
  return <div aria-hidden className={className} style={{ background: BACKGROUNDS[group] ?? "#ccc" }} />;
}
