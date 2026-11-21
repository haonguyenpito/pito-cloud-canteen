import { FormattedMessage, useIntl } from 'react-intl';
import classNames from 'classnames';
import { DateTime } from 'luxon';
import { useRouter } from 'next/router';

import IconBanned from '@components/Icons/IconBanned/IconBanned';
import IconCheckmarkTabTitle from '@components/Icons/IconCheckmark/IconCheckmarkTabTitle';
import ListingCard from '@components/ListingCard/ListingCard';
import Tabs from '@components/Tabs/Tabs';
import Tooltip from '@components/Tooltip/Tooltip';
import { isOrderOverDeadline as isOverDeadline } from '@helpers/orderHelper';
import { useAppSelector } from '@hooks/reduxHooks';
import { hasDishInCart } from '@hooks/useHasDishInCart';
import { useViewport } from '@hooks/useViewport';
import type { TPlanData } from '@src/types/order';
import { Listing } from '@src/utils/data';
import { EOrderStates } from '@src/utils/enums';

import { listingLoading } from './Loading';
import TabActions from './TabActions';

import css from './SectionOrderListing.module.scss';

type TSectionOrderListingProps = {
  plan: TPlanData;
  onSelectTab: (restaurant: any) => void;
  orderDay: string;
  onAddedToCart: ({
    foodName,
    timestamp,
  }: {
    foodName?: string;
    timestamp: string;
  }) => void;
};

