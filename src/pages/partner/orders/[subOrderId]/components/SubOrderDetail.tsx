import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import html2canvas from 'html2canvas';
import { DateTime } from 'luxon';
import { useRouter } from 'next/router';
import QRCode from 'qrcode';
import { utils as XLSXUtils, writeFile } from 'xlsx';

import Button from '@components/Button/Button';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import IconDownload from '@components/Icons/IconDownload/IconDownload';
import IconPrint from '@components/Icons/IconPrint/IconPrint';
import {
  type UserLabelRecord,
  UserLabelThermalPrintSection,
} from '@components/OrderDetails/ReviewView/ReviewOrdersResultSection/ReviewOrdersResultModal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import { parseThousandNumber } from '@helpers/format';
import { groupPickingOrderByFood } from '@helpers/order/orderDetailHelper';
import { isJoinedPlan } from '@helpers/order/orderPickingHelper';
import { useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import type { UserListing } from '@src/types';
import { Listing } from '@src/utils/data';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import type { TListing, TObject } from '@src/utils/types';

import usePrepareDownloadData from '../hooks/usePrepareDownloadData';
// eslint-disable-next-line import/no-cycle
import { EPartnerSubOrderDetailPageViewMode } from '../PartnerSubOrderDetail.page';

import css from './SubOrderDetail.module.scss';

type TSubOrderDetailProps = {
  onChangeViewMode: (v: EPartnerSubOrderDetailPageViewMode) => () => void;
};

const SubOrderDetail: React.FC<TSubOrderDetailProps> = ({
  onChangeViewMode,
}) => {
  const intl = useIntl();
  const router = useRouter();
  const { isMobileLayout } = useViewport();
  const fetchOrderInProgress = useAppSelector(
    (state) => state.PartnerSubOrderDetail.fetchOrderInProgress,
  );
  const order = useAppSelector((state) => state.PartnerSubOrderDetail.order);
  const company: UserListing | null = useAppSelector(
    (state) => state.OrderManagement.companyData,
    shallowEqual,
  );

  const {
    query: { subOrderId = '' },
  } = router;

  // eslint-disable-next-line no-unsafe-optional-chaining
  const [, date] = (subOrderId as string)?.split('_');

  const { plan, participants = [], anonymous = [] } = order;

  const planGetter = Listing(plan as TListing);
  const { orderDetail = {} } = planGetter.getMetadata();

  const [data] = groupPickingOrderByFood({
    orderDetail,
    date: date ? Number(date) : undefined,
    participants,
    anonymous,
  }) || [{}];

  const { foodDataList = [] } = data || {};
  const initialCollapseStates = Array.from({
    length: foodDataList?.length,
  }).fill(0);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapseStates);
  const [qrCodeImageSrc, setQrCodeImageSrc] = useState('');
  const thermalPrintSectionRef = useRef<HTMLDivElement>(null);

  const handleClickGroupTitle = (idx: number) => () => {
    const changeValue = !isCollapsed[idx];

    const newState = isCollapsed.map((i, currIdx) => {
      if (currIdx !== idx) {
        return i;
      }

      return changeValue;
    });

    setIsCollapsed(newState);
  };

  const downloadData = usePrepareDownloadData(foodDataList);

  const handleDownload = () => {
    const ws = XLSXUtils.aoa_to_sheet(downloadData as any[][]);
    const wb = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(wb, ws, 'Sheet1');
    writeFile(wb, `Chi tiết đặt món.xlsx`);
  };

  useEffect(() => {
    setIsCollapsed(
      Array.from({
        length: foodDataList?.length,
      }).fill(0),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(foodDataList)]);

  const printThermalSection = async () => {
    if (!thermalPrintSectionRef.current) return;

    const convertToImage = await html2canvas(thermalPrintSectionRef.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
    });
    const imgData = convertToImage.toDataURL('image/png');

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument?.write(`
      <html>
        <head>
          <title>Print</title>
          <style>
            body { margin: 0 }
            @media print {
              @page { size: 62mm 43mm; margin: 0; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <img style="width: 59.452mm;" src="${imgData}" />
        </body>
      </html>
    `);
    iframe.contentDocument?.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };

  useEffect(() => {
    const generateQrCode = async () => {
      const src = await QRCode.toDataURL(
        `${process.env.NEXT_PUBLIC_CANONICAL_URL}/participant/order/${router.query.orderId}/?subOrderDate=${date}&openRatingModal=true`,
      );
      setQrCodeImageSrc(src);
    };

    generateQrCode();
  }, [router.query.orderId, date]);

  const participantDataList = useMemo(
    () =>
      participants
        .map((participant: TObject) => {
          return {
            id: participant?.id?.uuid,
            email: participant?.attributes?.email,
            name: buildFullName(
              participant?.attributes?.profile?.firstName,
              participant?.attributes?.profile?.lastName,
              {
                compareToGetLongerWith:
                  participant?.attributes?.profile?.displayName,
              },
            ),
          };
        })
        .concat(
          anonymous.map((participant: TObject) => {
            return {
              id: participant?.id?.uuid,
              email: participant?.attributes?.email,
              name: buildFullName(
                participant?.attributes?.profile?.firstName,
                participant?.attributes?.profile?.lastName,
                {
                  compareToGetLongerWith:
                    participant?.attributes?.profile?.displayName,
                },
              ),
            };
          }),
        ),
    [anonymous, participants],
  );

  const restaurantName = useMemo(() => {
    return orderDetail[date as string]?.restaurant?.restaurantName;
  }, [orderDetail, date]);

  const userLabelRecords: UserLabelRecord[] = useMemo(() => {
    return Object.entries<TObject>(
      orderDetail[date as string]?.memberOrders || {},
    ).reduce((acc: UserLabelRecord[], [userId, userOrder]) => {
      const { foodId, status, requirement } = userOrder;

      if (isJoinedPlan(foodId, status)) {
        const participant = participantDataList.find(
          (p: TObject) => p?.id === userId,
        );

        if (!participant) return acc;

        const userLabelRecord: UserLabelRecord = {
          partnerName: restaurantName,
          requirement: requirement || '',
          companyName:
            company?.attributes?.profile?.publicData?.companyName || '',
          mealDate: DateTime.fromMillis(Number(date)).toFormat('dd/MM/yyyy'),
          participantName: participant?.name,
          foodName: foodDataList?.find(
            (f: TObject) => f?.foodId === userOrder?.foodId,
          )?.foodName,
          timestamp: date,
          qrCodeImageSrc,
        };

        acc.push(userLabelRecord);
      }

      return acc;
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderDetail,
    date,
    participantDataList,
    restaurantName,
    company?.attributes?.profile?.publicData?.companyName,
    foodDataList,
    qrCodeImageSrc,
    DateTime,
  ]);

  return (
    <>
      <RenderWhen condition={!fetchOrderInProgress}>
        <div className={css.root}>
          <div className={css.goBackBtnWrapper}>
            <Button
              variant="inline"
              className={css.goBackBtn}
              onClick={onChangeViewMode(
                EPartnerSubOrderDetailPageViewMode.summary,
              )}>
              <IconArrow direction="left" className={css.arrowIcon} />
              <span className={css.goBackText}>
                {intl.formatMessage({ id: 'SubOrderDetail.goBackToSummary' })}
              </span>
            </Button>
          </div>

          <div className={css.actionContainer}>
            <div className={css.title}>
              {intl.formatMessage({ id: 'SubOrderDetail.title' })}
            </div>
            <div className="flex flex-row gap-4 items-center">
              <Button
                variant="secondary"
                className={css.downloadBtn}
                onClick={handleDownload}>
                <IconDownload className={css.iconDownload} />
                {intl.formatMessage({ id: 'SubOrderDetail.downloadFile' })}
              </Button>
              <Button
                variant="primary"
                loadingMode="extend"
                className={css.downloadBtn}
                onClick={() => {
                  setTimeout(() => {
                    printThermalSection();
                  });
                }}>
                <IconPrint color="#ffffff" />
                {intl.formatMessage({ id: 'SubOrderDetail.in-tem-nhiet' })}
              </Button>
            </div>
          </div>

          <div className={css.tableContainer}>
            <div className={css.tableHead}>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.no',
                })}
              </div>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.foodType',
                })}
              </div>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.quantity',
                })}
              </div>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.unitPrice',
                })}
              </div>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.totalPrice',
                })}
              </div>
              <div></div>
            </div>
            <div className={css.tableHeadMobile}>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.no',
                })}
              </div>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.foodType',
                })}
              </div>
              <div>
                {intl.formatMessage({
                  id: 'SubOrderDetail.tableHead.note',
                })}
              </div>
              <div></div>
            </div>

            <div className={css.tableBody}>
              {foodDataList?.map((foodData: TObject, foodIndex: number) => {
                const { foodPrice, foodName, frequency, notes } = foodData;

                const groupTitleClasses = classNames(css.groupTitle, {
                  [css.collapsed]: isCollapsed[foodIndex],
                });
                const rowsClasses = classNames(css.rows, {
                  [css.collapsed]: isCollapsed[foodIndex],
                });
                const iconClasses = classNames({
                  [css.reversed]: isCollapsed[foodIndex],
                });

                return (
                  <div className={css.tableRowGroup} key={foodIndex}>
                    <div className={groupTitleClasses}>
                      <div>{foodIndex + 1}</div>
                      <div>{foodName}</div>
                      <RenderWhen condition={!isMobileLayout}>
                        <div>{frequency}</div>
                        <div>{parseThousandNumber(foodPrice || 0)}đ</div>
                        <div>
                          {parseThousandNumber((foodPrice || 0) * frequency)}đ
                        </div>

                        <RenderWhen.False>
                          <div>{`${frequency} x ${parseThousandNumber(
                            foodPrice || 0,
                          )}đ`}</div>
                        </RenderWhen.False>
                      </RenderWhen>
                      <div
                        className={css.actionCell}
                        onClick={handleClickGroupTitle(foodIndex)}>
                        <IconArrow className={iconClasses} />
                      </div>
                    </div>
                    <div className={rowsClasses}>
                      {notes.map(
                        ({ note, name }: TObject, noteIndex: number) => {
                          return (
                            <div className={css.row} key={noteIndex}>
                              <div>
                                {foodIndex + 1}.{noteIndex + 1}
                              </div>
                              <div>{name}</div>
                              <div title={note}>{note || '-'}</div>
                              <div></div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </RenderWhen>
      <div className="h-0 overflow-hidden absolute">
        <div
          className="flex flex-wrap gap-2 flex-col"
          ref={thermalPrintSectionRef}>
          <UserLabelThermalPrintSection userLabelRecords={userLabelRecords} />
        </div>
      </div>
    </>
  );
};

export default SubOrderDetail;
