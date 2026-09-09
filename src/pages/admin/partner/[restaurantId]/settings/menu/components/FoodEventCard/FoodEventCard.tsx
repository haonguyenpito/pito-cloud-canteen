import React from 'react';
import { FormattedMessage } from 'react-intl';
import classNames from 'classnames';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import { InlineTextButton } from '@components/Button/Button';
import IconClose from '@components/Icons/IconClose/IconClose';
import { EFoodType } from '@src/utils/enums';

import type { TEditMenuPricingCalendarResources } from '../EditPartnerMenuWizard/utils';

import css from './FoodEventCard.module.scss';

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
  } = resource;
  const isVegetarian = foodType === EFoodType.vegetarianDish;

  return (
    <div className={classNames(css.root, isVegetarian && css.vegetarian)}>
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
