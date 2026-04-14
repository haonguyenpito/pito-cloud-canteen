import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PiQrCode } from 'react-icons/pi';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import classNames from 'classnames';
import clsx from 'clsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import isEmpty from 'lodash/isEmpty';
import { DateTime } from 'luxon';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import QRCode from 'qrcode';

import Button from '@components/Button/Button';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import IconDownload from '@components/Icons/IconDownload/IconDownload';
import IconUpdate from '@components/Icons/IconUpdate/IconUpdate';
import Modal from '@components/Modal/Modal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import SlideModal from '@components/SlideModal/SlideModal';
import Tooltip from '@components/Tooltip/Tooltip';
import { parseThousandNumber } from '@helpers/format';
import logger from '@helpers/logger';
import { isJoinedPlan } from '@helpers/order/orderPickingHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import { orderManagementThunks } from '@redux/slices/OrderManagement.slice';
import { enGeneralPaths } from '@src/paths';
import type {
  MealItemsFailed,
  OrderListing,
  PlanListing,
  UserListing,
} from '@src/types';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import type { TObject, TUser } from '@utils/types';

import ReasonFieldMealItemFailed from './ReasonFieldMealItemFailed';

import css from './ReviewOrdersResultModal.module.scss';

const UserLabelCellContent = dynamic(() => import('./UserLabelCellContent'), {
  ssr: false,
});

const UserLabelHiddenSection = dynamic(
  () => import('./UserLabelHiddenSection'),
  { ssr: false },
);

const UserLabelPreviewModal = dynamic(() => import('./UserLabelPreviewModal'), {
  ssr: false,
});

