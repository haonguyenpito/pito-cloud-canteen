import React, { useEffect, useMemo, useState } from 'react';
import type { IntlShape } from 'react-intl';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import { flatten } from 'lodash';
import compact from 'lodash/compact';
import { DateTime } from 'luxon';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import IconFilter from '@components/Icons/IconFilter/IconFilter';
import IntegrationFilterModal from '@components/IntegrationFilterModal/IntegrationFilterModal';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import NamedLink from '@components/NamedLink/NamedLink';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import type { TColumn } from '@components/Table/Table';
import { TableForm } from '@components/Table/Table';
import StateItem from '@components/TimeLine/StateItem';
import Tooltip from '@components/Tooltip/Tooltip';
import {
  calculatePCCFeeByDate,
  calculateTotalPriceAndDishes,
} from '@helpers/order/cartInfoHelper';
import { combineOrderDetailWithPriceInfo } from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { orderAsyncActions, resetStates } from '@redux/slices/Order.slice';
import { adminPaths, adminRoutes } from '@src/paths';
import { Listing } from '@src/utils/data';
import {
  getLabelByKey,
  useOrderStateOptionsByLocale,
} from '@src/utils/options';
import {
  ETransition,
  txIsCanceled,
  txIsDelivered,
  txIsDelivering,
  txIsInitiated,
  txIsPartnerConfirmed,
  txIsPartnerRejected,
} from '@src/utils/transaction';
import { formatTimestamp, getDayOfWeek } from '@utils/dates';
import { EOrderDraftStates, EOrderStates, EOrderType } from '@utils/enums';
import type {
  TIntegrationListing,
  TIntegrationOrderListing,
  TListing,
  TObject,
  TTableSortValue,
  TTransaction,
} from '@utils/types';
import { parsePrice } from '@utils/validators';

import { makeExcelFile } from './helpers/manageOrder';
import type { TDownloadColumnListFormValues } from './ManageOrderFilterForms/DownloadColumnListForm/DownloadColumnListForm';
import DownloadColumnListForm from './ManageOrderFilterForms/DownloadColumnListForm/DownloadColumnListForm';
import type { TFilterColumnFormValues } from './ManageOrderFilterForms/FilterColumnForm/FilterColumnForm';
import FilterColumnForm from './ManageOrderFilterForms/FilterColumnForm/FilterColumnForm';
import FilterForm from './ManageOrderFilterForms/FilterForm/FilterForm';
import DeliveryAgentsMealsSettingDialog from './DeliveryAgentsMealsSettingDialog';

import css from './ManageOrders.module.scss';

const uniqueStrings = (array: string[]) => {
  return array.filter((item, pos) => {
    return array.indexOf(item) === pos;
  });
};

const BADGE_TYPE_BASE_ON_ORDER_STATE = {
  [EOrderDraftStates.draft]: EBadgeType.default,
  [EOrderDraftStates.pendingApproval]: EBadgeType.info,
  [EOrderStates.canceled]: EBadgeType.default,
  [EOrderStates.canceledByBooker]: EBadgeType.default,
  [EOrderStates.completed]: EBadgeType.warning,
  [EOrderStates.inProgress]: EBadgeType.info,
  [EOrderStates.pendingPayment]: EBadgeType.warning,
  [EOrderStates.picking]: EBadgeType.warning,
  [EOrderStates.reviewed]: EBadgeType.warning,
  [EOrderStates.expiredStart]: EBadgeType.default,

  [ETransition.START_DELIVERY]: EBadgeType.darkBlue,
  [ETransition.COMPLETE_DELIVERY]: EBadgeType.strongSuccess,
  [ETransition.OPERATOR_CANCEL_PLAN]: EBadgeType.strongDanger,
  [ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED]:
    EBadgeType.strongDanger,
  [ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED]: EBadgeType.strongDanger,
};

