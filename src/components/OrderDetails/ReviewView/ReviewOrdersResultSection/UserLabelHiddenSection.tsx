import type { UserLabelRecord } from './ReviewOrdersResultModal';
import UserLabelCellContent from './UserLabelCellContent';

function UserLabelHiddenSection({
  userLabelRecords,
}: {
  userLabelRecords: UserLabelRecord[];
}) {
  const chunksOf18UserLabelRecords = (() => {
    const sameDateMap = userLabelRecords.reduce((result, current) => {
      const { mealDate } = current;
      if (result[mealDate]) {
        result[mealDate].push(current);
      } else {
        result[mealDate] = [current];
      }

      return result;
    }, {} as Record<string, UserLabelRecord[]>);

    Object.keys(sameDateMap).forEach((date) => {
      const firstCurrent = sameDateMap[date][0];
      const emptyLabels = new Array(5).fill({
        partnerName: firstCurrent.partnerName,
        companyName: firstCurrent.companyName,
        mealDate: firstCurrent.mealDate,
        participantName: '   ',
        foodName: '   ',
        timestamp: firstCurrent.timestamp,
        requirement: '',
        qrCodeImageSrc: firstCurrent.qrCodeImageSrc,
      });

      sameDateMap[date].push(...emptyLabels);
    });

    const flatAllDates = Object.values(sameDateMap).flat();

    const chunks = [];
    for (let i = 0; i < flatAllDates.length; i += 18) {
      chunks.push(flatAllDates.slice(i, i + 18));
    }

    return chunks;
  })();

  return (
    <div className="h-0 overflow-hidden absolute">
      <div>
        {chunksOf18UserLabelRecords.map((userLabelRecordsx18, index) => (
          <div
            key={index}
            className="grid grid-cols-3 w-[210mm] h-[297mm] content-start"
            id={`printable-area-${index}`}>
            {userLabelRecordsx18.map((userLabelRecord, idx) => (
              <div key={idx} className="w-full h-[48mm]">
                <UserLabelCellContent
                  type="a4"
                  partnerName={userLabelRecord.partnerName}
                  companyName={userLabelRecord.companyName}
                  mealDate={userLabelRecord.mealDate}
                  groupName={userLabelRecord.groupName}
                  participantName={userLabelRecord.participantName}
                  foodName={userLabelRecord.foodName}
                  qrCodeImageSrc={userLabelRecord.qrCodeImageSrc}
                  note={userLabelRecord.requirement}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserLabelHiddenSection;
