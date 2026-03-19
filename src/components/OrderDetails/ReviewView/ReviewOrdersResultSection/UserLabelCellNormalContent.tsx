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
    return (
      <div className="relative w-full h-full gap-0 px-[4mm] py-[2mm]">
        <div className="flex items-center justify-between w-full">
          <div className="w-[calc((100%-32mm)*0.7)] h-[14mm] overflow-hidden">
            <div
              className="text-[2mm] h-[4.2mm] overflow-hidden"
              style={{
                wordBreak: 'break-word',
                fontFamily: 'Quicksand',
                lineHeight: 0.95,
              }}>
              {companyName}
            </div>
            <div
              className="text-[2mm] italic h-[4.2mm] overflow-hidden"
              style={{
                wordBreak: 'break-word',
                fontFamily: 'Quicksand',
                lineHeight: 0.95,
              }}>
              {partnerName}
            </div>
            {hasGroupName && (
              <div
                className="text-[2mm] h-[4.2mm] overflow-hidden"
                style={{
                  wordBreak: 'break-word',
                  fontFamily: 'Quicksand',
                  lineHeight: 0.95,
                }}>
                {groupName}
              </div>
            )}
          </div>
          <div
            className="text-[2mm] font-semibold h-[4.2mm] overflow-hidden"
            style={{
              wordBreak: 'break-word',
              fontFamily: 'Quicksand',
              lineHeight: 0.95,
            }}>
            {mealDate}
          </div>
          <div
            className="text-[2mm] h-[4.2mm] overflow-hidden"
            style={{
              wordBreak: 'break-word',
              fontFamily: 'Quicksand',
              lineHeight: 0.95,
            }}>
            {groupName}
          </div>
        </div>

        <div className="flex items-center flex-col justify-center">
          <div
            className="w-full px-[2mm] text-center font-semibold h-[9mm] overflow-hidden"
            style={{
              wordBreak: 'break-word',
              fontFamily: 'Reddit Sans',
              lineHeight: 1,
              fontSize: '2.8mm',
            }}>
            {foodName}
          </div>

          {note && (
            <div
              className="w-full text-center font-light italic h-[4mm] overflow-hidden mt-[-2mm] text-nowrap"
              style={{
                wordBreak: 'break-word',
                whiteSpace: 'nowrap',
                fontFamily: 'Reddit Sans',
                lineHeight: 1,
                fontSize: '2.4mm',
              }}>
              {note}
            </div>
          )}

          <i
            className="text-xs w-full text-center italic absolute bottom-[2mm] left-1/2 transform -translate-x-1/2"
            style={{
              fontFamily: 'Reddit Sans',
              fontSize: '2.2mm',
            }}>
            Chúc bạn ngon miệng!
          </i>
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
