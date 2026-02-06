import React from 'react';
import { useIntl } from 'react-intl';
import Skeleton from 'react-loading-skeleton';
import Image from 'next/image';

import Button from '@components/Button/Button';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import Modal from '@components/Modal/Modal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import ResponsiveImage from '@components/ResponsiveImage/ResponsiveImage';
import SlideModal from '@components/SlideModal/SlideModal';
import { addCommas } from '@helpers/format';
import { useFoodSideDishOptionsByLocale } from '@src/utils/options';
import { getDecorator } from '@src/utils/string';
import { Listing } from '@utils/data';
import { EImageVariants } from '@utils/enums';
import type { TListing } from '@utils/types';

import css from './FoodDetailModal.module.scss';

type TFoodDetailModalProps = {
  isOpen?: boolean;
  food?: TListing;
  onClose?: () => void;
  onSelect?: (foodId: string) => void;
  isLoading?: boolean;
  isMobileLayout?: boolean;
};

const FoodDetailModal: React.FC<TFoodDetailModalProps> = ({
  isOpen = false,
  food,
  onClose = () => null,
  onSelect,
  isLoading,
  isMobileLayout,
}) => {
  const intl = useIntl();

  const foodGetter = Listing(food!);
  const { sideDishes = [], notes } = foodGetter.getPublicData();
  const { title, price } = foodGetter.getAttributes();
  const FOOD_SIDE_DISH_OPTIONS = useFoodSideDishOptionsByLocale();

  const renderedSideDishes = sideDishes?.map(
    (sideDish: string, index: number) => (
      <div className={css.sideDish} key={`${index}-${sideDish}`}>
        {
          FOOD_SIDE_DISH_OPTIONS.find((option) => option.key === sideDish)
            ?.label
        }
      </div>
    ),
  );

  const handleSelectFood = () => {
    onSelect?.(food?.id?.uuid);
  };

  if (!isOpen) {
    return null;
  }

  const ModalComponent = isMobileLayout ? SlideModal : Modal;

  return (
    <ModalComponent
      id="FoodDetailModal"
      scrollLayerClassName={css.scrollLayer}
      containerClassName={css.modalContainer}
      isOpen={isOpen}
      handleClose={onClose}
      onClose={onClose}
      customHeader={<div></div>}>
      <div className={css.header}>
        <span className={css.goBack} onClick={onClose}>
          <IconArrow className={css.iconBack} direction="left" />
          <span>
            {intl.formatMessage({
              id: 'booker.orders.draft.foodDetailModal.back',
            })}
          </span>
        </span>
      </div>
      <RenderWhen condition={!isLoading}>
        <div className={css.scrollContainer}>
          <div className={css.coverImage}>
            {foodGetter.getImages().length > 0 ? (
              <ResponsiveImage
                alt={title}
                image={foodGetter.getImages()[0]}
                variants={[EImageVariants.default]}
                className="w-full h-full object-cover"
                emptyType="food"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image
                  src={getDecorator(foodGetter.getId())}
                  alt=""
                  className="w-full h-full"
                  fill
                  sizes="100px"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
          <div className={css.topContent}>
            <div className={css.foodTitle}>{title}</div>
            <div className={css.price}>{`${addCommas(
              price?.amount,
            )} ₫ / ${intl.formatMessage({ id: 'phan' })}`}</div>
          </div>
          <p className={css.description}>
            {Listing(food!).getAttributes().description ||
              intl.formatMessage({ id: 'khong-co-mo-ta' })}
          </p>

          <div className={css.sideDishesWrapper}>
            <div className={css.sideDishesTitle}>
              {intl.formatMessage({
                id: 'booker.orders.draft.foodDetailModal.sideDishesTitle',
              })}
            </div>
            {renderedSideDishes}
          </div>
          {notes && (
            <div className="mt-4">
              <p className="font-bold">
                {intl.formatMessage({ id: 'ghi-chu' })}:
              </p>
              <p className="font-normal mt-4 text-[14px]"> {notes}</p>
            </div>
          )}
        </div>

        <RenderWhen.False>
          <Skeleton className={css.loading} />
          <Skeleton className={css.loadingTitle} />
          <Skeleton className={css.loadingContent} />
        </RenderWhen.False>
      </RenderWhen>
      {onSelect && (
        <div className={css.footer}>
          <Button className={css.submitBtn} onClick={handleSelectFood}>
            {intl.formatMessage({
              id: 'booker.orders.draft.foodDetailModal.addDish',
            })}
          </Button>
        </div>
      )}
    </ModalComponent>
  );
};

export default FoodDetailModal;
