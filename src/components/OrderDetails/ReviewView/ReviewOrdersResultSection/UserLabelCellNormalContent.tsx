import UserLabelFittedText, {
  estimateTextHeightMm,
  fitFontSizeMm,
} from './UserLabelFittedText';

const THERMAL_CONTENT_WIDTH_MM = 56;
const THERMAL_HEADER_COLUMN_WIDTH_MM = 26.5;
const THERMAL_CONTENT_HEIGHT_MM = 39;
const THERMAL_HEADER_HEIGHT_MM = 8.2;
const THERMAL_HEADER_GAP_MM = 2.5;
const THERMAL_NOTE_GAP_MM = 0.8;
const THERMAL_FOOD_MIN_HEIGHT_MM = 6.5;
const THERMAL_FOOTER_HEIGHT_MM = 2.9;
const THERMAL_BOTTOM_PADDING_MM = 0.8;

function HeaderLine({
  text,
  className,
  maxFontMm = 2.2,
}: {
  text: string;
  className?: string;
  maxFontMm?: number;
}) {
  return (
    <UserLabelFittedText
      text={text}
      widthMm={THERMAL_HEADER_COLUMN_WIDTH_MM}
      maxLines={1}
      maxFontMm={maxFontMm}
      minFontMm={1.4}
      fontFamily="Quicksand"
      className={className}
    />
  );
}

function UserLabelCellNormalContent({
  type,
  companyName,
  partnerName,
  mealDate,
  groupName,
  foodName,
  note,
}: {
  type: 'a4' | 'thermal';
  companyName: string;
  partnerName: string;
  mealDate: string;
  groupName?: string;
  foodName: string;
  note?: string;
}) {
  const hasGroupName = Boolean(groupName && String(groupName).trim());
  if (type === 'thermal') {
    const foodAndNoteHeightMm =
      THERMAL_CONTENT_HEIGHT_MM -
      THERMAL_HEADER_HEIGHT_MM -
      THERMAL_HEADER_GAP_MM -
      THERMAL_FOOTER_HEIGHT_MM -
      THERMAL_BOTTOM_PADDING_MM;
    const noteFontMm = fitFontSizeMm({
      text: note || '',
      widthMm: THERMAL_CONTENT_WIDTH_MM,
      maxLines: 2,
      maxHeightMm:
        foodAndNoteHeightMm - THERMAL_FOOD_MIN_HEIGHT_MM - THERMAL_NOTE_GAP_MM,
      maxFontMm: 2.4,
      minFontMm: 1.4,
    });
    const foodNameHeightBudgetMm =
      foodAndNoteHeightMm -
      (note
        ? THERMAL_NOTE_GAP_MM +
          estimateTextHeightMm({
            text: note,
            widthMm: THERMAL_CONTENT_WIDTH_MM,
            fontMm: noteFontMm,
          })
        : 0);

    return (
      <div className="flex flex-col w-full h-full px-[3mm] py-[2mm]">
        <div className="flex items-start justify-between gap-[2mm] shrink-0">
          <div className="w-[48%]">
            <HeaderLine
              text={companyName}
              className="font-semibold"
              maxFontMm={2.8}
            />
            {hasGroupName && (
              <HeaderLine
                text={groupName!}
                className="font-semibold uppercase"
                maxFontMm={2.8}
              />
            )}
          </div>
          <div className="w-[48%]">
            <HeaderLine text={mealDate} className="font-semibold text-right" />
            <HeaderLine
              text={partnerName}
              className="font-semibold text-right"
              maxFontMm={2.8}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center flex-1 min-h-0 overflow-hidden mt-[2.5mm] pb-[0.8mm]">
          <UserLabelFittedText
            text={foodName}
            widthMm={THERMAL_CONTENT_WIDTH_MM}
            maxHeightMm={foodNameHeightBudgetMm}
            maxFontMm={4.4}
            minFontMm={1.7}
            className="w-full font-semibold text-center"
          />

          {note && (
            <UserLabelFittedText
              text={note}
              widthMm={THERMAL_CONTENT_WIDTH_MM}
              maxFontMm={noteFontMm}
              minFontMm={noteFontMm}
              className="w-full text-center italic mt-[0.8mm]"
            />
          )}
        </div>

        <div
          className="shrink-0 text-center italic"
          style={{
            fontFamily: 'Reddit Sans',
            fontSize: '2mm',
            lineHeight: 1.4,
          }}>
          Chúc bạn ngon miệng!
        </div>
      </div>
    );
  }

  if (type === 'a4') {
    return (
      <div className="relative w-full h-full gap-0 pl-[8mm] pr-[4mm] py-[4mm] ">
        <div className="flex items-center justify-between w-full">
          <div className="w-[calc((100%-32mm)*0.7)] h-[14mm] overflow-hidden">
            <div
              className="text-[2.2mm] h-[4.75mm] overflow-hidden"
              style={{
                wordBreak: 'break-word',
                fontFamily: 'Quicksand',
                lineHeight: 1.0,
              }}>
              {companyName}
            </div>
            <div
              className="text-[2.2mm] italic h-[4.75mm] overflow-hidden"
              style={{
                wordBreak: 'break-word',
                fontFamily: 'Quicksand',
                lineHeight: 1.0,
              }}>
              {partnerName}
            </div>
          </div>
          <div
            className="text-[2.2mm] font-semibold h-[3.5mm] overflow-hidden"
            style={{
              wordBreak: 'break-word',
              fontFamily: 'Quicksand',
              lineHeight: 1.0,
            }}>
            {mealDate}
          </div>
          {hasGroupName && (
            <div
              className="text-[2.2mm] h-[3.5mm] overflow-hidden"
              style={{
                wordBreak: 'break-word',
                fontFamily: 'Quicksand',
                lineHeight: 1.0,
              }}>
              {groupName}
            </div>
          )}
        </div>

        <div className="flex items-center flex-col justify-center">
          <div
            className="text-[3.2mm] w-full px-[2mm] text-center font-semibold h-[9mm] overflow-hidden"
            style={{
              wordBreak: 'break-word',
              fontFamily: 'Reddit Sans',
              lineHeight: 1.1,
            }}>
            {foodName}
          </div>

          <div
            className="text-[2.8mm] w-full text-center font-light italic h-[5.5mm] overflow-hidden mt-[-2mm] text-nowrap"
            style={{
              wordBreak: 'break-word',
              whiteSpace: 'nowrap',
              fontFamily: 'Reddit Sans',
              lineHeight: 1,
            }}>
            {note}
          </div>
        </div>

        <i
          className="text-xs w-full text-center italic absolute bottom-[4mm] left-1/2 transform -translate-x-1/2"
          style={{
            fontFamily: 'Reddit Sans',
          }}>
          Chúc bạn ngon miệng!
        </i>
      </div>
    );
  }

  return null;
}
export default UserLabelCellNormalContent;
