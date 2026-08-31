// Measured against printed labels: Reddit Sans / Quicksand at semibold average
// ~0.46em per character, with a little headroom so a wide string still wraps
// within its line budget.
const AVG_CHAR_WIDTH_RATIO = 0.5;
const LINE_HEIGHT_RATIO = 1.25;

// Labels print through html2canvas, which paints glyphs on the font's own line
// box and so overflows any CSS-sized clipping box, shaving the last line.
// Truncating the string up front keeps the text inside its line budget without
// relying on overflow.
export const truncateToLines = ({
  text,
  widthMm,
  fontMm,
  maxLines,
}: {
  text: string;
  widthMm: number;
  fontMm: number;
  maxLines: number;
}) => {
  const value = (text || '').trim();
  const charsPerLine = Math.max(
    1,
    Math.floor(widthMm / (fontMm * AVG_CHAR_WIDTH_RATIO)),
  );
  const maxChars = charsPerLine * maxLines;

  return value.length <= maxChars
    ? value
    : `${value.slice(0, maxChars - 1).trimEnd()}…`;
};

function UserLabelText({
  text,
  widthMm,
  fontMm,
  maxLines,
  className,
  fontFamily = 'Reddit Sans',
}: {
  text: string;
  widthMm: number;
  fontMm: number;
  maxLines: number;
  className?: string;
  fontFamily?: string;
}) {
  return (
    <div
      className={className}
      style={{
        fontSize: `${fontMm}mm`,
        lineHeight: LINE_HEIGHT_RATIO,
        wordBreak: 'break-word',
        fontFamily,
      }}>
      {truncateToLines({ text, widthMm, fontMm, maxLines })}
    </div>
  );
}

export default UserLabelText;
