const AVG_CHAR_WIDTH_RATIO = 0.58;
const CSS_LINE_HEIGHT_RATIO = 1.25;
const RENDERED_LINE_HEIGHT_RATIO = 1.45;

const estimateLineCount = ({
  text,
  widthMm,
  fontMm,
}: {
  text: string;
  widthMm: number;
  fontMm: number;
}) => {
  const length = (text || '').trim().length;
  if (!length) return 0;

  const charsPerLine = Math.max(
    1,
    Math.floor(widthMm / (fontMm * AVG_CHAR_WIDTH_RATIO)),
  );

  return Math.ceil(length / charsPerLine);
};

export const estimateTextHeightMm = ({
  text,
  widthMm,
  fontMm,
}: {
  text: string;
  widthMm: number;
  fontMm: number;
}) =>
  estimateLineCount({ text, widthMm, fontMm }) *
  fontMm *
  RENDERED_LINE_HEIGHT_RATIO;

export const fitFontSizeMm = ({
  text,
  widthMm,
  maxLines,
  maxHeightMm,
  maxFontMm,
  minFontMm,
}: {
  text: string;
  widthMm: number;
  maxLines?: number;
  maxHeightMm?: number;
  maxFontMm: number;
  minFontMm: number;
}) => {
  if (!(text || '').trim()) return maxFontMm;

  for (let size = maxFontMm; size > minFontMm; size -= 0.1) {
    const lines = estimateLineCount({ text, widthMm, fontMm: size });
    const fitsLines = maxLines === undefined || lines <= maxLines;
    const fitsHeight =
      maxHeightMm === undefined ||
      lines * size * RENDERED_LINE_HEIGHT_RATIO <= maxHeightMm;

    if (fitsLines && fitsHeight) return Math.round(size * 10) / 10;
  }

  return minFontMm;
};

function UserLabelFittedText({
  text,
  widthMm,
  maxLines,
  maxHeightMm,
  maxFontMm,
  minFontMm,
  className,
  fontFamily = 'Reddit Sans',
}: {
  text: string;
  widthMm: number;
  maxLines?: number;
  maxHeightMm?: number;
  maxFontMm: number;
  minFontMm: number;
  className?: string;
  fontFamily?: string;
}) {
  const fontMm = fitFontSizeMm({
    text,
    widthMm,
    maxLines,
    maxHeightMm,
    maxFontMm,
    minFontMm,
  });

  return (
    <div
      className={className}
      style={{
        fontSize: `${fontMm}mm`,
        lineHeight: CSS_LINE_HEIGHT_RATIO,
        wordBreak: 'break-word',
        fontFamily,
      }}>
      {text}
    </div>
  );
}

export default UserLabelFittedText;
