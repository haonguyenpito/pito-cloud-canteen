import type { DetailedHTMLProps, ImgHTMLAttributes } from 'react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import { useField, useForm } from 'react-final-form-hooks';
import { OnChange } from 'react-final-form-listeners';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import arrayMutators from 'final-form-arrays';
import html2canvas from 'html2canvas';
import { last, omit, pickBy, uniq } from 'lodash';
import compact from 'lodash/compact';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import { LinkIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';

import Button from '@components/Button/Button';
import Collapsible from '@components/Collapsible/Collapsible';
import ConfirmationModal from '@components/ConfirmationModal/ConfirmationModal';
import Form from '@components/Form/Form';
import { FieldDropdownSelectComponent } from '@components/FormFields/FieldDropdownSelect/FieldDropdownSelect';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import IconCopy from '@components/Icons/IconCopy/IconCopy';
import type { UserLabelRecord } from '@components/OrderDetails/ReviewView/ReviewOrdersResultSection/ReviewOrdersResultModal';
import ReviewOrdersResultSection from '@components/OrderDetails/ReviewView/ReviewOrdersResultSection/ReviewOrdersResultSection';
import UserLabelCellNormalContent from '@components/OrderDetails/ReviewView/ReviewOrdersResultSection/UserLabelCellNormalContent';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import type { TColumn } from '@components/Table/Table';
import Table from '@components/Table/Table';
import Tabs from '@components/Tabs/Tabs';
import Tooltip from '@components/Tooltip/Tooltip';
import { Dialog, DialogContent, DialogTrigger } from '@components/ui/dialog';
import { addCommas, parseThousandNumber } from '@helpers/format';
import { preparePickingOrderChangeNotificationData } from '@helpers/order/orderChangeByAdminHelper';
import { getTrackingLink } from '@helpers/order/prepareDataHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { AdminManageOrderThunks } from '@pages/admin/order/AdminManageOrder.slice';
import { EApiUpdateMode } from '@pages/api/orders/[orderId]/plan/update.service';
import { company } from '@redux/slices';
import {
  changeStep4SubmitStatus,
  clearDraftEditOrder,
  orderAsyncActions,
  saveDraftEditOrder,
} from '@redux/slices/Order.slice';
import { adminPaths } from '@src/paths';
import type { PlanListing, UserListing } from '@src/types';
import { Listing, User } from '@utils/data';
import { formatTimestamp } from '@utils/dates';
import {
  EOrderDraftStates,
  EOrderStates,
  EOrderType,
  EParticipantOrderStatus,
} from '@utils/enums';
import type { TKeyValue, TListing, TObject } from '@utils/types';
import { required } from '@utils/validators';

import ConfirmNotifyUserModal from '../../components/ConfirmNotifyUserModal/ConfirmNotifyUserModal';
// eslint-disable-next-line import/no-cycle
import NavigateButtons, {
  EFlowType,
} from '../../components/NavigateButtons/NavigateButtons';

import EditConfirmModal from './EditConfirmModal/EditConfirmModal';
import type { TSelectRoleToSendNotificationFormValues } from './SelectRoleToSendNotificationForm/SelectRoleToSendNotificationForm';

import css from './ReviewOrder.module.scss';

function ZoomableImage({
  src,
  alt,
  className,
}: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>) {
  if (!src) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={`relative ${className}`}>
          <Image
            src={src}
            alt={alt || ''}
            objectFit="cover"
            sizes="100vw"
            fill
          />
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-7xl border-0 bg-transparent p-0">
        <div className="relative h-[calc(100vh-220px)] w-full overflow-clip rounded-md bg-transparent shadow-md">
          <Image
            src={src}
            fill
            alt={alt || ''}
            className="h-full w-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type UserLabelRecordThermal = Omit<
  UserLabelRecord,
  'participantName' | 'qrCodeImageSrc' | 'timestamp'
>;

function UserLabelThermalPrintSection({
  userLabelRecords,
}: {
  userLabelRecords: UserLabelRecordThermal[];
}) {
  return (
    <>
      {userLabelRecords.map((userLabelRecord, idx) => (
        <div key={idx} className="w-[62mm] h-[43mm]">
          <UserLabelCellNormalContent
            type="thermal"
            partnerName={userLabelRecord.partnerName}
            companyName={userLabelRecord.companyName}
            mealDate={userLabelRecord.mealDate}
            foodName={userLabelRecord.foodName}
            note={userLabelRecord.requirement}
          />
        </div>
      ))}
    </>
  );
}

const MenuColumns: TColumn[] = [
  {
    key: 'stt',
    label: 'STT',
    render: (data: any) => {
      return (
        <span title={data.id} className={classNames(css.rowText, css.rowId)}>
          {data.id}
        </span>
      );
    },
  },
  {
    key: 'foodName',
    label: 'Hạng mục',
    render: (data: any) => {
      return (
        <span title={data.id} className={classNames(css.rowText, css.rowId)}>
          {data.foodName}
        </span>
      );
    },
  },
  {
    key: 'dvt',
    label: 'ĐVT',
    render: (data: any) => {
      return (
        <span title={data.id} className={classNames(css.rowText, css.rowId)}>
          {data.foodUnit}
        </span>
      );
    },
  },
  {
    key: 'foodPrice',
    label: 'Đơn giá',
    render: (data: any) => {
      return (
        <span title={data.id} className={classNames(css.rowText, css.rowId)}>
          {addCommas(data.foodPrice)} đ
        </span>
      );
    },
  },
];

type TFormDeliveryInfoValues = {
  deliveryMan: string;
};

export const ReviewContent: React.FC<any> = (props) => {
  const {
    isEditFlow = false,
    timeStamp,
    restaurant,
    deliveryManInfo = {},
    updatePlanDetail,
    foodOrder = {},
    onDownloadReviewOrderResults,
    company: companyValue,
  } = props;
  const router = useRouter();
  const intl = useIntl();
  const menuCollapseController = useBoolean();
  const { key: deliveryManKey, phoneNumber: deliveryManPhoneNumber } =
    deliveryManInfo;
  const [currDeliveryPhoneNumber, setCurrDeliveryManPhoneNumber] = useState<
    string | undefined
  >(deliveryManPhoneNumber);

  const orderInDraftState = useAppSelector((state) => state.Order.order);
  const orderDetailInDraftState = useAppSelector(
    (state) => state.Order.orderDetail,
  );
  const orderInPickingState = useAppSelector(
    (state) => state.OrderManagement.orderData,
  );
  const planListing: PlanListing = useAppSelector(
    (state) => state.OrderManagement.planData,
  );

  const currentUser: UserListing | null = useAppSelector(
    (state) => state.user.currentUser,
  );

  const orderDetailInPickingState = useAppSelector((state) => {
    const _planListing = state.OrderManagement.planData;
    const { orderDetail = {} } = Listing(
      _planListing as TListing,
    ).getMetadata();

    return orderDetail;
  });

  const participantData = useAppSelector(
    (state) => state.OrderManagement.participantData,
  );
  const anonymousParticipantData = useAppSelector(
    (state) => state.OrderManagement.anonymousParticipantData,
  );
  const deliveryManOptions = useAppSelector(
    (state) => state.SystemAttributes.deliveryPeople,
  );

  const { companyName } = User(companyValue).getPublicData();

  const isOrderDetailPage = router.pathname === adminPaths.OrderDetail;

  const defaultCopyText = intl.formatMessage({
    id: 'ReviewContent.copyToClipboardTooltip.default',
  });
  const copiedCopyText = intl.formatMessage({
    id: 'ReviewContent.copyToClipboardTooltip.copied',
  });

  const isAdmin = currentUser?.attributes?.profile?.metadata?.isAdmin;

  const [copyToClipboardTooltip, setCopyToClipboardTooltip] =
    useState(defaultCopyText);

  const [shareMenuLinkTooltip, setShareMenuLinkTooltip] = useState(
    'Chia sẻ link thực đơn',
  );
  const allowTriggerGenerateUserLabelFile = useRef(false);
  const thermalPrintSectionRef = useRef<HTMLDivElement>(null);

  const order = !isEmpty(orderInDraftState)
    ? orderInDraftState
    : orderInPickingState;

  const orderDetail = !isEmpty(orderDetailInDraftState)
    ? orderDetailInDraftState
    : orderDetailInPickingState;

  const { note } = orderDetail?.[timeStamp] || {};

  const { form } = useForm<TFormDeliveryInfoValues>({
    onSubmit: () => {},
    initialValues: {
      deliveryMan: deliveryManKey,
    },
  });
  const deliveryMan = useField('deliveryMan', form);

  const { totalDishes = 0, totalPrice = 0, foodDataList = [] } = foodOrder;

  const groupTitleClasses = classNames(css.groupTitle, {
    [css.collapsed]: menuCollapseController.value,
  });
  const rowsClasses = classNames(css.rows, {
    [css.collapsed]: menuCollapseController.value,
  });
  const iconClasses = classNames({
    [css.reversed]: menuCollapseController.value,
  });

  const {
    participants = [],
    anonymous = [],
    orderState,
    orderNote,
    orderStateHistory = [],
    orderType,
  } = Listing(order as TListing).getMetadata();

  const orderId = Listing(order as TListing).getId();
  const isNormalOrder = orderType === EOrderType.normal;
  const { restaurantName, phoneNumber, foodList = {} } = restaurant || {};
  const resultSectionShowed = [
    EOrderStates.inProgress,
    EOrderStates.completed,
    EOrderStates.pendingPayment,
    EOrderStates.reviewed,
  ].includes(orderState);
  const shouldShowTrackingLink =
    orderStateHistory.findIndex(
      (h: TObject) => h.state === EOrderStates.inProgress,
    ) >= 0;
  const isPickingOrder = orderState === EOrderStates.picking;
  const shouldShowFoodList =
    [
      EOrderDraftStates.draft,
      EOrderDraftStates.pendingApproval,
      EOrderStates.inProgress,
      EOrderStates.picking,
    ].includes(orderState) ||
    (isEditFlow && isPickingOrder);

  const parsedFoodList = Object.keys(foodList).map((key, index) => {
    return {
      key,
      data: {
        id: index + 1,
        foodName: foodList[key]?.foodName,
        foodPrice: foodList[key]?.foodPrice,
        foodUnit: foodList[key]?.foodUnit,
      },
    };
  }) as any;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getTrackingLink(orderId, timeStamp));
    setCopyToClipboardTooltip(copiedCopyText);
  };

  const handleToggleMenuCollapse = () => {
    menuCollapseController.toggle();
  };

  const handleFieldDeliveryManChange = (value: string) => {
    const currDeliveryInfoOption = deliveryManOptions.find(
      ({ key }: TKeyValue) => key === value,
    );

    updatePlanDetail(
      {
        deliveryManInfo: currDeliveryInfoOption,
      },
      true,
    );

    setCurrDeliveryManPhoneNumber(currDeliveryInfoOption?.phoneNumber);
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

  const parsedDeliveryManOptions = useMemo(
    () =>
      deliveryManOptions.map((d: TObject) => ({
        key: d.key,
        label: d.name,
      })),
    [JSON.stringify(deliveryManOptions)],
  );

  useEffect(() => {
    setCurrDeliveryManPhoneNumber(deliveryManPhoneNumber);
  }, [deliveryManPhoneNumber]);

  const currentDeliveryInfo =
    planListing.attributes?.metadata?.deliveryInfo?.[timeStamp];
  const deliveryImages = Object.values(currentDeliveryInfo || [])
    .map((value) => {
      return value?.images || [];
    })
    .flat();

  const userLabelRecords = useMemo<UserLabelRecordThermal[]>(() => {
    return foodDataList.flatMap((food: TObject) =>
      Array.from({ length: food.frequency || 1 }, () => ({
        partnerName: restaurantName,
        companyName,
        mealDate: DateTime.fromMillis(Number(timeStamp)).toFormat('dd/MM/yyyy'),
        foodName: food?.foodName || '',
        requirement: orderNote || note || '',
      })),
    );
  }, [foodDataList, restaurantName, companyName, timeStamp, orderNote, note]);

  const handleShareMenuLink = () => {
    const menuLink = `${process.env.NEXT_PUBLIC_CANONICAL_URL}/participant/order/${orderId}/menu`;
    navigator.clipboard.writeText(menuLink);
    setShareMenuLinkTooltip('Đã sao chép link thực đơn');
    setTimeout(() => {
      setShareMenuLinkTooltip('Chia sẻ link thực đơn');
    }, 2000);
  };

  return (
    <>
      <div className="flex flex-col w-full gap-2">
        {deliveryImages.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-gray-100 p-0 overflow-hidden">
            <div className="font-bold text-base p-4 bg-gray-200 flex items-center gap-2">
              <svg
                width={20}
                height={20}
                viewBox="0 -2 20 20"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                fill="#000000">
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                <g
                  id="SVGRepo_tracerCarrier"
                  stroke-linecap="round"
                  stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                  {' '}
                  <title>image_picture [#972]</title>{' '}
                  <desc>Created with Sketch.</desc> <defs> </defs>{' '}
                  <g
                    id="Page-1"
                    stroke="none"
                    stroke-width="1"
                    fill="none"
                    fill-rule="evenodd">
                    {' '}
                    <g
                      id="Dribbble-Light-Preview"
                      transform="translate(-380.000000, -3881.000000)"
                      fill="#000000">
                      {' '}
                      <g
                        id="icons"
                        transform="translate(56.000000, 160.000000)">
                        {' '}
                        <path
                          d="M336,3725.5 C336,3724.948 336.448,3724.5 337,3724.5 C337.552,3724.5 338,3724.948 338,3725.5 C338,3726.052 337.552,3726.5 337,3726.5 C336.448,3726.5 336,3726.052 336,3725.5 L336,3725.5 Z M340,3733 L328,3733 L332.518,3726.812 L335.354,3730.625 L336.75,3728.75 L340,3733 Z M326,3735 L342,3735 L342,3723 L326,3723 L326,3735 Z M324,3737 L344,3737 L344,3721 L324,3721 L324,3737 Z"
                          id="image_picture-[#972]">
                          {' '}
                        </path>{' '}
                      </g>{' '}
                    </g>{' '}
                  </g>{' '}
                </g>
              </svg>
              <span>HÌNH ẢNH VẬN ĐƠN</span>
            </div>
            <div className="flex flex-wrap gap-2 p-4 pt-2">
              {deliveryImages.map((image, index: number) => (
                <ZoomableImage
                  key={index}
                  src={image?.imageUrl}
                  alt={`Hình ảnh phiếu vận đơn ${index}`}
                  className="aspect-[16/9] h-[120px] object-cover cursor-pointer hover:opacity-80 rounded-md overflow-hidden"
                />
              ))}
            </div>
          </div>
        )}
        <RenderWhen condition={resultSectionShowed}>
          <ReviewOrdersResultSection
            className={css.reviewOrderResult}
            data={{
              participants,
              participantData,
              anonymous,
              anonymousParticipantData,
              orderDetail,
            }}
            planListing={planListing}
            onDownloadReviewOrderResults={onDownloadReviewOrderResults}
          />
        </RenderWhen>
        <div className={css.infoSection}>
          <RenderWhen condition={isOrderDetailPage}>
            <Collapsible
              label={intl.formatMessage({
                id: 'ReviewOrder.deliveryManInfoLabel',
              })}>
              <div className={classNames(css.contentBox, css.spaceStart)}>
                <div className={css.flexChild}>
                  <span className={css.boxTitle}>
                    {intl.formatMessage({ id: 'ReviewOrder.deliveryManName' })}
                  </span>
                  <FieldDropdownSelectComponent
                    id={`${timeStamp}_deliveryMan`}
                    name="deliveryMan"
                    className={css.selectBoxContent}
                    meta={deliveryMan.meta}
                    options={parsedDeliveryManOptions}
                    placeholder="Chọn nhân viên"
                    input={deliveryMan.input}
                    customOnChange={handleFieldDeliveryManChange}
                  />
                </div>
                <div className={css.flexChild}>
                  <span className={css.boxTitle}>
                    {intl.formatMessage({ id: 'ReviewOrder.phoneNumberLabel' })}
                  </span>
                  <RenderWhen condition={!isEmpty(currDeliveryPhoneNumber)}>
                    <span className={css.boxContent}>
                      {currDeliveryPhoneNumber}
                    </span>
                  </RenderWhen>

                  <RenderWhen condition={shouldShowTrackingLink}>
                    <div className={css.billOfLading} onClick={handleCopyLink}>
                      {intl.formatMessage({ id: 'ReviewOrder.billOfLading' })}
                      <Tooltip
                        overlayClassName={css.toolTipOverlay}
                        trigger="hover"
                        tooltipContent={copyToClipboardTooltip}
                        placement="bottom">
                        <div>
                          <IconCopy className={css.copyIcon} />
                        </div>
                      </Tooltip>
                    </div>
                  </RenderWhen>
                </div>
              </div>
            </Collapsible>
          </RenderWhen>
          <Collapsible
            label={intl.formatMessage({
              id: 'ReviewOrder.providerLabel',
            })}>
            <div className={classNames(css.contentBox, css.spaceStart)}>
              <div className={css.flexChild}>
                <span className={css.boxTitle}>
                  {intl.formatMessage({ id: 'ReviewOrder.providerName' })}
                </span>
                <span className={css.boxContent}>{restaurantName}</span>
              </div>
              <div className={css.flexChild}>
                <span className={css.boxTitle}>
                  {intl.formatMessage({ id: 'ReviewOrder.phoneNumberLabel' })}
                </span>
                <span className={css.boxContent}>{phoneNumber}</span>
              </div>
            </div>
          </Collapsible>
        </div>

        {isNormalOrder && (
          <div className="w-full flex justify-end mb-5">
            <div className="flex gap-2 items-center bg-orange-50 py-1 px-2 rounded-lg border border-orange-200 w-fit">
              <p className="text-xs ">Máy in nhiệt</p>
              <Button
                variant="inline"
                size="medium"
                className="h-[36px]"
                loadingMode="extend"
                onClick={() => {
                  allowTriggerGenerateUserLabelFile.current = true;
                  setTimeout(() => {
                    printThermalSection();
                  });
                }}>
                In label
              </Button>
            </div>
          </div>
        )}

        <Collapsible
          label={
            <div className="flex items-center gap-2">
              {intl.formatMessage({
                id: 'ReviewOrder.menuLabel',
              })}
              <Tooltip
                overlayClassName={css.toolTipOverlay}
                trigger="hover"
                placement="top"
                tooltipContent={shareMenuLinkTooltip}>
                <LinkIcon
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareMenuLink();
                  }}
                  className="w-4 h-4 text-blue-700"
                />
              </Tooltip>
              <Link
                href={adminPaths.Checklist.replace(
                  '[orderId]',
                  orderId,
                ).replace('[subOrderDate]', timeStamp)}
                onClick={(e) => {
                  e.stopPropagation();
                }}>
                Biên bản xác nhận
              </Link>
            </div>
          }>
          <RenderWhen condition={shouldShowFoodList}>
            <Table
              columns={MenuColumns}
              data={parsedFoodList}
              tableClassName={css.tableRoot}
              tableHeadClassName={css.tableHead}
              tableHeadRowClassName={css.tableHeadRow}
              tableBodyClassName={css.tableBody}
              tableBodyRowClassName={css.tableBodyRow}
              tableBodyCellClassName={css.tableBodyCell}
            />

            <RenderWhen.False>
              <div className={css.tableContainer}>
                <div className={css.tableHead}>
                  <div>
                    {intl.formatMessage({
                      id: 'ReviewOrder.tableHead.no',
                    })}
                  </div>
                  <div>
                    {intl.formatMessage({
                      id: 'ReviewOrder.tableHead.type',
                    })}
                  </div>
                  <div>
                    {intl.formatMessage({
                      id: 'ReviewOrder.tableHead.unit',
                    })}
                  </div>
                  <div>
                    {intl.formatMessage({
                      id: 'ReviewOrder.tableHead.quantity',
                    })}
                  </div>

                  <div>
                    {intl.formatMessage({
                      id: 'ReviewOrder.tableHead.price',
                    })}
                  </div>
                  <div></div>
                </div>

                <div className={css.tableBody}>
                  <div className={css.tableRowGroup}>
                    <div className={groupTitleClasses}>
                      <div>{1}</div>
                      <div>
                        {intl.formatMessage({
                          id: 'ReviewOrder.table.menuTitle',
                        })}
                      </div>
                      <div>{''}</div>
                      <div>{totalDishes}</div>
                      <div>{parseThousandNumber(totalPrice || 0)}đ</div>
                      <div
                        className={css.actionCell}
                        onClick={handleToggleMenuCollapse}>
                        <IconArrow className={iconClasses} />
                      </div>
                    </div>
                    <div className={rowsClasses}>
                      {foodDataList.map((foodData: TObject, index: number) => {
                        const {
                          foodId = index,
                          foodPrice = 0,
                          foodUnit = '',
                          foodName = '',
                          frequency = 1,
                        } = foodData;

                        return (
                          <div className={css.row} key={foodId}>
                            <div></div>
                            <div>{foodName}</div>
                            <div>{foodUnit}</div>
                            <div>{frequency}</div>
                            <div>{parseThousandNumber(foodPrice || 0)}đ</div>
                            <div>{''}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </RenderWhen.False>
          </RenderWhen>
        </Collapsible>
        {(orderNote || note) && (
          <Collapsible
            label={intl.formatMessage({
              id: 'ReviewOrder.note',
            })}>
            <div className={classNames(css.contentBox, css.spaceStart)}>
              {orderNote || note}
            </div>
          </Collapsible>
        )}
      </div>
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

const parseDataToReviewTab = (values: any) => {
  const { orderDetail = {}, ...rest } = values || {};
  const items = compact(
    Object.keys(orderDetail)
      .sort((a, b) => Number(a) - Number(b))
      .map((key: any) => {
        const { restaurant } = orderDetail[key] || {};

        if (isEmpty(restaurant)) {
          return null;
        }

        return {
          key,
          label: formatTimestamp(Number(key)),
          childrenFn: (childProps: any) => <ReviewContent {...childProps} />,
          childrenProps: {
            ...orderDetail[key],
            ...rest,
            order: values,
          },
        };
      }),
  );

  return items;
};

type TReviewOrder = {
  goBack: () => void;
  flowType?: EFlowType;
  tab?: string;
};

const ReviewOrder: React.FC<TReviewOrder> = (props) => {
  const { tab, goBack, flowType } = props;
  const dispatch = useAppDispatch();
  const intl = useIntl();
  const router = useRouter();
  const formSubmitRef = useRef<any>();
  const [userRolesToNotify, setUserRolesToNotify] = useState<string[]>([]);
  const orderDetail = useAppSelector(
    (state) => state.Order.orderDetail,
    shallowEqual,
  );
  const order = useAppSelector((state) => state.Order.order, shallowEqual);
  const draftEditOrderData = useAppSelector(
    (state) => state.Order.draftEditOrderData.generalInfo,
  );
  const draftEditOrderDetail = useAppSelector(
    (state) => state.Order.draftEditOrderData.orderDetail,
  );
  const createOrderError = useAppSelector(
    (state) => state.Order.createOrderError,
  );
  const updateOrderInProgress = useAppSelector(
    (state) => state.Order.updateOrderInProgress,
  );
  const updateOrderDetailInProgress = useAppSelector(
    (state) => state.Order.updateOrderDetailInProgress,
  );
  const availableOrderDetailCheckList = useAppSelector(
    (state) => state.Order.availableOrderDetailCheckList,
    shallowEqual,
  );
  const updateOrderStateInProgress = useAppSelector(
    (state) => state.AdminManageOrder.updateOrderStateInProgress,
  );
  const submitInProgress =
    updateOrderInProgress ||
    updateOrderDetailInProgress ||
    updateOrderStateInProgress;

  const {
    value: isSuccessModalOpen,
    setTrue: openSuccessModal,
    setFalse: closeSuccessModal,
  } = useBoolean();
  const editConfirmModalController = useBoolean();

  const confirmNotifyUserModalControl = useBoolean();

  const isEditFlow = props.flowType === EFlowType.edit;
  const orderId = Listing(order as TListing).getId();
  const {
    staffName,
    deliveryHour,
    deliveryAddress,
    shipperName,
    orderState,
    plans = [],
    notes = {},
    orderType = EOrderType.group,
  } = Listing(order as TListing).getMetadata();
  const isNormalOrder = orderType === EOrderType.normal;
  const planId = plans.length > 0 ? plans[0] : undefined;
  const isPendingApprovalOrder =
    orderState === EOrderDraftStates.pendingApproval;
  const isPickingOrder = orderState === EOrderStates.picking;
  const { address } = deliveryAddress || {};

  const {
    staffName: draftStaffName,
    shipperName: draftShipperName,
    deliveryAddress: draftDeliveryAddress,
    deliveryHour: draftDeliveryHour,
  } = draftEditOrderData || {};

  const { address: draftAddress } = draftDeliveryAddress || {};
  const currentAddress = isEditFlow ? draftAddress || address : address;
  const currentDeliveryHour = isEditFlow
    ? draftDeliveryHour || deliveryHour
    : deliveryHour;

  const validFields =
    (!isEmpty(staffName) || !isEmpty(draftStaffName)) &&
    (!isEmpty(shipperName) || !isEmpty(draftShipperName));
  const missingDraftGeneralInfo = isEmpty(draftEditOrderData);
  const isDraftOrderDetailNotChanged = isEqual(
    draftEditOrderDetail,
    orderDetail,
  );

  const missingSelectedFood =
    isEmpty(orderDetail) ||
    Object.keys(orderDetail).filter((dateTime) => {
      const { restaurant } = orderDetail?.[dateTime] || {};

      return restaurant?.id && restaurant?.foodList?.length === 0;
    })?.length > 0;
  const missingDraftSelectedFood =
    Object.keys(draftEditOrderDetail!).filter((dateTime) => {
      const { restaurant } = draftEditOrderDetail?.[dateTime] || {};

      return restaurant?.id && restaurant?.foodList?.length === 0;
    })?.length > 0;
  const hasInvalidMealDay = Object.keys(availableOrderDetailCheckList).some(
    (item) => !availableOrderDetailCheckList[item].isAvailable,
  );

  const submitDisabled =
    !validFields ||
    (isEditFlow
      ? isDraftOrderDetailNotChanged
        ? missingDraftGeneralInfo || missingSelectedFood
        : missingDraftSelectedFood || hasInvalidMealDay
      : missingSelectedFood);

  const notificationData = preparePickingOrderChangeNotificationData({
    order: order!,
    newOrderDetail: draftEditOrderDetail!,
    oldOrderDetail: orderDetail,
    updateOrderData: draftEditOrderData,
  });
  const shouldHideParticipantOption = isEmpty(
    notificationData.emailParamsForParticipantNotification,
  );

  const { renderedOrderDetail } =
    useMemo(() => {
      return {
        renderedOrderDetail: isEditFlow
          ? parseDataToReviewTab({
              isEditFlow,
              orderDetail: draftEditOrderDetail || orderDetail,
              deliveryHour: draftEditOrderData?.deliveryHour || deliveryHour,
              deliveryAddress:
                draftEditOrderData?.deliveryAddress || deliveryAddress,

              notes: draftEditOrderData?.notes || notes,
              company,
            })
          : parseDataToReviewTab({
              orderDetail,
              deliveryHour,
              deliveryAddress,
              notes,
              company,
            }),
      };
    }, [
      isEditFlow,
      deliveryAddress,
      deliveryHour,
      JSON.stringify(draftEditOrderData),
      JSON.stringify(orderDetail),
      JSON.stringify(draftEditOrderDetail),
      company,
    ]) || {};
  const isEditInProgressOrder = orderState === EOrderStates.inProgress;

  const handleGoBackToManageOrderPage = () => {
    router.push(adminPaths.ManageOrders);
  };

  const handleSubmitEditInProgressOrder = async () => {
    const editedSubOrderDays = pickBy(
      draftEditOrderDetail,
      (newValues, key) => {
        const oldValues = orderDetail?.[key];
        if (!oldValues) return true;

        return !isEqual(
          oldValues.restaurant.foodList,
          newValues.restaurant.foodList,
        );
      },
    );

    const editedSubOrders = Object.keys(editedSubOrderDays).reduce(
      (result: any, subOrderDate: string) => {
        const subOrderWithoutOldValues = omit<TObject>(
          orderDetail?.[subOrderDate],
          ['oldValues'],
        );
        const editedSubOrder = draftEditOrderDetail?.[subOrderDate];

        const oldSubOrder = isEmpty(orderDetail?.[subOrderDate].oldValues)
          ? orderDetail?.[subOrderDate]
          : last<TObject>(orderDetail?.[subOrderDate].oldValues);

        const isRestaurantChanged = !isEqual(
          oldSubOrder?.restaurant?.id,
          editedSubOrder?.restaurant.id,
        );

        const resettedMemberOrders = Object.keys(
          editedSubOrder.memberOrders,
        ).reduce((resettedMemberOrdersResult: any, _participantId: string) => {
          return {
            ...resettedMemberOrdersResult,
            [_participantId]: {
              foodId: '',
              status: EParticipantOrderStatus.empty,
            },
          };
        }, {});

        const editedMemberOrders = Object.keys(
          editedSubOrder.memberOrders,
        ).reduce((editedMemberOrdersResult: any, participantId: string) => {
          const { foodId, status } = editedSubOrder.memberOrders[participantId];
          const { restaurant = {} } = editedSubOrder;
          const { foodList = {} } = restaurant;

          const isFoodChanged = !Object.keys(foodList).includes(foodId);

          return {
            ...editedMemberOrdersResult,
            [participantId]: {
              foodId: isFoodChanged ? '' : foodId,
              status: isFoodChanged ? EParticipantOrderStatus.empty : status,
            },
          };
        }, {});

        return {
          ...result,
          [subOrderDate]: {
            oldValues: [
              ...(orderDetail[subOrderDate].oldValues || []),
              subOrderWithoutOldValues,
            ],
            ...editedSubOrder,
            memberOrders: isRestaurantChanged
              ? resettedMemberOrders
              : editedMemberOrders,
          },
        };
      },
      {},
    );
    const editedOrderDetail: TObject = {
      ...orderDetail,
      ...editedSubOrders,
    };

    const newPartnerIds = uniq(
      Object.values(editedOrderDetail).reduce(
        (result: string[], subOrder: TObject) => {
          const { restaurant = {} } = subOrder;
          const { id } = restaurant;

          return [...result, id];
        },
        [],
      ),
    );

    await dispatch(
      orderAsyncActions.updateOrder({
        generalInfo: {
          ...draftEditOrderData,
          orderState: EOrderStates.picking,
          viewed: false,
          partnerIds: newPartnerIds,
        },
      }),
    );
    if (!isEmpty(editedSubOrders)) {
      await dispatch(
        orderAsyncActions.updatePlanDetail({
          orderId,
          planId,
          orderDetail: editedOrderDetail,
          updateMode: EApiUpdateMode.DIRECT_UPDATE,
        }),
      );

      await dispatch(
        orderAsyncActions.handleSendEditInProgressOrderDetailNotificationToPartner(
          { orderId, orderDetail: editedSubOrders },
        ),
      );
    }
    await dispatch(
      orderAsyncActions.handleDeleteOldDataAfterEditInProgressOrder({
        orderId,
        planId,
      }),
    );
    dispatch(clearDraftEditOrder());
  };

  const handleCreateFlowSubmitClick = async () => {
    await formSubmitRef?.current();
  };

  const handleEditFlowSubmit = async () => {
    if (isEditInProgressOrder) {
      return editConfirmModalController.setTrue();
    }
    if (planId && orderId) {
      const { normalizedOrderDetail } = notificationData;

      const updateOrderDetail = isPickingOrder
        ? normalizedOrderDetail
        : draftEditOrderDetail;

      if (!isDraftOrderDetailNotChanged) {
        await dispatch(
          orderAsyncActions.updatePlanDetail({
            orderId,
            planId,
            orderDetail: updateOrderDetail,
            updateMode: isPendingApprovalOrder
              ? EApiUpdateMode.MERGE
              : EApiUpdateMode.DIRECT_UPDATE,
          }),
        );

        dispatch(orderAsyncActions.fetchOrderDetail([planId]));
      }
      if (!missingDraftGeneralInfo) {
        await dispatch(
          orderAsyncActions.updateOrder({
            generalInfo: draftEditOrderData,
          }),
        );
        dispatch(clearDraftEditOrder());

        dispatch(orderAsyncActions.fetchOrder(orderId));
      }
    }
  };

  const handleEditFlowSubmitClick = () => {
    if (isPickingOrder) {
      confirmNotifyUserModalControl.setTrue();
    } else {
      handleEditFlowSubmit();
    }
  };

  const handleCloseNotifyUserForPickingChangesModal = () => {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { normalizedOrderDetail, ...restData } = notificationData;

    dispatch(
      orderAsyncActions.notifyUserPickingOrderChanges({
        orderId,
        params: {
          ...restData,
          userRoles: userRolesToNotify,
        },
      }),
    );
    dispatch(
      orderAsyncActions.sendOrderChangeFirebaseNotificationToBooker(orderId),
    );
    dispatch(
      orderAsyncActions.sendOrderChangeFirebaseNotificationToPartner({
        orderId,
        params: {
          firebaseChangeHistory: notificationData.firebaseChangeHistory,
        },
      }),
    );
    handleEditFlowSubmit();
    confirmNotifyUserModalControl.setFalse();
    setUserRolesToNotify([]);
  };
  const handleConfirmNotifyUserForPickingChanges = () => {
    handleCloseNotifyUserForPickingChangesModal();
  };
  const handleCancelNotifyUserForPickingChanges = () => {
    handleCloseNotifyUserForPickingChangesModal();
  };

  const onSubmit = async (values: any) => {
    const { staffName: staffNameValue, shipperName: shipperNameValue } = values;
    if (!isEditFlow) {
      dispatch(changeStep4SubmitStatus(true));

      if (orderState === EOrderDraftStates.draft) {
        await dispatch(
          AdminManageOrderThunks.requestApprovalOrder({ orderId }),
        );

        if (isNormalOrder) {
          await dispatch(
            orderAsyncActions.publishOrder({
              orderId,
            }),
          );
        }
      }

      const { error } = (await dispatch(
        orderAsyncActions.updateOrder({
          generalInfo: {
            staffName: staffNameValue,
            shipperName: shipperNameValue,
          },
        }),
      )) as any;

      if (!error) {
        openSuccessModal();
      }
      dispatch(changeStep4SubmitStatus(false));
    }
  };

  const onConfirm = () => {
    closeSuccessModal();
    router.push(adminPaths.ManageOrders);
  };

  const initialValues = useMemo(() => {
    return {
      staffName: isEditFlow
        ? typeof draftStaffName !== 'undefined'
          ? draftStaffName
          : draftStaffName || staffName
        : staffName,
      shipperName: isEditFlow
        ? typeof draftShipperName !== 'undefined'
          ? draftShipperName
          : draftShipperName || shipperName
        : shipperName,
    };
  }, [isEditFlow, staffName, shipperName, JSON.stringify(draftEditOrderData)]);

  const handleFieldShipperNameChange = (shipperNameValue: string) => {
    dispatch(
      saveDraftEditOrder({
        generalInfo: {
          shipperName: shipperNameValue,
        },
      }),
    );
  };
  const handleFieldStaffNameChange = (staffNameValue: string) => {
    dispatch(
      saveDraftEditOrder({
        generalInfo: {
          staffName: staffNameValue,
        },
      }),
    );
  };

  useEffect(() => {
    if (isEmpty(orderDetail) && !isEmpty(plans)) {
      dispatch(orderAsyncActions.fetchOrderDetail(plans));
    }
  }, [
    JSON.stringify(order),
    JSON.stringify(orderDetail),
    JSON.stringify(plans),
  ]);

  const onSubmitEditOrder = async (
    values: TSelectRoleToSendNotificationFormValues,
  ) => {
    await handleSubmitEditInProgressOrder();
    const { role = [] } = values;
    role.forEach((r) => {
      if (r === 'participant') {
        dispatch(
          orderAsyncActions.handleSendEditInProgressOrderNotificationToParticipant(
            {
              orderId,
              planId,
            },
          ),
        );
      } else if (r === 'company') {
        // TODO: send notification to company
        // eslint-disable-next-line unused-imports/no-unused-vars
        const { normalizedOrderDetail, ...restData } = notificationData;

        dispatch(
          orderAsyncActions.notifyUserPickingOrderChanges({
            orderId,
            params: {
              ...restData,
              userRoles: ['booker'],
            },
          }),
        );
      } else if (r === 'partner') {
        // TODO: send notification to partner
        dispatch(
          orderAsyncActions.handleSendEditInProgressOrderNotificationToPartner({
            orderId,
            planId,
          }),
        );
      }
    });
    dispatch(
      orderAsyncActions.sendOrderChangeFirebaseNotificationToBooker(orderId),
    );
    dispatch(
      orderAsyncActions.sendOrderChangeFirebaseNotificationToPartner({
        orderId,
        params: {
          firebaseChangeHistory: notificationData.firebaseChangeHistory,
        },
      }),
    );
    editConfirmModalController.setFalse();
  };

  return (
    <div className={css.root}>
      <h1 className={classNames(css.title, 'font-semibold !text-lg')}>
        <FormattedMessage id="ReviewOrder.title" />
      </h1>
      <FinalForm
        mutators={{ ...arrayMutators }}
        {...props}
        initialValues={initialValues}
        onSubmit={onSubmit}
        render={(fieldRenderProps: any) => {
          const { handleSubmit } = fieldRenderProps;

          formSubmitRef.current = handleSubmit;

          return (
            <Form onSubmit={handleSubmit}>
              <OnChange name="staffName">{handleFieldStaffNameChange}</OnChange>
              <OnChange name="shipperName">
                {handleFieldShipperNameChange}
              </OnChange>

              <Collapsible
                label={intl.formatMessage({ id: 'ReviewOrder.generalInfo' })}>
                <div className={css.contentBox}>
                  <div className={css.flexChild}>
                    <span className={css.boxTitle}>
                      {intl.formatMessage({ id: 'ReviewOrder.deliveryTime' })}
                    </span>
                    <span className={css.boxContent}>
                      {currentDeliveryHour}
                    </span>
                  </div>
                  <div className={css.flexChild}>
                    <span className={css.boxTitle}>
                      {intl.formatMessage({ id: 'ReviewOrder.address' })}
                    </span>
                    <span className={css.boxContent}>{currentAddress}</span>
                  </div>
                  <div className={css.flexChild}>
                    <span className={css.boxTitle}>
                      {intl.formatMessage({ id: 'ReviewOrder.staffNameLabel' })}
                    </span>
                    <FieldTextInput
                      className={css.staffInput}
                      name="staffName"
                      id="staffName"
                      placeholder={intl.formatMessage({
                        id: 'ReviewOrder.staffNamePlaceholder',
                      })}
                      validate={required(
                        intl.formatMessage({
                          id: 'ReviewOrder.staffNameRequired',
                        }),
                      )}
                    />
                  </div>
                  <div className={css.flexChild}>
                    <span className={css.boxTitle}>
                      {intl.formatMessage({
                        id: 'ReviewOrder.shipperName.label',
                      })}
                    </span>
                    <FieldTextInput
                      className={css.staffInput}
                      name="shipperName"
                      id="shipperName"
                      placeholder={intl.formatMessage({
                        id: 'ReviewOrder.shipperName.placeholder',
                      })}
                      validate={required(
                        intl.formatMessage({
                          id: 'ReviewOrder.shipperName.required',
                        }),
                      )}
                    />
                  </div>
                </div>
              </Collapsible>
              <Tabs items={renderedOrderDetail as any} showNavigation />

              {createOrderError && (
                <div className={css.error}>{createOrderError}</div>
              )}
            </Form>
          );
        }}
      />
      <NavigateButtons
        flowType={flowType}
        currentTab={tab}
        onCompleteClick={isEditFlow ? handleEditFlowSubmitClick : undefined}
        onNextClick={
          isEditFlow
            ? handleGoBackToManageOrderPage
            : handleCreateFlowSubmitClick
        }
        goBack={goBack}
        submitDisabled={submitDisabled}
        inProgress={submitInProgress}
      />
      <ConfirmNotifyUserModal
        isOpen={confirmNotifyUserModalControl.value}
        onClose={handleCloseNotifyUserForPickingChangesModal}
        onCancel={handleCancelNotifyUserForPickingChanges}
        setUserRoles={setUserRolesToNotify}
        onConfirm={handleConfirmNotifyUserForPickingChanges}
        confirmDisabled={isEmpty(userRolesToNotify)}
        initialValues={{ userRoles: userRolesToNotify }}
        shouldHideParticipantOption={shouldHideParticipantOption}
      />

      <ConfirmationModal
        id="SuccessOrderModal"
        isOpen={isSuccessModalOpen}
        onClose={closeSuccessModal}
        confirmText={intl.formatMessage({
          id: 'ReviewOrder.successModal.confirmText',
        })}
        title={intl.formatMessage({ id: 'ReviewOrder.successModal.title' })}
        description={intl.formatMessage({
          id: 'ReviewOrder.successModal.description',
        })}
        onConfirm={onConfirm}
      />
      <EditConfirmModal
        isOpen={editConfirmModalController.value}
        onClose={editConfirmModalController.setFalse}
        onSubmit={onSubmitEditOrder}
        isNormalOrder={isNormalOrder}
      />
    </div>
  );
};

export default ReviewOrder;
