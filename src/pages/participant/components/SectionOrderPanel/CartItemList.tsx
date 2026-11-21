import React from 'react';
import { useIntl } from 'react-intl';
import { DateTime } from 'luxon';

import { isOrderOverDeadline } from '@helpers/orderHelper';
import { useAppSelector } from '@hooks/reduxHooks';
import { Listing } from '@utils/data';
import type { TObject } from '@utils/types';

import CartItem from './CartItem';

type TCartItemList = {
  className?: string;
  cartList: TObject;
  cartListKeys: string[];
  plan: any;
  handleRemoveItem: (dayId: string, removeSecondFood?: boolean) => void;
};

const CartItemList: React.FC<TCartItemList> = ({
  cartList,
  plan,
  cartListKeys = [],
  handleRemoveItem,
}) => {
  const intl = useIntl();
  const order = useAppSelector((state) => state.ParticipantPlanPage.order);

  const isOrderDeadlineOver = isOrderOverDeadline(order);

  const onRemoveItem = (dayId: string) => () => {
    handleRemoveItem(dayId);
  };
  // Functions
  const renderItem = (item: any, key: string) => {
    const planDate = DateTime.fromMillis(Number(key)).toJSDate();
    const itemLabel = `${intl.formatMessage({
      id: `Calendar.week.dayHeader.${planDate.getDay()}`,
    })}, ${planDate.getDate()}/${
      planDate.getMonth() + 1
    }/${planDate.getFullYear()}`;

    const { foodId = '', secondaryFoodId = '' } = item;

    if (foodId === '') {
      return null;
    }

    const foodList = plan?.[key]?.foodList || [];

    const selectedDish =
      foodId === 'notJoined'
        ? null
        : foodList.find((food: any) => food?.id?.uuid === foodId);
    const dishAttributes =
      foodId === 'notJoined' ? null : Listing(selectedDish).getAttributes();
    const dishTitle =
      foodId === 'notJoined'
        ? intl.formatMessage({ id: 'SectionOrderPanel.notJoined' })
        : dishAttributes?.title;

    const secondDish =
      secondaryFoodId && secondaryFoodId !== 'notJoined'
        ? foodList.find((food: any) => food?.id?.uuid === secondaryFoodId)
        : null;
    const secondDishAttributes = secondDish
      ? Listing(secondDish).getAttributes()
      : null;
    const secondDishTitle = secondDishAttributes?.title;

    return (
      <div key={key}>
        <CartItem
          label={itemLabel}
          value={dishTitle}
          subOrderDate={key}
          removeDisabled={isOrderDeadlineOver}
          onRemove={onRemoveItem(key)}
          foodPosition="first"
        />
        {secondDishTitle && (
          <CartItem
            label=""
            value={secondDishTitle}
            subOrderDate={key}
            removeDisabled={isOrderDeadlineOver}
            onRemove={() => {
              handleRemoveItem(key, true);
            }}
            foodPosition="second"
          />
        )}
      </div>
    );
  };

  return (
    <>
      {cartListKeys
        .sort()
        .map((cartKey: string) => renderItem(cartList[cartKey], cartKey))}
    </>
  );
};

export default CartItemList;