const BADGE_CLASS_NAME_BASE_ON_ORDER_STATE = {
  [EOrderDraftStates.draft]: css.badgeDefault,
  [EOrderDraftStates.pendingApproval]: css.badgeProcessing,
  [EOrderStates.canceled]: css.badgeDefault,
  [EOrderStates.canceledByBooker]: css.badgeDefault,
  [EOrderStates.completed]: css.badgeSuccess,
  [EOrderStates.inProgress]: css.badgeInProgress,
  [EOrderStates.pendingPayment]: css.badgeProcessing,
  [EOrderStates.picking]: css.badgeWarning,
  [EOrderStates.reviewed]: css.badgeWarning,
  [EOrderStates.expiredStart]: css.badgeDefault,
  [ETransition.START_DELIVERY]: css.badgeInProgress,
  [ETransition.COMPLETE_DELIVERY]: css.badgeSuccess,
};

const renderBadgeForSubOrder = (
  tx: TTransaction,
  state: EOrderStates | EOrderDraftStates,
  _ORDER_STATE_OPTIONS: any,
  intl: IntlShape,
) => {
  if (!tx)
    return (
      <Badge
        containerClassName={classNames(
          css.badge,
          BADGE_CLASS_NAME_BASE_ON_ORDER_STATE[state],
        )}
        labelClassName={css.badgeLabel}
        type={BADGE_TYPE_BASE_ON_ORDER_STATE[state] || EBadgeType.default}
        label={getLabelByKey(_ORDER_STATE_OPTIONS, state)}
      />
    );
  if (txIsInitiated(tx)) {
    return (
      <Badge
        labelClassName={css.badgeLabel}
        type={EBadgeType.info}
        label={intl.formatMessage({ id: 'dang-trien-khai-1' })}
      />
    );
  }
  if (txIsPartnerConfirmed(tx)) {
    return (
      <Badge
        type={EBadgeType.strongWarning}
        label={intl.formatMessage({ id: 'doi-tac-xac-nhan' })}
      />
    );
  }
  if (txIsPartnerRejected(tx)) {
    return (
      <Badge
        type={EBadgeType.strongDefault}
        label={intl.formatMessage({ id: 'doi-tac-tu-choi' })}
      />
    );
  }
  if (txIsDelivering(tx)) {
    return (
      <Badge
        labelClassName={css.badgeLabelLight}
        type={EBadgeType.darkBlue}
        label={intl.formatMessage({ id: 'dang-giao-hang' })}
      />
    );
  }
  if (txIsDelivered(tx)) {
    return (
      <Badge
        labelClassName={css.badgeLabelLight}
        type={EBadgeType.strongSuccess}
        label={intl.formatMessage({ id: 'da-giao-hang' })}
      />
    );
  }
  if (txIsCanceled(tx)) {
    return (
      <Badge
        labelClassName={css.badgeLabelLight}
        type={EBadgeType.strongDanger}
        label={intl.formatMessage({ id: 'huy-don' })}
      />
    );
  }

  return (
    <Badge
      labelClassName={css.badgeLabelLight}
      type={EBadgeType.strongSuccess}
      label={intl.formatMessage({ id: 'da-giao-hang' })}
    />
  );
};

const OrderDetailTooltip = ({
  subOrders = [],
}: {
  subOrders: TIntegrationListing[];
}) => {
  const orderDetails = subOrders.reduce(
    (prev: any, subOrder: TIntegrationListing) => {
      const { orderDetail = {} } = subOrder.attributes.metadata || {};
      const subOrderDetails = Object.keys(orderDetail).map((key) => {
        const {
          lastTransition,
          transactionId,
          totalPrice = 0,
        } = orderDetail[key] || {};

        return (
          <div key={key} className={css.orderDetailTooltipItem}>
            <StateItem
              className={css.stateItem}
              data={{
                orderData: { lastTransition, transactionId },
                date: formatTimestamp(Number(key)),
              }}
              isAdminLayout
            />
            <span>{parsePrice(String(totalPrice))}đ</span>
          </div>
        );
      });

      return [...prev, ...subOrderDetails];
    },
    [],
  );

  return <div className={css.tooltip}>{orderDetails}</div>;
};