export function UserLabelThermalPrintSection({
  userLabelRecords,
}: {
  userLabelRecords: UserLabelRecord[];
}) {
  return (
    <>
      {userLabelRecords.map((userLabelRecord, idx) => (
        <div key={idx} className="w-[62mm] h-[43mm]">
          <UserLabelCellContent
            type="thermal"
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
    </>
  );
}

export interface UserLabelRecord {
  partnerName: string;
  companyName: string;
  mealDate: string;
  timestamp: string;
  participantName: string;
  foodName: string;
  groupName?: string;
  requirement?: string;
  qrCodeImageSrc: string;
}

const prepareData = ({
  orderDetail = {},
  participantData = {},
}: {
  orderDetail: TObject;
  participantData: TObject;
}) => {
  return Object.entries<TObject>(orderDetail).reduce<TObject[]>(
    (result, currentOrderDetailEntry) => {
      const [date, rawOrderDetailOfDate] = currentOrderDetailEntry;

      const { memberOrders = {}, restaurant = {} } = rawOrderDetailOfDate;
      const { foodList: foodListOfDate = {} } = restaurant;

      const orderData = Object.entries<TObject>(memberOrders).reduce<TObject[]>(
        (memberOrderResult, currentMemberOrderEntry) => {
          const [memberId, memberOrderData] = currentMemberOrderEntry;
          const {
            foodId,
            secondaryFoodId,
            status,
            requirement = '',
            secondaryRequirement = '',
          } = memberOrderData;

          const appendFoodToResult = (
            items: TObject[],
            id?: string,
            requirementValue: string = '',
          ) => {
            if (!id || !isJoinedPlan(id, status)) {
              return items;
            }
            const foodDataOfDate = foodListOfDate[id];
            if (!foodDataOfDate) {
              return items;
            }

            return items.concat({
              memberData: participantData[memberId],
              foodData: {
                requirement: requirementValue,
                foodId: id,
                ...foodDataOfDate,
              },
              restaurant,
            });
          };

          let nextResult = appendFoodToResult(
            memberOrderResult,
            foodId,
            requirement,
          );
          nextResult = appendFoodToResult(
            nextResult,
            secondaryFoodId,
            secondaryRequirement,
          );

          return nextResult;
        },
        [],
      );

      return [
        ...result,
        {
          date,
          orderData,
        },
      ];
    },
    [],
  );
};

const prepareDataGroups = ({
  orderDetail = {},
  participantData = {},
  groups = [],
}: {
  orderDetail: TObject;
  participantData: TObject;
  groups: TObject[];
}): TObject[] => {
  return Object.entries<TObject>(orderDetail).reduce<TObject[]>(
    (result, [date, rawOrderDetailOfDate]) => {
      const { memberOrders = {}, restaurant = {} } = rawOrderDetailOfDate;
      const { foodList: foodListOfDate = {} } = restaurant;

      const participantMap = participantData as Record<string, TObject>;

      // Prepare order data grouped by defined groups
      const groupOrderData = groups
        .map((group) => {
          const { id: groupId, name: groupName, members = [] } = group;

          const memberIds = members.map((m: TObject) => m.id);
          const joinedParticipantCount = memberIds.filter((memberId: string) =>
            isJoinedPlan(
              memberOrders[memberId]?.foodId,
              memberOrders[memberId]?.status,
            ),
          ).length;
          const orderData = memberIds
            .flatMap((memberId: string) => {
              const memberOrder = memberOrders[memberId];
              if (!memberOrder) return [];

              const {
                foodId,
                secondaryFoodId,
                status,
                requirement = '',
                secondaryRequirement = '',
              } = memberOrder;

              const buildFoodData = (
                id?: string,
                requirementValue: string = '',
              ) => {
                if (!id || !isJoinedPlan(id, status)) return [];
                const foodDataOfDate = foodListOfDate[id];
                if (!foodDataOfDate) return [];

                return [
                  {
                    memberData: participantMap[memberId],
                    foodData: {
                      requirement: requirementValue,
                      foodId: id,
                      ...foodDataOfDate,
                    },
                    restaurant,
                  },
                ];
              };

              return [
                ...buildFoodData(foodId, requirement),
                ...buildFoodData(secondaryFoodId, secondaryRequirement),
              ];
            })
            .sort((a: TObject, b: TObject) => {
              const foodNameA = a.foodData?.foodName || '';
              const foodNameB = b.foodData?.foodName || '';

              return foodNameA.localeCompare(foodNameB);
            });

          return {
            groupId,
            groupName,
            orderData,
            joinedParticipantCount,
          };
        })
        .sort((a, b) => {
          const groupNameA = a.groupName || '';
          const groupNameB = b.groupName || '';

          return groupNameA.localeCompare(groupNameB);
        });

      // Handle members not in any group
      const allGroupMemberIds = new Set(
        groups.flatMap((g) => g.members.map((m: TObject) => m.id)),
      );
      let otherJoinedParticipantCount = 0;

      const orderDataForOthers = Object.entries<TObject>(memberOrders)
        .filter(([memberId]) => !allGroupMemberIds.has(memberId))
        .flatMap(([memberId, memberOrderData]) => {
          if (isJoinedPlan(memberOrderData?.foodId, memberOrderData?.status)) {
            otherJoinedParticipantCount += 1;
          }
          const {
            foodId,
            secondaryFoodId,
            status,
            requirement = '',
            secondaryRequirement = '',
          } = memberOrderData;

          const buildFoodData = (
            id?: string,
            requirementValue: string = '',
          ) => {
            if (!id || !isJoinedPlan(id, status)) return [];
            const foodDataOfDate = foodListOfDate[id];
            if (!foodDataOfDate) return [];

            return [
              {
                memberData: participantMap[memberId],
                foodData: {
                  requirement: requirementValue,
                  foodId: id,
                  ...foodDataOfDate,
                },
                restaurant,
              },
            ];
          };

          return [
            ...buildFoodData(foodId, requirement),
            ...buildFoodData(secondaryFoodId, secondaryRequirement),
          ];
        });

      return [
        ...result,
        {
          date,
          groupOrderData,
          orderDataForOthers,
          joinedParticipantCount: otherJoinedParticipantCount,
        },
      ];
    },
    [],
  );
};

type TGroupedOrderData = {
  memberName: string;
  memberId: string;
  email?: string;
  totalPrice: number;
  foodNames: string[];
  requirements: string[];
  foodIds: string[];
};

const groupOrderDataByUser = (orderData: TObject[]): TGroupedOrderData[] => {
  const grouped: Record<string, TGroupedOrderData> = (orderData || []).reduce(
    (acc: Record<string, TGroupedOrderData>, row: TObject) => {
      const {
        memberData,
        foodData: { foodId, foodName, foodPrice = 0, requirement } = {},
      } = row || {};

      const {
        name: memberName,
        id: memberId,
        email,
      }: { name?: string; id?: string; email?: string } = memberData || {};

      const key = email || memberId;

      if (!key || !memberId) return acc;

      if (!acc[key]) {
        acc[key] = {
          memberName: memberName || '',
          memberId,
          email,
          totalPrice: 0,
          foodNames: [],
          requirements: [],
          foodIds: [],
        };
      }

      if (foodName) {
        acc[key].foodNames.push(foodName);
      }

      if (requirement) {
        acc[key].requirements.push(requirement);
      }

      if (foodId) {
        acc[key].foodIds.push(foodId);
      }

      acc[key].totalPrice += Number(foodPrice) || 0;

      return acc;
    },
    {},
  );

  return Object.values(grouped);
};

type TReviewOrdersResultModalProps = {
  isOpen: boolean;
  data: TObject;
  onClose: () => void;
  onDownloadReviewOrderResults: () => void;
  planListing?: PlanListing;
};

const ReviewOrdersResultModal: React.FC<TReviewOrdersResultModalProps> = (
  props,
) => {
  const { isOpen, onClose, onDownloadReviewOrderResults, data, planListing } =
    props;
  const showQRCode = planListing?.attributes?.metadata?.allowToQRCode;
  const planId = planListing?.id?.uuid;
  const intl = useIntl();
  const { isMobileLayout } = useViewport();
  const [expandingStatusMap, setExpandingStatusMap] = useState<any>({});
  const [isViewUserLabelModalOpen, setIsViewUserLabelModalOpen] =
    useState(false);
  const [userLabelPreviewSrcs, setUserLabelPreviewSrcs] = useState<string[]>(
    [],
  );
  const [targetedDate, setTargetDate] = useState<string | 'all'>('all');
  const [mealItemsFailed, setMealItemsFailed] = useState<MealItemsFailed>({});
  const allowTriggerGenerateUserLabelFile = useRef(false);

  const [isGeneratingUserLabelFile, setIsGeneratingUserLabelFile] =
    useState(false);

  const dispatch = useAppDispatch();
  const currentUser: UserListing | null = useAppSelector(
    (state) => state.user.currentUser,
  );

  const company: UserListing | null = useAppSelector(
    (state) => state.OrderManagement.companyData,
    shallowEqual,
  );

  const planData: PlanListing | null = useAppSelector(
    (state) => state.OrderManagement.planData,
    shallowEqual,
  );

  const orderDataListing: OrderListing | null = useAppSelector(
    (state) => state.OrderManagement.orderData,
    shallowEqual,
  );

  const isUpdatingMealItemsFailed: boolean = useAppSelector(
    (state) => state.OrderManagement.isUpdatingMealItemsFailed,
  );

  const thermalPrintSectionRef = useRef<HTMLDivElement>(null);

  const [qrCodeImageSrcMap, setQrCodeImageSrcMap] = useState<
    Record<string, string>
  >({});
  const router = useRouter();
  const isAdmin = currentUser?.attributes?.profile?.metadata?.isAdmin;
  const groups = useMemo(
    () => company?.attributes?.profile?.metadata?.groups || [],
    [company],
  );

  const isHasGroups = groups.length > 0;

  const {
    orderDetail,
    participants = [],
    participantData: participantDataFromProps = [],
    anonymous = [],
    anonymousParticipantData: anonymousParticipantDataFromProps = [],
  } = data || {};

  const modalTitle = (
    <span className={css.modalTitle}>
      {intl.formatMessage({
        id: 'ReviewOrdersResultModal.title',
      })}
    </span>
  );

  const participantDataList = useMemo(
    () =>
      participants
        .map((pid: string) => {
          const participant = participantDataFromProps.find(
            (p: TUser) => pid === p.id.uuid,
          ) as UserListing | undefined;

          return {
            id: pid,
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
          anonymous.map((pid: string) => {
            const participant = anonymousParticipantDataFromProps.find(
              (p: TUser) => pid === p.id.uuid,
            ) as UserListing | undefined;

            return {
              id: pid,
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
    [
      anonymous,
      anonymousParticipantDataFromProps,
      participantDataFromProps,
      participants,
    ],
  );

  const participantDataMap = useMemo(
    () =>
      participantDataList.reduce((res: TObject, curr: TObject) => {
        return { ...res, [curr.id]: curr };
      }, {}),
    [participantDataList],
  );

  const preparedData = useMemo(
    () =>
      prepareData({
        orderDetail,
        participantData: participantDataMap,
      }),
    [orderDetail, participantDataMap],
  );

  const preparedDataGroups = useMemo(
    () =>
      prepareDataGroups({
        orderDetail,
        participantData: participantDataMap,
        groups: (groups || []).filter((g): g is TObject => Boolean(g)),
      }),
    [orderDetail, participantDataMap, groups],
  );

  const toggleCollapseStatus = (date: string) => () => {
    setExpandingStatusMap({
      ...expandingStatusMap,
      [date]: !expandingStatusMap[date],
    });
  };

  useEffect(() => {
    if (planData?.attributes?.metadata?.mealItemsFailed) {
      setMealItemsFailed(
        (planData?.attributes?.metadata?.mealItemsFailed ??
          {}) as MealItemsFailed,
      );
    }
  }, [planData.attributes?.metadata?.mealItemsFailed]);

  useEffect(() => {
    if (!isEmpty(preparedData)) {
      const updateObject = preparedData.reduce(
        (result: any, { date, orderData }: any) => {
          if (typeof result[date] === 'undefined') {
            if (!isEmpty(orderData)) result[date] = true;
          }

          return result;
        },
        expandingStatusMap,
      );
      setExpandingStatusMap(updateObject);
    }
  }, [JSON.stringify(preparedData)]);

  const generatePDFModeLabels = useCallback(
    async (exportType: 'preview' | 'pdf-file') => {
      if (!isAdmin) return;
      if (!allowTriggerGenerateUserLabelFile.current) return;

      logger.info('Generating user labels...', 'START');

      // eslint-disable-next-line new-cap
      const pdf = new jsPDF('p', 'mm', 'a4');

      const printableAreas = document.querySelectorAll('[id^=printable-area-]');
      const pageHeight = pdf.internal.pageSize.height;
      const pageWidth = pdf.internal.pageSize.width;
      const _userLabelPreviewSrcs = [];

      setIsGeneratingUserLabelFile(true);
      for (let i = 0; i < printableAreas.length; i++) {
        const printableArea = printableAreas[i];
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(printableArea as any, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
        });

        const imgData = canvas.toDataURL('image/png');

        if (exportType === 'preview') {
          _userLabelPreviewSrcs.push(imgData);
        }

        if (exportType === 'pdf-file') {
          const marginTopBottom = 4;
          const marginLeftRight = 4;
          pdf.addImage(
            imgData,
            'PNG',
            marginLeftRight,
            marginTopBottom,
            pageWidth - marginLeftRight * 2,
            pageHeight - marginTopBottom,
            undefined,
            'FAST',
          );

          if (i < printableAreas.length - 1) {
            pdf.addPage();
          }
        }
      }

      if (exportType === 'preview') {
        setUserLabelPreviewSrcs(_userLabelPreviewSrcs);
      }

      if (exportType === 'pdf-file') {
        pdf.save('user-labels.pdf');
      }

      setIsGeneratingUserLabelFile(false);
    },
    [isAdmin],
  );

  /**
   * Generate QR code image src
   */
  useEffect(() => {
    const datesNeededToGenerateQrCode = preparedData.reduce<Set<string>>(
      (result, { date }) => {
        if (date === targetedDate || targetedDate === 'all') {
          result.add(date);
        }

        return result;
      },
      new Set<string>(),
    );

    const generateQrCodeImageSrcsPromises = Array.from(
      datesNeededToGenerateQrCode,
    ).map(async (date) => {
      const src = await QRCode.toDataURL(
        `${process.env.NEXT_PUBLIC_CANONICAL_URL}/participant/order/${router.query.orderId}/?subOrderDate=${date}&openRatingModal=true`,
      );

      return { [date]: src };
    });

    Promise.all(generateQrCodeImageSrcsPromises).then((srcs) => {
      setQrCodeImageSrcMap(
        srcs.reduce((result, current) => ({ ...result, ...current }), {}),
      );
    });
  }, [preparedData, router.query.orderId, targetedDate]);

  /**
   * When targetedDate is changed, trigger the generation of user labels
   */
  useEffect(() => {
    if (isOpen && targetedDate) {
      generatePDFModeLabels('preview');
    }
  }, [targetedDate, isOpen, generatePDFModeLabels]);

  const withSetCurrentDateTo =
    (date: string | 'all', callback: () => void) => () => {
      allowTriggerGenerateUserLabelFile.current = true;
      setTargetDate(date);
      setTimeout(callback);
    };

  const printThermalSection = async () => {
    if (!allowTriggerGenerateUserLabelFile.current) return;

    const printContent = thermalPrintSectionRef.current?.innerHTML;
    if (!printContent) return;
    const convertToImage = await html2canvas(thermalPrintSectionRef.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
    });
    const imgData = convertToImage.toDataURL('image/png');

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow?.document.write(`
      <style>
        body {
          margin: 0;
        }

        @media print {
          body {
            margin: 0;
          }

          @page {
            size: 62mm 43mm;
            margin: 0;
          }
        }
      </style>
      <img style="width: 59.452mm;" src="${imgData}" />
    `);
    printWindow?.document.close();
    printWindow?.print();
  };

  const handleDownloadQRCode = async ({
    groupId,
    screen,
  }: {
    groupId?: string;
    screen?: string;
  }) => {
    try {
      const baseUrl = `${process.env.NEXT_PUBLIC_CANONICAL_URL}/qrcode`;
      const queryParams = new URLSearchParams();

      if (company?.id?.uuid) queryParams.append('companyId', company?.id?.uuid);
      if (groupId) queryParams.append('groupId', groupId);
      if (screen) queryParams.append('screen', screen);

      const dataToEncode = queryParams.toString()
        ? `${baseUrl}?${queryParams.toString()}`
        : baseUrl;
      const canvas = document.createElement('canvas');

      // Tạo QR code trong canvas
      await QRCode.toCanvas(canvas, dataToEncode, { width: 256 });

      // Tạo link download
      const imageUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = imageUrl;
      downloadLink.download = 'qr-code.png';
      downloadLink.click();
    } catch (error) {
      console.error('Lỗi tạo QR Code:', error);
    }
  };

  const onCheckMealItemFailed = ({
    timestamp,
    memberId,
    foodId,
    reason,
  }: {
    timestamp: string;
    memberId: string;
    foodId: string;
    reason: string;
  }) => {
    setMealItemsFailed((prev: MealItemsFailed) => {
      const list = prev[timestamp] ?? [];
      const idx = list.findIndex(
        (it) => it.memberId === memberId && it.foodId === foodId,
      );

      if (idx !== -1) {
        if (list.length === 1) {
          const next = { ...prev };
          delete next[timestamp];

          return next;
        }
        const nextList = [...list.slice(0, idx), ...list.slice(idx + 1)];

        return { ...prev, [timestamp]: nextList };
      }

      return {
        ...prev,
        [timestamp]: [...list, { memberId, foodId, reason }],
      };
    });
  };

  const onChangeReasonInput = ({
    timestamp,
    memberId,
    foodId,
    reason,
  }: {
    timestamp: string;
    memberId: string;
    foodId: string;
    reason: string;
  }) => {
    setMealItemsFailed((prev: MealItemsFailed) => ({
      ...prev,
      [timestamp]: (prev[timestamp] || []).map((item) =>
        item.memberId === memberId && item.foodId === foodId
          ? { ...item, reason }
          : item,
      ),
    }));
  };

  const onUpdateMealItemsFailed = () => {
    dispatch(
      orderManagementThunks.updateMealItemsFailed({
        planId: planListing?.id?.uuid!,
        mealItemsFailed,
        quotationId: orderDataListing?.attributes?.metadata?.quotationId,
      }),
    )
      .then(() => {
        toast.success('Cập nhật phần ăn lỗi thành công');
        onClose();
      })
      .catch(() => {
        toast.error('Cập nhật phần ăn lỗi thất bại');
      });
  };

  const userLabelRecords: UserLabelRecord[] = isHasGroups
    ? (preparedDataGroups.reduce(
        (result, { date, groupOrderData, orderDataForOthers }) => {
          if (date === targetedDate || targetedDate === 'all') {
            const processData = (orderData: any[], groupName?: string) => {
              return orderData.map(
                ({
                  memberData,
                  foodData,
                  restaurant,
                }: {
                  memberData: {
                    name: string;
                  };
                  foodData: {
                    foodName: string;
                    requirement: string;
                  };
                  restaurant: {
                    restaurantName: string;
                  };
                }) => {
                  const { name: participantName } = memberData || {};
                  const { foodName, requirement } = foodData || {};

                  const userLabelRecord: UserLabelRecord = {
                    partnerName: restaurant?.restaurantName,
                    requirement,
                    companyName:
                      company?.attributes?.profile?.publicData?.companyName ||
                      '',
                    mealDate: DateTime.fromMillis(Number(date)).toFormat(
                      'dd/MM/yyyy',
                    ),
                    participantName,
                    foodName,
                    timestamp: date,
                    groupName,
                    qrCodeImageSrc: qrCodeImageSrcMap[date],
                  };

                  return userLabelRecord;
                },
              );
            };
            const userLabelData = [
              ...processData(orderDataForOthers),
              ...groupOrderData.flatMap((group: TObject) =>
                processData(group.orderData, group.groupName),
              ),
            ];

            return result.concat(userLabelData);
          }

          return result;
        },
        [] as UserLabelRecord[],
      ) as UserLabelRecord[])
    : preparedData
        .reduce<UserLabelRecord[]>((result, { date, orderData }) => {
          if (date === targetedDate || targetedDate === 'all') {
            const userLabelData = orderData.map(
              ({
                memberData,
                foodData,
                restaurant,
              }: {
                memberData: {
                  name: string;
                };
                foodData: {
                  foodName: string;
                  requirement: string;
                };
                restaurant: {
                  restaurantName: string;
                };
              }) => {
                const { name: participantName } = memberData || {};
                const { foodName, requirement } = foodData || {};

                const userLabelRecord: UserLabelRecord = {
                  partnerName: restaurant?.restaurantName,
                  requirement,
                  companyName:
                    company?.attributes?.profile?.publicData?.companyName || '',
                  mealDate: DateTime.fromMillis(Number(date)).toFormat(
                    'dd/MM/yyyy',
                  ),
                  participantName,
                  foodName,
                  timestamp: date,
                  qrCodeImageSrc: qrCodeImageSrcMap[date],
                };

                return userLabelRecord;
              },
            );

            return result.concat(userLabelData);
          }

          return result;
        }, [] as UserLabelRecord[])
        .sort((a, b) => {
          if (a.foodName < b.foodName) {
            return -1;
          }

          if (a.foodName > b.foodName) {
            return 1;
          }

          return 0;
        });

  const renderComponentQRCode = (groupId?: string) => {
    return (
      <div className="flex gap-2 items-center divide-x divide-gray-300">
        {[
          {
            title: 'Màn hình 1',
            id: 'A',
          },
          // {
          //   title: 'Màn hình 2',
          //   id: 'B',
          // },
        ].map((item) => {
          return (
            <div
              className={clsx(
                'flex gap-2 items-center',
                item.id === 'B' && 'pl-2',
              )}
              key={item.id}>
              <Tooltip tooltipContent="Tải mã QR" placement="top">
                <PiQrCode
                  className="size-[20px] text-blue-600 cursor-pointer transition-all"
                  onClick={() =>
                    handleDownloadQRCode({
                      groupId,
                      screen: item.id,
                    })
                  }
                />
              </Tooltip>
              <Link
                href={`${enGeneralPaths.admin.scanner['[planId]'][
                  '[timestamp]'
                ].index(String(planId), groupId || '')}?screen=${item.id}`}
                legacyBehavior>
                <a target="_blank">
                  <Button variant="inline" size="small" className="!px-1">
                    <div className="flex items-center gap-1 text-blue-500">
                      <span>Mở trang scan {item.title}</span>
                      <svg
                        fill="currentColor"
                        viewBox="0 0 32 32"
                        width="20px"
                        height="20px"
                        xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                        <g
                          id="SVGRepo_tracerCarrier"
                          stroke-linecap="round"
                          stroke-linejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <path d="M23.5 23.5h-15v-15h4.791V6H6v20h20v-7.969h-2.5z"></path>
                          <path d="M17.979 6l3.016 3.018-6.829 6.829 1.988 1.987 6.83-6.828L26 14.02V6z"></path>
                        </g>
                      </svg>
                    </div>
                  </Button>
                </a>
              </Link>
            </div>
          );
        })}
      </div>
    );
  };

  const content = (
    <>
      <div className="flex gap-2 justify-end mb-4">
        {isAdmin && (
          <Button
            size="small"
            variant="primary"
            className="h-[36px] px-2"
            inProgress={isUpdatingMealItemsFailed}
            onClick={onUpdateMealItemsFailed}>
            <IconUpdate className="min-w-[16px] min-h-[16px]" color="#ffffff" />
            Cập nhập phần ăn bị lỗi
          </Button>
        )}
        <Button
          size="small"
          variant="secondary"
          className="h-[36px] px-2 !border-blue-500 hover:!text-stone-600"
          onClick={onDownloadReviewOrderResults}>
          <IconDownload className="min-w-[24px] min-h-[24px]" />
          {isMobileLayout
            ? intl.formatMessage({
                id: 'ReviewOrdersResultModal.mobileDownloadFileText',
              })
            : intl.formatMessage({
                id: 'ReviewOrdersResultModal.downloadFileText',
              })}
        </Button>
        {isAdmin && !!participants?.length && (
          <Button
            size="small"
            loadingMode="extend"
            variant="secondary"
            inProgress={isGeneratingUserLabelFile && targetedDate === 'all'}
            className="h-[36px] px-2 !border-blue-500 hover:!text-stone-600 hover:stroke-stone-600"
            onClick={withSetCurrentDateTo('all', () => {
              setTimeout(() => {
                generatePDFModeLabels('pdf-file');
              });
            })}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              width="24px"
              height="24px"
              xmlns="http://www.w3.org/2000/svg">
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                {' '}
                <path
                  d="M8.5 7L8.5 14M8.5 14L11 11M8.5 14L6 11"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"></path>{' '}
                <path
                  d="M15.5 7L15.5 14M15.5 14L18 11M15.5 14L13 11"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"></path>{' '}
                <path
                  d="M18 17H12H6"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"></path>{' '}
                <path
                  d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"></path>{' '}
              </g>
            </svg>
            &nbsp;
            <span>Tải toàn bộ label</span>
          </Button>
        )}
      </div>
      <div className={css.tableContainer}>
        <div className="min-w-[700px] overflow-x-scroll md:overflow-auto md:min-w-[unset]">
          <div className="flex items-center bg-gray-100 p-2 rounded-t-md text-sm font-semibold uppercase gap-2">
            <div className="flex-1 basis-[80px]">
              {intl.formatMessage({
                id: 'ReviewOrdersResultModal.tableHead.name',
              })}
            </div>
            <div className="flex-1">
              {intl.formatMessage({
                id: 'ReviewOrdersResultModal.tableHead.foodName',
              })}
            </div>
            <div className="flex-1">
              {intl.formatMessage({
                id: 'ReviewOrdersResultModal.tableHead.price',
              })}
            </div>
            <div className="flex-1">
              {intl.formatMessage({
                id: 'ReviewOrdersResultModal.tableHead.requirement',
              })}
            </div>
            <div className="flex-1">PHẦN ĂN BỊ LỖI</div>
          </div>
          {isHasGroups ? (
            <>
              {preparedDataGroups.map(
                ({ date, groupOrderData, orderDataForOthers }) => {
                  const isExpanding = expandingStatusMap[date];
                  const isEmptyOrderData = isEmpty(groupOrderData);

                  return (
                    <div className={css.dateContainer} key={date}>
                      <div className={css.dateTitle}>
                        <div className="flex-1 flex items-center">
                          {intl.formatMessage(
                            { id: 'ReviewOrdersResultModal.dateTitle' },
                            {
                              date: DateTime.fromMillis(Number(date)).toFormat(
                                'dd/MM/yyyy',
                              ),
                            },
                          )}
                        </div>
                        <RenderWhen condition={!isEmptyOrderData}>
                          <div className="flex flex-wrap justify-end gap-2 items-center">
                            {isAdmin && (
                              <RenderWhen condition={!isMobileLayout}>
                                <div className="flex gap-2 items-center bg-orange-50 py-1 px-2 rounded-lg border border-orange-200">
                                  <p className="text-xs ">Máy in nhiệt</p>
                                  <Button
                                    variant="inline"
                                    size="small"
                                    className={classNames({
                                      '!bg-gray-200':
                                        isGeneratingUserLabelFile &&
                                        targetedDate === date,
                                    })}
                                    inProgress={
                                      isGeneratingUserLabelFile &&
                                      targetedDate === date
                                    }
                                    loadingMode="extend"
                                    onClick={withSetCurrentDateTo(date, () => {
                                      setTimeout(() => {
                                        printThermalSection();
                                      });
                                    })}>
                                    In label
                                  </Button>
                                </div>
                              </RenderWhen>
                            )}

                            {isAdmin && (
                              <div className="flex gap-2 items-center bg-blue-50 py-1 px-2 rounded-lg border border-blue-200">
                                <p className="text-xs ">File label</p>
                                <RenderWhen condition={!isMobileLayout}>
                                  <Button
                                    variant="inline"
                                    size="small"
                                    className={classNames({
                                      '!bg-gray-200':
                                        isGeneratingUserLabelFile &&
                                        targetedDate === date,
                                    })}
                                    inProgress={
                                      isGeneratingUserLabelFile &&
                                      targetedDate === date
                                    }
                                    onClick={withSetCurrentDateTo(date, () => {
                                      setTimeout(() => {
                                        setIsViewUserLabelModalOpen(true);
                                      });
                                    })}>
                                    Xem label
                                  </Button>
                                  <Button
                                    variant="inline"
                                    size="small"
                                    inProgress={
                                      isGeneratingUserLabelFile &&
                                      targetedDate === date
                                    }
                                    loadingMode="extend"
                                    className={classNames({
                                      '!bg-gray-200':
                                        isGeneratingUserLabelFile &&
                                        targetedDate === date,
                                    })}
                                    onClick={withSetCurrentDateTo(date, () => {
                                      setTimeout(() => {
                                        generatePDFModeLabels('pdf-file');
                                      });
                                    })}>
                                    Tải label
                                  </Button>
                                </RenderWhen>
                              </div>
                            )}
                            <IconArrow
                              direction={isExpanding ? 'up' : 'down'}
                              onClick={toggleCollapseStatus(date)}
                            />
                          </div>
                        </RenderWhen>
                      </div>
                      {groupOrderData.map((group: TObject) => {
                        return (
                          <React.Fragment key={group.groupId}>
                            <div className={css.dateTitle}>
                              <div className="flex-1 flex items-center">
                                {group?.groupName}
                                {group?.orderData?.length > 0 &&
                                  `(Số lượng: ${group.joinedParticipantCount})`}
                              </div>
                              <RenderWhen condition={!isEmptyOrderData}>
                                <div className="flex flex-wrap justify-end items-center">
                                  {isAdmin &&
                                    showQRCode &&
                                    renderComponentQRCode(group?.groupId)}

                                  <IconArrow
                                    direction={isExpanding ? 'up' : 'down'}
                                    onClick={toggleCollapseStatus(date)}
                                  />
                                </div>
                              </RenderWhen>
                            </div>
                            <RenderWhen condition={isExpanding}>
                              <div className="w-full">
                                {groupOrderDataByUser(
                                  group?.orderData || [],
                                ).map(
                                  ({
                                    memberName,
                                    memberId,
                                    email,
                                    totalPrice,
                                    foodNames,
                                    requirements,
                                    foodIds,
                                  }) => {
                                    const isMealItemFailed = (
                                      mealItemsFailed[date] || []
                                    ).some(
                                      (item) => item.memberId === memberId,
                                    );

                                    const initialReason =
                                      (mealItemsFailed[date] || []).find(
                                        (i) => i.memberId === memberId,
                                      )?.reason ?? '';

                                    const foodNameDisplay =
                                      foodNames.join(' + ');
                                    const requirementDisplay =
                                      requirements.join('\n');

                                    return (
                                      <div
                                        key={memberId}
                                        className="flex items-center w-full">
                                        <div className="flex items-center flex-1 text-xs p-2 gap-2">
                                          <div className="flex-1 basis-[80px] font-semibold">
                                            {memberName}
                                            <br />
                                            <span className="text-gray-500">
                                              {email}
                                            </span>
                                          </div>

                                          <div className="text-xs flex-1 font-semibold">
                                            {foodNameDisplay}
                                          </div>
                                          <div className="text-xs flex-1">{`${parseThousandNumber(
                                            totalPrice,
                                          )}đ`}</div>
                                          {requirementDisplay ? (
                                            <Tooltip
                                              overlayClassName={
                                                css.requirementTooltip
                                              }
                                              tooltipContent={
                                                requirementDisplay
                                              }
                                              placement="bottomLeft">
                                              <div className="flex-1 whitespace-pre-line">
                                                {requirementDisplay}
                                              </div>
                                            </Tooltip>
                                          ) : (
                                            <div className="flex-1">-</div>
                                          )}
                                          <div className="text-xs flex-1">
                                            <ReasonFieldMealItemFailed
                                              readOnly={!isAdmin}
                                              checked={isMealItemFailed}
                                              initialReason={initialReason}
                                              onChange={(checked, reason) => {
                                                foodIds.forEach(
                                                  (foodId: string) => {
                                                    onCheckMealItemFailed({
                                                      timestamp: date,
                                                      foodId,
                                                      memberId,
                                                      reason: checked
                                                        ? reason
                                                        : '',
                                                    });
                                                  },
                                                );
                                              }}
                                              onChangeReasonInput={(reason) => {
                                                foodIds.forEach(
                                                  (foodId: string) => {
                                                    onChangeReasonInput({
                                                      timestamp: date,
                                                      foodId,
                                                      memberId,
                                                      reason,
                                                    });
                                                  },
                                                );
                                              }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </RenderWhen>
                          </React.Fragment>
                        );
                      })}
                      {orderDataForOthers?.length > 0 && (
                        <>
                          <React.Fragment>
                            <div className={css.dateTitle}>
                              <div className="flex-1 flex items-center">
                                Không có nhóm
                              </div>
                              <RenderWhen condition={!isEmptyOrderData}>
                                <div className="flex flex-wrap justify-end gap-2 items-center">
                                  {isAdmin &&
                                    showQRCode &&
                                    renderComponentQRCode()}

                                  <IconArrow
                                    direction={isExpanding ? 'up' : 'down'}
                                    onClick={toggleCollapseStatus(date)}
                                  />
                                </div>
                              </RenderWhen>
                            </div>
                            <RenderWhen condition={isExpanding}>
                              <div className="w-full">
                                {groupOrderDataByUser(
                                  orderDataForOthers || [],
                                ).map(
                                  ({
                                    memberName,
                                    memberId,
                                    totalPrice,
                                    foodNames,
                                    requirements,
                                    foodIds,
                                  }) => {
                                    const isMealItemFailed = (
                                      mealItemsFailed[date] || []
                                    ).some(
                                      (item) => item.memberId === memberId,
                                    );

                                    const initialReason =
                                      (mealItemsFailed[date] || []).find(
                                        (i) => i.memberId === memberId,
                                      )?.reason ?? '';

                                    const foodNameDisplay =
                                      foodNames.join(' + ');
                                    const requirementDisplay =
                                      requirements.join('\n');

                                    return (
                                      <div
                                        key={memberId}
                                        className="flex items-center w-full">
                                        <div className="flex items-center flex-1 text-xs p-2 gap-2">
                                          <div className="flex-1 basis-[80px] font-semibold">
                                            {memberName}
                                          </div>

                                          <div className="text-xs flex-1 font-semibold">
                                            {foodNameDisplay}
                                          </div>
                                          <div className="text-xs flex-1">{`${parseThousandNumber(
                                            totalPrice,
                                          )}đ`}</div>
                                          {requirementDisplay ? (
                                            <Tooltip
                                              overlayClassName={
                                                css.requirementTooltip
                                              }
                                              tooltipContent={
                                                requirementDisplay
                                              }
                                              placement="bottomLeft">
                                              <div className="flex-1">
                                                {requirementDisplay}
                                              </div>
                                            </Tooltip>
                                          ) : (
                                            <div className="flex-1">-</div>
                                          )}
                                          <div className="text-xs flex-1">
                                            <ReasonFieldMealItemFailed
                                              readOnly={!isAdmin}
                                              checked={isMealItemFailed}
                                              initialReason={initialReason}
                                              onChange={(checked, reason) => {
                                                foodIds.forEach(
                                                  (foodId: string) => {
                                                    onCheckMealItemFailed({
                                                      timestamp: date,
                                                      foodId,
                                                      memberId,
                                                      reason: checked
                                                        ? reason
                                                        : '',
                                                    });
                                                  },
                                                );
                                              }}
                                              onChangeReasonInput={(reason) => {
                                                foodIds.forEach(
                                                  (foodId: string) => {
                                                    onChangeReasonInput({
                                                      timestamp: date,
                                                      foodId,
                                                      memberId,
                                                      reason,
                                                    });
                                                  },
                                                );
                                              }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </RenderWhen>
                          </React.Fragment>
                        </>
                      )}
                    </div>
                  );
                },
              )}
            </>
          ) : (
            <>
              {preparedData.map(({ date, orderData }) => {
                const isExpanding = expandingStatusMap[date];
                const isEmptyOrderData = isEmpty(orderData);

                return (
                  <div className={css.dateContainer} key={date}>
                    <div className={css.dateTitle}>
                      <div className="flex-1 flex items-center">
                        {intl.formatMessage(
                          { id: 'ReviewOrdersResultModal.dateTitle' },
                          {
                            date: DateTime.fromMillis(Number(date)).toFormat(
                              'dd/MM/yyyy',
                            ),
                          },
                        )}
                      </div>
                      <RenderWhen condition={!isEmptyOrderData}>
                        <div className="flex flex-wrap justify-end gap-2 items-center">
                          {isAdmin && showQRCode && renderComponentQRCode()}

                          {isAdmin && (
                            <RenderWhen condition={!isMobileLayout}>
                              <div className="flex gap-2 items-center bg-orange-50 py-1 px-2 rounded-lg border border-orange-200">
                                <p className="text-xs ">Máy in nhiệt</p>
                                <Button
                                  variant="inline"
                                  size="small"
                                  className={classNames({
                                    '!bg-gray-200':
                                      isGeneratingUserLabelFile &&
                                      targetedDate === date,
                                  })}
                                  inProgress={
                                    isGeneratingUserLabelFile &&
                                    targetedDate === date
                                  }
                                  loadingMode="extend"
                                  onClick={withSetCurrentDateTo(date, () => {
                                    setTimeout(() => {
                                      printThermalSection();
                                    });
                                  })}>
                                  In label
                                </Button>
                              </div>
                            </RenderWhen>
                          )}

                          {isAdmin && (
                            <div className="flex gap-2 items-center bg-blue-50 py-1 px-2 rounded-lg border border-blue-200">
                              <p className="text-xs ">File label</p>
                              <RenderWhen condition={!isMobileLayout}>
                                <Button
                                  variant="inline"
                                  size="small"
                                  className={classNames({
                                    '!bg-gray-200':
                                      isGeneratingUserLabelFile &&
                                      targetedDate === date,
                                  })}
                                  inProgress={
                                    isGeneratingUserLabelFile &&
                                    targetedDate === date
                                  }
                                  onClick={withSetCurrentDateTo(date, () => {
                                    setTimeout(() => {
                                      setIsViewUserLabelModalOpen(true);
                                    });
                                  })}>
                                  Xem label
                                </Button>
                                <Button
                                  variant="inline"
                                  size="small"
                                  inProgress={
                                    isGeneratingUserLabelFile &&
                                    targetedDate === date
                                  }
                                  loadingMode="extend"
                                  className={classNames({
                                    '!bg-gray-200':
                                      isGeneratingUserLabelFile &&
                                      targetedDate === date,
                                  })}
                                  onClick={withSetCurrentDateTo(date, () => {
                                    setTimeout(() => {
                                      generatePDFModeLabels('pdf-file');
                                    });
                                  })}>
                                  Tải label
                                </Button>
                              </RenderWhen>
                            </div>
                          )}
                          <IconArrow
                            direction={isExpanding ? 'up' : 'down'}
                            onClick={toggleCollapseStatus(date)}
                          />
                        </div>
                      </RenderWhen>
                    </div>
                    <RenderWhen condition={isExpanding}>
                      <div className="w-full">
                        {groupOrderDataByUser(orderData || []).map(
                          ({
                            memberName,
                            memberId,
                            totalPrice,
                            foodNames,
                            requirements,
                            foodIds,
                          }) => {
                            const isMealItemFailed = (
                              mealItemsFailed[date] || []
                            ).some((item) => item.memberId === memberId);

                            const initialReason =
                              (mealItemsFailed[date] || []).find(
                                (i) => i.memberId === memberId,
                              )?.reason ?? '';

                            const foodNameDisplay = foodNames.join(' + ');
                            const requirementDisplay = requirements.join('\n');

                            return (
                              <div
                                key={memberId}
                                className="flex items-center w-full">
                                <div className="flex items-center flex-1 text-xs p-2 gap-2">
                                  <div className="flex-1 basis-[80px] font-semibold">
                                    {memberName}
                                  </div>
                                  <div className="text-xs flex-1 font-semibold">
                                    {foodNameDisplay}
                                  </div>
                                  <div className="text-xs flex-1">{`${parseThousandNumber(
                                    totalPrice,
                                  )}đ`}</div>
                                  {requirementDisplay ? (
                                    <Tooltip
                                      overlayClassName={css.requirementTooltip}
                                      tooltipContent={requirementDisplay}
                                      placement="bottomLeft">
                                      <div className="flex-1 whitespace-pre-line">
                                        {requirementDisplay}
                                      </div>
                                    </Tooltip>
                                  ) : (
                                    <div className="flex-1">-</div>
                                  )}
                                  <div className="text-xs flex-1">
                                    <ReasonFieldMealItemFailed
                                      readOnly={!isAdmin}
                                      checked={isMealItemFailed}
                                      initialReason={initialReason}
                                      onChange={(checked, reason) => {
                                        foodIds.forEach((foodId: string) => {
                                          onCheckMealItemFailed({
                                            timestamp: date,
                                            foodId,
                                            memberId,
                                            reason: checked ? reason : '',
                                          });
                                        });
                                      }}
                                      onChangeReasonInput={(reason) => {
                                        foodIds.forEach((foodId: string) => {
                                          onChangeReasonInput({
                                            timestamp: date,
                                            foodId,
                                            memberId,
                                            reason,
                                          });
                                        });
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </RenderWhen>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <RenderWhen condition={isMobileLayout}>
        <SlideModal
          id="ReviewOrdersResultModal"
          modalTitle={modalTitle}
          onClose={onClose}
          isOpen={isOpen}
          containerClassName={css.mobileModalContainer}
          contentClassName={css.mobileModalContent}>
          {content}
        </SlideModal>

        <RenderWhen.False>
          <Modal
            title={modalTitle}
            isOpen={isOpen}
            handleClose={onClose}
            containerClassName="!p-4 md:!basis-[70vw]"
            headerClassName="p-0"
            className={css.modalRoot}>
            {content}
          </Modal>
        </RenderWhen.False>
      </RenderWhen>

      {isAdmin && isViewUserLabelModalOpen && !isMobileLayout && (
        <UserLabelPreviewModal
          previewSrcs={userLabelPreviewSrcs}
          isOpen={isViewUserLabelModalOpen}
          handleClose={() => setIsViewUserLabelModalOpen(false)}
          isLoading={isGeneratingUserLabelFile}
        />
      )}

      {isAdmin && (
        <UserLabelHiddenSection userLabelRecords={userLabelRecords} />
      )}

      {isAdmin && (
        <div className="h-0 overflow-hidden absolute">
          <div
            className="flex flex-wrap gap-2 flex-col"
            ref={thermalPrintSectionRef}>
            <UserLabelThermalPrintSection userLabelRecords={userLabelRecords} />
          </div>
        </div>
      )}
    </>
  );
};

export default ReviewOrdersResultModal;
