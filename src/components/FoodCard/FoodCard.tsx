import React from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import IconCheckmarkWithCircle from '@components/Icons/IconCheckmark/IconCheckmarkWithCircle';
import IconPlusCircle from '@components/Icons/IconPlusCircle/IconPlusCircle';
import ResponsiveImage from '@components/ResponsiveImage/ResponsiveImage';
import { addCommas } from '@helpers/format';
import { getLabelByKey, useFoodTypeOptionsByLocale } from '@src/utils/options';
import { getDecorator } from '@src/utils/string';
import { Listing } from '@utils/data';
import { EFoodType, EImageVariants } from '@utils/enums';
import type { TListing } from '@utils/types';

import css from './FoodCard.module.scss';

type TFoodCardProps = {
  className?: string;
  isSelected?: boolean;
  food?: TListing;
  onClick?: (foodId: string) => void;
  onSelect?: (foodId: string) => void;
  onRemove?: (foodId: string) => void;
  hideSelection?: boolean;
};

const FoodCard: React.FC<TFoodCardProps> = ({
  className,
  isSelected = false,
  food,
  onSelect = () => null,
  onRemove = () => null,
  onClick = () => null,
  hideSelection = false,
}) => {
  const intl = useIntl();
  const classes = classNames(css.root, className);
  const { foodType } = Listing(food!).getPublicData();

  const handleSelect = () => {
    onSelect(`${Listing(food!).getId()}`);
  };

  const handleClickFood = () => {
    onClick(`${Listing(food!).getId()}`);
  };

  const FOOD_TYPE_OPTIONS = useFoodTypeOptionsByLocale();
  const handleRemove = () => {
    onRemove(Listing(food!).getId());
  };
  const selection = isSelected ? (
    <IconCheckmarkWithCircle onClick={handleRemove} className={css.checkIcon} />
  ) : (
    <IconPlusCircle onClick={handleSelect} className={css.plusIcon} />
  );
  const foodTypeLabel = getLabelByKey(FOOD_TYPE_OPTIONS, foodType);
  const isVegetarian = foodType === EFoodType.vegetarianDish;

  return (
    <div
      className={classNames(
        classes,
        '!border-stone-200 hover:!border-stone-400 cursor-pointer',
      )}
      onClick={handleClickFood}>
      <div
        className={classNames(
          css.coverImage,
          'relative w-[120px] h-[100px] rounded-lg overflow-hidden flex-shrink-0',
        )}>
        {Listing(food!).getImages().length > 0 ? (
          <ResponsiveImage
            alt="food"
            image={Listing(food!).getImages()[0]}
            variants={[EImageVariants.default]}
            className="w-full h-full object-cover"
            emptyType="food"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={getDecorator(Listing(food!).getId())}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
      <div className={css.contentContainer}>
        <div className={css.topInfor}>
          <div className={classNames(css.title, '!text-sm font-semibold')}>
            {Listing(food!).getAttributes().title}
          </div>
        </div>
        <div className={css.badges}>
          <Badge
            className={css.badge}
            type={isVegetarian ? EBadgeType.success : EBadgeType.default}
            label={foodTypeLabel}
          />
        </div>
        <div
          className={classNames(
            css.price,
            '!text-sm font-semibold',
          )}>{`${addCommas(
          Listing(food!).getAttributes().price?.amount,
        )} ₫ / ${intl.formatMessage({ id: 'phan' })}`}</div>
      </div>
      {!hideSelection && (
        <div onClick={(e) => e.stopPropagation()}>{selection}</div>
      )}
    </div>
  );
};

export default FoodCard;