const filterOrder = (subOrders: any[], filterList: TObject) => {
  const { startDate, endDate } = filterList;

  const filterFn = (item: any) => {
    if (startDate && +item.data.timestamp < new Date(startDate).getTime())
      return false;
    if (endDate && +item.data.timestamp > new Date(endDate).getTime())
      return false;

    return true;
  };

  return subOrders.filter(filterFn);
};

const parseEntitiesToTableData = (
  orders: TIntegrationOrderListing[],
  systemVATPercentage: number,
  showMode = 'order',
) => {
  if (orders.length === 0) return [];
  const shouldHideOrderRow = showMode === 'subOrder';

  const result = orders.map((entity) => {
    const { company, subOrders = [], allRestaurants = [], bookerName } = entity;
    const restaurants = subOrders.reduce(
      // eslint-disable-next-line array-callback-return
      (prevSubOrders: any[], subOrder: TIntegrationListing) => {
        const { orderDetail = {} } = subOrder?.attributes?.metadata || {};
        const listRestaurantName = uniqueStrings(
          Object.keys(orderDetail).map((key) => {
            return orderDetail[key]?.restaurant?.restaurantName;
          }),
        );

        return [...prevSubOrders, ...listRestaurantName];
      },
      [],
    );

    const {
      startDate,
      endDate,
      orderState,
      staffName,
      deliveryAddress,
      deliveryHour,
      isClientSufficientPaid = false,
      isPartnerSufficientPaid = false,
      orderType = EOrderType.group,
      hasSpecificPCCFee = false,
      specificPCCFee = 0,
      orderVATPercentage = 0,
    } = entity?.attributes?.metadata || {};

    const newSubOrders = subOrders.map((plan: TObject) => {
      const { orderDetail: planOrderDetail = {} } = Listing(
        plan as TListing,
      ).getMetadata();

      return {
        ...plan,
        attributes: {
          ...(plan as TListing).attributes,
          metadata: {
            ...(plan as TListing).attributes.metadata,
            orderDetail: combineOrderDetailWithPriceInfo({
              orderDetail: planOrderDetail,
              orderType,
            }),
          },
        },
      };
    });

    const orderDetail = subOrders[0]?.attributes?.metadata?.orderDetail || {};
    const fullRestaurantsData = Object.keys(orderDetail).map((key) => {
      return orderDetail[key]?.restaurant;
    });
    const isGroupOrder = orderType === EOrderType.group;
    const { totalDishes, totalParticipantOrdered } =
      calculateTotalPriceAndDishes({
        orderDetail,
        isGroupOrder,
      });

    const orderVATPercentageToUse = [
      EOrderDraftStates.draft,
      EOrderStates.picking,
    ].includes(orderState)
      ? systemVATPercentage
      : orderVATPercentage;

    const subOrderDates = compact(
      Object.keys(orderDetail).map((key) => {
        const { memberOrders, lineItems } = orderDetail[key];
        const {
          totalDishes: childTotalDishes,
          totalPrice: childTotalPrice,
          totalParticipantOrdered: childTotalParticipantOrdered,
          ...rest
        } = calculateTotalPriceAndDishes({
          orderDetail,
          isGroupOrder,
          date: key,
        });
        const PCCFeeByDate = calculatePCCFeeByDate({
          isGroupOrder,
          memberOrders,
          lineItems,
          hasSpecificPCCFee,
          specificPCCFee,
        });
        const childPrice =
          childTotalPrice +
          PCCFeeByDate +
          Math.round(
            (childTotalPrice + PCCFeeByDate) * orderVATPercentageToUse,
          );
        if (!orderDetail[key]?.transactionId) return null;

        return {
          key: `${entity.id.uuid}-${key}`,
          data: {
            id: `${entity.id.uuid}-${key}`,
            title: `${entity.attributes.title}-${getDayOfWeek(+key)}`,
            startDate: formatTimestamp(+key, 'dd/MM/yyyy'),
            endDate: endDate && formatTimestamp(endDate),
            subOrderDate: formatTimestamp(+key, 'dd/MM/yyyy'),
            state: orderState || EOrderDraftStates.pendingApproval,
            orderId: entity?.id?.uuid,
            restaurants: [orderDetail[key]?.restaurant?.restaurantName],
            restaurantId: orderDetail[key]?.restaurant?.id,
            subOrders: newSubOrders,
            orderName: `${
              company?.attributes?.profile?.publicData?.companyName
            }_${formatTimestamp(+key, 'dd/MM/yyyy')}`,
            deliveryHour,
            parentKey: entity.id.uuid,
            tx: orderDetail[key]?.transaction,
            partnerPhoneNumber: orderDetail[key]?.restaurant?.phoneNumber,
            totalDishes: childTotalDishes,
            totalParticipantOrdered: childTotalParticipantOrdered,
            timestamp: +key,
            partnerLocation: allRestaurants.find(
              (_restaurant) =>
                _restaurant.id.uuid === orderDetail[key]?.restaurant?.id,
            )?.attributes?.publicData?.location?.address,
            isPaid: orderDetail[key]?.isPaid,
            foodList: rest[key],
            price: childPrice,
            bookerName,
          },
        };
      }),
    );
    if (shouldHideOrderRow) {
      return subOrderDates;
    }
    const orderPrice = subOrderDates.reduce(
      (prev: number, item: any) => prev + item.data.price,
      0,
    );

    return {
      key: entity.id.uuid,
      data: {
        id: entity.id.uuid,
        title: entity.attributes.title,
        location: deliveryAddress?.address,
        companyLocation:
          company?.attributes?.profile?.publicData?.companyLocation?.address,
        companyName: company?.attributes?.profile?.publicData?.companyName,
        displayName: `${company?.attributes.profile?.lastName} ${company?.attributes.profile?.firstName}`,
        startDate: startDate && formatTimestamp(startDate),
        endDate: endDate && formatTimestamp(endDate),
        staffName,
        state: orderState || EOrderDraftStates.pendingApproval,
        orderId: entity?.id?.uuid,
        restaurants,
        subOrders: newSubOrders,
        orderName: entity.attributes.publicData.orderName,
        orderType,
        deliveryHour,
        isParent: true,
        isHide: shouldHideOrderRow,
        children: subOrderDates,
        isPaid: isClientSufficientPaid && isPartnerSufficientPaid,
        orderCreatedAt: formatTimestamp(
          new Date(entity.attributes.createdAt!).getTime(),
        ),
        bookerPhoneNumber:
          company?.attributes?.profile?.publicData?.phoneNumber,
        totalDishes,
        totalParticipantOrdered,
        orderNotes: entity.attributes.metadata?.notes,
        orderNote: entity.attributes.metadata?.orderNote,
        fullRestaurantsData,
        partnerLocation: allRestaurants.map(
          (_restaurant: any) =>
            _restaurant.attributes?.publicData?.location?.address,
        ),
        foodList: flatten(subOrderDates.map((item) => item.data.foodList)),
        price: orderPrice,
        bookerName,
      },
    };
  });

  return shouldHideOrderRow ? flatten(result as any[]) : result;
};

