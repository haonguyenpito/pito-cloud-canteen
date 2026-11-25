import React from 'react';
import { FormattedMessage } from 'react-intl';
import classNames from 'classnames';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import { InlineTextButton } from '@components/Button/Button';
import IconClose from '@components/Icons/IconClose/IconClose';
import { parseThousandNumber } from '@helpers/format';
import { getBillablePrice } from '@helpers/menuExtraFee';
import { EFoodType } from '@src/utils/enums';

import type { TEditMenuPricingCalendarResources } from '../EditPartnerMenuWizard/utils';

import css from './FoodEventCard.module.scss';

/**
 * One dish in a menu calendar.
 * @param props.event.resource - The dish; with `showPrice`, the card shows its
 *   partner price (`price`) and the client price (`price` + `extraFee`).
 * @param props.event.start - The calendar date the dish is served on.
 */
const FoodEventCard = ({
  event,
}: {
  event: { resource: TEditMenuPricingCalendarResources; start: Date };
}) => {
  const { resource, start } = event;
  const {
    title,
    onRemovePickedFood,
    sideDishes = [],
    hideRemoveButton,
    foodType,
    showPrice,
    price = 0,
    extraFee = 0,
  } = resource;
  const isVegetarian = foodType === EFoodType.vegetarianDish;

  return (
    <div
      className={classNames(
        css.root,
        isVegetarian && css.vegetarian,
        !hideRemoveButton && css.removable,
      )}>
      <div className={css.content}>
        {isVegetarian && (
          <Badge
            className={css.vegetarianBadge}
            type={EBadgeType.info}
            label="Chay"
          />
        )}
        <div className={css.title}>{title}</div>
        {sideDishes.length > 0 && (
          <div className={css.sideDishesContent}>
            <FormattedMessage
              id="FoodEventCard.sideDishesContent"
              values={{
                boldText: (
                  <span className={css.boldText}>
                    <FormattedMessage id="FoodEventCard.sideDishesLabel" />
                  </span>
                ),
              }}
            />
          </div>
        )}
        {showPrice && (
          <div className={css.priceRow}>
            <span className={css.priceLabel}>
              <FormattedMessage id="FoodEventCard.partnerPriceLabel" />
            </span>
            <span className={css.priceLabel}>
              {parseThousandNumber(price, '.')}đ
            </span>
            <span className={css.priceLabel}>
              <FormattedMessage id="FoodEventCard.customerPriceLabel" />
            </span>
            <span
              className={classNames(css.price, extraFee > 0 && css.withFee)}>
              {parseThousandNumber(getBillablePrice(price, extraFee), '.')}đ
            </span>
          </div>
        )}
      </div>
      {!hideRemoveButton && (
        <InlineTextButton
          type="button"
          onClick={() =>
            onRemovePickedFood && onRemovePickedFood(resource.id, start)
          }
          className={css.buttonClose}>
          <IconClose rootClassName={css.iconClose} />
        </InlineTextButton>
      )}
    </div>
  );
};

export default FoodEventCard;