const SectionOrderListing: React.FC<TSectionOrderListingProps> = ({
  plan,
  onSelectTab,
  orderDay,
  onAddedToCart,
}) => {
  const intl = useIntl();

  const router = useRouter();
  const { planId } = router.query;

  const cartList = useAppSelector((state) => {
    const { currentUser } = state.user;
    const currUserId = currentUser?.id?.uuid;

    return state.shoppingCart.orders?.[currUserId]?.[`${planId}` || 1];
  });
  const order = useAppSelector((state) => state.ParticipantPlanPage.order);

  const loadDataInProgress = useAppSelector(
    (state) => state.ParticipantPlanPage.loadDataInProgress,
  );
  const reloadDataInProgress = useAppSelector(
    (state) => state.ParticipantPlanPage.reloadDataInProgress,
  );
  const submitDataInprogress = useAppSelector(
    (state) => state.ParticipantPlanPage.submitDataInprogress,
  );

  const isAllowAddSecondaryFood = useAppSelector(
    (state) => state.ParticipantPlanPage.isAllowAddSecondaryFood,
  );
  const orderListing = Listing(order);
  const { orderState } = orderListing.getMetadata();
  const isOrderDeadlineOver = isOverDeadline(order);
  const isOrderAlreadyStarted = orderState !== EOrderStates.picking;

  const { isMobileLayout } = useViewport();

  const convertDataToTabItem = () => {
    if (loadDataInProgress) {
      return listingLoading();
    }
    const convertedData: any = [];
    Object.keys(plan).forEach((item, oIndex) => {
      const isLast = oIndex === Object.keys(plan).length - 1;
      const { foodList, restaurant, foodExtraFees = {} } = plan[item];
      const cartItem = cartList?.[item] || {};

      const hasDishInCartValue = hasDishInCart(
        cartItem,
        foodList,
        isAllowAddSecondaryFood,
      );
      const planDate = DateTime.fromMillis(Number(item)).toJSDate();
      const weekdayLabel = intl.formatMessage({
        id: `Calendar.week.dayHeader.${planDate.getDay()}`,
      });
      const dateNumber = planDate.getDate();
      const monthNumber = planDate.getMonth() + 1;

      const itemLabel = ({ isActive }: { isActive?: boolean }) => {
        if (isMobileLayout) {
          return (
            <div
              className={classNames(css.tabTitle, css.tabTitleMobile, {
                [css.tabTitleMobileActive]: isActive,
              })}>
              <div className={css.tabDateWrapper}>
                <span
                  className={classNames(css.tabDate, {
                    [css.tabDateActive]: isActive,
                  })}>
                  {dateNumber}
                </span>
                <span className={css.tabMonth}>/{monthNumber}</span>
              </div>
              <div className={css.tabWeekday}>{weekdayLabel}</div>
              {hasDishInCartValue &&
                (hasDishInCartValue === 'notJoined' ? (
                  <Tooltip tooltipContent={'meow'}>
                    <IconBanned className={css.tabTitleIcon} />
                  </Tooltip>
                ) : (
                  <Tooltip tooltipContent={'meow'}>
                    <IconCheckmarkTabTitle className={css.tabTitleIcon} />
                  </Tooltip>
                ))}
              {isLast && (
                <div className="absolute right-0 w-[40px] mr-[-40px]"></div>
              )}
            </div>
          );
        }

        return (
          <div className={classNames(css.tabTitle, {})}>
            <div>
              {weekdayLabel}, {dateNumber}/{monthNumber}
            </div>
            {hasDishInCartValue &&
              (hasDishInCartValue === 'notJoined' ? (
                <Tooltip tooltipContent={'meow'}>
                  <IconBanned className={css.tabTitleIcon} />
                </Tooltip>
              ) : (
                <Tooltip tooltipContent={'meow'}>
                  <IconCheckmarkTabTitle className={css.tabTitleIcon} />
                </Tooltip>
              ))}
            {isLast && (
              <div className="absolute right-0 w-[40px] mr-[-40px]"></div>
            )}
          </div>
        );
      };

      const selectDisabled =
        isOrderDeadlineOver ||
        reloadDataInProgress ||
        submitDataInprogress ||
        isOrderAlreadyStarted;

      const childrenList = foodList.map((dish, index) => {
        const dishId = dish?.id?.uuid;
        const isFirstSelected = cartItem.foodId === dishId;
        const isSecondSelected = cartItem.secondaryFoodId === dishId;

        return (
          <ListingCard
            key={dishId || index}
            className={css.listingCard}
            listing={dish}
            dayId={item}
            planId={`${planId}`}
            isSelected={isFirstSelected || isSecondSelected}
            selectDisabled={selectDisabled}
            isOrderAlreadyStarted={isOrderAlreadyStarted}
            onAddedToCart={onAddedToCart}
            extraFee={foodExtraFees[`${dishId}`] ?? 0}
          />
        );
      });

      convertedData.push({
        label: itemLabel,
        id: item,
        children: <>{childrenList}</>,
        restaurant,
      });
    });

    return convertedData;
  };

  const tabItems = convertDataToTabItem();
  const defaultActiveKey = tabItems.findIndex(
    (item: any) => item.id === orderDay,
  );

  return (
    <div className={css.root}>
      <div className={css.sectionOrderNotify}>
        <FormattedMessage id="SectionOrderListing.sectionOrderNotify" />
      </div>
      <div className={css.sectionMainOrder}>
        <Tabs
          items={tabItems}
          defaultActiveKey={`${
            (defaultActiveKey < 0 ? 0 : defaultActiveKey) + 1
          }`}
          contentClassName={css.sectionMainOrderListings}
          headerClassName={css.sectionMainOrderHeader}
          onChange={onSelectTab}
          showNavigation
          middleLabel
          navigationStartClassName={css.leftNavigation}
          navigationEndClassName={css.rightNavigation}
          tabItemClassName={isMobileLayout ? css.timeTabItem : undefined}
          tabActiveItemClassName={
            isMobileLayout ? css.timeTabItemActive : undefined
          }
          actionsComponent={
            !isMobileLayout && (
              <TabActions
                orderId={order?.id?.uuid}
                orderDay={orderDay}
                planId={`${planId}`}
                isOrderDeadlineOver={isOrderDeadlineOver}
                onAddedToCart={onAddedToCart}
              />
            )
          }
          enableTabScroll
        />
      </div>
    </div>
  );
};

export default SectionOrderListing;
