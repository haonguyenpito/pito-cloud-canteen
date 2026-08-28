const AVG_CHAR_WIDTH_RATIO = 0.58;
const LINE_HEIGHT_RATIO = 1.25;

export const fitFontSizeMm = ({
  text,
  widthMm,
  maxLines,
  maxFontMm,
  minFontMm,
}: {
  text: string;
  widthMm: number;
  maxLines: number;
  maxFontMm: number;
  minFontMm: number;
}) => {
  const length = (text || '').trim().length;
  if (!length) return maxFontMm;

  for (let size = maxFontMm; size > minFontMm; size -= 0.1) {
    const charsPerLine = Math.max(
      1,
      Math.floor(widthMm / (size * AVG_CHAR_WIDTH_RATIO)),
    );
    if (Math.ceil(length / charsPerLine) <= maxLines)
      return Math.round(size * 10) / 10;
  }

  return minFontMm;
};

function UserLabelFittedText({
  text,
  widthMm,
  maxLines,
  maxFontMm,
  minFontMm,
  className,
  fontFamily = 'Reddit Sans',
}: {
  text: string;
  widthMm: number;
  maxLines: number;
  maxFontMm: number;
  minFontMm: number;
  className?: string;
  fontFamily?: string;
}) {
  const fontMm = fitFontSizeMm({
    text,
    widthMm,
    maxLines,
    maxFontMm,
    minFontMm,
  });

  return (
    <div
      className={className}
      style={{
        fontSize: `${fontMm}mm`,
        lineHeight: LINE_HEIGHT_RATIO,
        wordBreak: 'break-word',
        fontFamily,
      }}>
      {text}
    </div>
  );
}

export default UserLabelFittedText;