const sortOrders = ({ columnName, type }: TTableSortValue, data: any) => {
  const isAsc = type === 'asc';

  // eslint-disable-next-line array-callback-return
  return data.sort((a: any, b: any) => {
    if (typeof a.data[columnName] === 'number') {
      return isAsc
        ? b.data[columnName] - a.data[columnName]
        : a.data[columnName] - b.data[columnName];
    }
    if (typeof a.data[columnName] === 'string') {
      if (a.data[columnName] < b.data[columnName]) {
        return isAsc ? -1 : 1;
      }
      if (a.data[columnName] > b.data[columnName]) {
        return isAsc ? 1 : -1;
      }

      return 0;
    }
  });
};

const ManageOrdersPage = ({ showOrderType }: { showOrderType?: boolean }) => {
  const dispatch = useAppDispatch();
  const intl = useIntl();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {
    page = 1,
    keywords = '',
    meta_state = '',
    meta_endDate,
    meta_startDate,
    meta_orderState,
    showMode = 'order',
  } = router.query;

  const startDateOnQuery = meta_startDate as string | undefined;
  const endDateOnQuery = meta_endDate as string | undefined;
  const stateOnQuery = meta_state as string | undefined;

  const ORDER_STATE_OPTIONS = useOrderStateOptionsByLocale();
  const TABLE_COLUMN: TColumn[] = [
    {
      key: 'title',
      label: 'ID',
      render: ({
        id: orderId,
        title,
        state,
        subOrders,
        parentKey,
        timestamp,
      }: any) => {
        const isChildRow = !!parentKey;
        const titleComponent = (
          <div
            className={classNames(
              css.boldText,
              isChildRow && css.firstChildCell,
            )}>
            #{title}
          </div>
        );

        if (isChildRow) {
          return (
            <NamedLink
              path={adminPaths.OrderDetail}
              params={{ orderId: parentKey, timestamp }}>
              {titleComponent}
            </NamedLink>
          );
        }
        if ([EOrderDraftStates.draft].includes(state)) {
          return (
            <NamedLink path={adminPaths.UpdateDraftOrder} params={{ orderId }}>
              {titleComponent}
            </NamedLink>
          );
        }

        return (
          <NamedLink path={adminPaths.OrderDetail} params={{ orderId }}>
            {subOrders.length > 0 ? (
              <Tooltip
                overlayClassName={css.orderDetailTooltip}
                overlayInnerStyle={{ backgroundColor: '#ffffff' }}
                showArrow={false}
                tooltipContent={<OrderDetailTooltip subOrders={subOrders} />}
                placement="bottomLeft">
                {titleComponent}
              </Tooltip>
            ) : (
              titleComponent
            )}
          </NamedLink>
        );
      },
      sortable: true,
    },
    {
      key: 'orderName',
      label: intl.formatMessage({ id: 'ten-don-hang' }),
      render: ({ orderName }: any) => {
        return <div className={css.orderName}>{orderName || <></>}</div>;
      },
    },
    {
      key: 'orderType',
      label: intl.formatMessage({ id: 'loai' }),
      render: ({ orderType }: any) => {
        return (
          <div className={css.orderName}>
            {orderType === EOrderType.normal &&
              intl.formatMessage({ id: 'thuong' })}
            {orderType === EOrderType.group &&
              intl.formatMessage({ id: 'nhom' })}
          </div>
        );
      },
    },
    {
      key: 'address',
      label: intl.formatMessage({ id: 'dia-diem-giao-hang' }),
      render: (data: any) => {
        return (
          <div className={css.locationRow}>
            <div className={css.companyName}>{data.companyName}</div>
            {data.location || <></>}
          </div>
        );
      },
    },
    {
      key: 'bookerName',
      label: intl.formatMessage({ id: 'khach-hang' }),
      render: (data: any) => {
        return <div>{data.displayName}</div>;
      },
    },
    {
      key: 'startDate',
      label: intl.formatMessage({ id: 'thoi-gian' }),
      render: (data: any) => {
        const { startDate, endDate, parentKey } = data;

        return startDate && endDate ? (
          <div className={css.rowText}>
            <div className={css.deliveryHour}>{data.deliveryHour}</div>
            {parentKey ? startDate : `${startDate} - ${endDate}`}
          </div>
        ) : (
          <></>
        );
      },
      sortable: true,
    },
    {
      key: 'restaurantName',
      label: intl.formatMessage({ id: 'doi-tac' }),
      render: ({ restaurants = [] }: any) => {
        const { length } = restaurants;
        const moreThanTwo = restaurants.length > 2;
        const remainLength = length - 2;

        return length > 0 ? (
          <div className={css.rowText}>
            {restaurants.slice(0, 2).map((restaurantName: string) => (
              <div key={restaurantName} className={css.restaurantName}>
                {restaurantName}
              </div>
            ))}
            {moreThanTwo && (
              <div className={css.remainText}>
                + {remainLength} {intl.formatMessage({ id: 'doi-tac-0' })}{' '}
              </div>
            )}
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: 'staffName',
      label: intl.formatMessage({ id: 'nhan-vien-phu-trach' }),
      render: ({ staffName }: any) => {
        return staffName ? <div>{staffName}</div> : <></>;
      },
      sortable: true,
    },
    {
      key: 'state',
      label: intl.formatMessage({ id: 'trang-thai' }),
      render: ({
        state,
        parentKey,
        tx,
      }: {
        state: EOrderStates | EOrderDraftStates;
        parentKey: string;
        tx: TTransaction;
      }) => {
        return (
          <RenderWhen condition={!!parentKey}>
            {renderBadgeForSubOrder(tx, state, ORDER_STATE_OPTIONS, intl)}
            <RenderWhen.False>
              <Badge
                containerClassName={classNames(
                  css.badge,
                  BADGE_CLASS_NAME_BASE_ON_ORDER_STATE[state],
                )}
                labelClassName={css.badgeLabel}
                type={
                  BADGE_TYPE_BASE_ON_ORDER_STATE[state] || EBadgeType.default
                }
                label={getLabelByKey(ORDER_STATE_OPTIONS, state)}
              />
            </RenderWhen.False>
          </RenderWhen>
        );
      },
      sortable: true,
    },
    {
      key: 'isPaid',
      label: intl.formatMessage({ id: 'thanh-toan' }),
      render: ({ isPaid }) => (
        <Badge
          containerClassName={classNames(
            css.badge,
            isPaid ? css.badgeSuccess : css.badgeWarning,
          )}
          labelClassName={css.badgeLabel}
          type={isPaid ? EBadgeType.success : EBadgeType.warning}
          label={
            isPaid
              ? intl.formatMessage({ id: 'da-thanh-toan' })
              : intl.formatMessage({ id: 'chua-thanh-toan-0' })
          }
        />
      ),
    },
    {
      key: 'isParent',
      label: '',
      render: ({ isParent }, _, collapseRowController) => {
        return (
          isParent && (
            <IconArrow
              direction="right"
              onClick={collapseRowController?.toggle}
              className={classNames(
                css.iconArrow,
                collapseRowController?.value && css.rotate,
              )}
            />
          )
        );
      },
    },
  ];

  function getDisplayedColumn(
    _showOrderType: boolean | undefined,
  ): string[] | (() => string[]) {
    return TABLE_COLUMN.map((column) => column.key).filter(
      (column) => _showOrderType || (!_showOrderType && column !== 'orderType'),
    );
  }

  const { isReady } = router;
  const [sortValue, setSortValue] = useState<TTableSortValue>();
  const [displayedColumns, setDisplayedColumns] = useState<string[]>(
    getDisplayedColumn(showOrderType),
  );

  const isSubOrderMode = showMode === 'subOrder';
  const shouldShowTableColums = TABLE_COLUMN.filter((column) => {
    return displayedColumns.includes(column.key);
  });

  const {
    queryOrderInProgress,
    queryOrderError,
    orders = [],
    manageOrdersPagination,
    queryAllOrdersInProgress,
  } = useAppSelector((state) => state.Order, shallowEqual);
  const systemVATPercentage = useAppSelector(
    (state) => state.SystemAttributes.systemVATPercentage,
  );

  const dataTable = parseEntitiesToTableData(
    orders,
    systemVATPercentage,
    showMode as string,
  );
  const filteredTableData = isSubOrderMode
    ? filterOrder(dataTable, {
        endDate: endDateOnQuery,
        startDate: startDateOnQuery,
      })
    : dataTable;
  const sortedData = sortValue
    ? sortOrders(sortValue, filteredTableData)
    : filteredTableData;

  const metaStartEndDateByMode = useMemo(
    () =>
      isSubOrderMode
        ? {
            ...(startDateOnQuery
              ? {
                  meta_startDate: `${DateTime.fromISO(startDateOnQuery)
                    .minus({ days: 7 })
                    .toMillis()},`,
                }
              : {}),
            ...(endDateOnQuery && startDateOnQuery
              ? {
                  meta_endDate: `,${
                    DateTime.fromISO(startDateOnQuery)
                      .plus({ days: 14 })
                      .toMillis() + 1
                  }`,
                }
              : {}),
          }
        : {
            ...(startDateOnQuery
              ? {
                  meta_startDate: `${
                    startDateOnQuery ? new Date(startDateOnQuery).getTime() : ''
                  },`,
                }
              : {}),
            ...(endDateOnQuery
              ? {
                  meta_endDate: `,${
                    endDateOnQuery ? new Date(endDateOnQuery).getTime() + 1 : ''
                  }`,
                }
              : {}),
          },
    [isSubOrderMode, startDateOnQuery, endDateOnQuery],
  );

  const handleDownloadOrderList = async (
    values: TDownloadColumnListFormValues,
  ) => {
    const { meta, payload } = await dispatch(
      orderAsyncActions.queryAllOrders({
        keywords,
        meta_orderState,
        ...metaStartEndDateByMode,
      }),
    );
    if (meta.requestStatus === 'fulfilled') {
      const allOrdersData = parseEntitiesToTableData(
        payload,
        systemVATPercentage,
      );
      const sortedExportOrdersData = sortValue
        ? sortOrders(sortValue, allOrdersData)
        : allOrdersData;
      makeExcelFile(sortedExportOrdersData, values.downloadColumnListName);
    }
  };

  const handleSort = (columnName: string) => {
    setSortValue({
      columnName,
      type: sortValue?.type === 'asc' ? 'desc' : 'asc',
    });
  };

  let content;
  if (queryOrderInProgress) {
    content = <LoadingContainer />;
  } else if (queryOrderError) {
    content = <ErrorMessage message={queryOrderError.message} />;
  } else if (orders.length > 0) {
    content = (
      <TableForm
        columns={shouldShowTableColums}
        data={sortedData}
        pagination={manageOrdersPagination}
        paginationPath={adminRoutes.ManageOrders.path}
        tableBodyCellClassName={css.bodyCell}
        handleSort={handleSort}
        sortValue={sortValue}
        tableWrapperClassName={css.tableWrapper}
        tableClassName={css.table}
        tableBodyClassName={css.tableBody}
        paginationProps={isSubOrderMode ? { showInfo: false } : {}}
      />
    );
  } else {
    content = (
      <p>
        <FormattedMessage id="ManageOrders.noResults" />
      </p>
    );
  }

  const groupStateString = stateOnQuery
    ?.split(',')
    .filter((item: string) => !!item);

  useEffect(() => {
    dispatch(resetStates());

    if (isReady) {
      dispatch(
        orderAsyncActions.queryOrders({
          page,
          keywords,
          ...(meta_orderState ? { meta_orderState } : {}),
          ...metaStartEndDateByMode,
        }),
      );
    }
  }, [
    dispatch,
    isReady,
    keywords,
    metaStartEndDateByMode,
    meta_orderState,
    page,
  ]);

  const onClearFilter = () => {
    router.push({
      pathname: adminRoutes.ManageOrders.path,
      query: {},
    });
  };

  const onFilterSubmit = ({
    keywords: _keywords,
    meta_startDate: _meta_startDate,
    meta_endDate: _meta_endDate,
    meta_orderState: _meta_orderState,
    showMode: _showMode,
  }: any) => {
    router.push({
      pathname: adminRoutes.ManageOrders.path,
      query: {
        ...(_keywords ? { keywords: _keywords } : {}),
        ...(_meta_startDate
          ? { meta_startDate: new Date(_meta_startDate).toISOString() }
          : {}),
        ...(_meta_endDate
          ? { meta_endDate: new Date(_meta_endDate).toISOString() }
          : {}),
        ...(_meta_orderState ? { meta_orderState: _meta_orderState } : {}),
        ...(_showMode ? { showMode: _showMode } : {}),
      },
    });
  };

  const downloadColumnsListInitialValues: TDownloadColumnListFormValues =
    useMemo(
      () => ({
        downloadColumnListName: [],
      }),
      [],
    );

  return (
    <div className={css.root}>
      <div className={css.pageHeader}>
        <h1 className={css.title}>
          <FormattedMessage id="ManageOrders.title" />
        </h1>
        <NamedLink path={adminRoutes.CreateOrder.path}>
          <Button>{intl.formatMessage({ id: 'tao-don' })}</Button>
        </NamedLink>
      </div>
      <div className={css.filterForm}>
        <IntegrationFilterModal
          onClear={onClearFilter}
          leftFilters={
            <Tooltip
              tooltipContent={
                <FilterForm
                  onSubmit={onFilterSubmit}
                  initialValues={{
                    meta_state: groupStateString,
                    keywords,
                    meta_orderState,
                    showMode: showMode as string,
                    meta_startDate: startDateOnQuery
                      ? new Date(startDateOnQuery as string).getTime()
                      : undefined,
                    meta_endDate: endDateOnQuery
                      ? new Date(endDateOnQuery as string).getTime()
                      : undefined,
                  }}
                />
              }
              placement="bottomLeft"
              trigger="click"
              overlayClassName={css.orderDetailTooltip}
              overlayInnerStyle={{
                backgroundColor: '#fff',
                padding: 0,
              }}>
              <Button
                type="button"
                variant="secondary"
                className={css.filterButton}>
                <IconFilter className={css.filterIcon} />
                <FormattedMessage id="IntegrationFilterModal.filterMessage" />
              </Button>
            </Tooltip>
          }
          rightFilters={
            <div className="flex flex-col items-end gap-2 md:flex-row">
              <DeliveryAgentsMealsSettingDialog />
              <Tooltip
                tooltipContent={
                  <FilterColumnForm
                    onSubmit={(values: TFilterColumnFormValues) =>
                      setDisplayedColumns(values.columnName)
                    }
                    initialValues={{
                      columnName: displayedColumns,
                    }}
                  />
                }
                placement="bottomRight"
                trigger="click"
                overlayClassName={css.orderDetailTooltip}
                overlayInnerStyle={{ backgroundColor: '#fff', padding: 0 }}>
                <Button variant="secondary">
                  {intl.formatMessage({ id: 'cot' })}
                </Button>
              </Tooltip>
              <Tooltip
                tooltipContent={
                  <DownloadColumnListForm
                    onSubmit={handleDownloadOrderList}
                    initialValues={downloadColumnsListInitialValues}
                    inProgress={queryAllOrdersInProgress}
                  />
                }
                placement="bottomRight"
                trigger="click"
                overlayClassName={css.orderDetailTooltip}
                overlayInnerStyle={{ backgroundColor: '#fff', padding: 0 }}>
                <Button variant="secondary">
                  {intl.formatMessage({
                    id: 'ManagePaymentsPage.actionButton.downloadPayment',
                  })}
                </Button>
              </Tooltip>
            </div>
          }
        />
      </div>
      {content}
    </div>
  );
};

export default ManageOrdersPage;
