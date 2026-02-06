import { useField, useForm } from 'react-final-form-hooks';
import { FormattedMessage, useIntl } from 'react-intl';
import Slider from 'react-slick';
import classNames from 'classnames';
import isEmpty from 'lodash/isEmpty';

import Badge from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import { FieldTextAreaComponent } from '@components/FormFields/FieldTextArea/FieldTextArea';
import IconBox from '@components/Icons/IconBox/IconBox';
import Modal from '@components/Modal/Modal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import ResponsiveImage from '@components/ResponsiveImage/ResponsiveImage';
import { useAppSelector } from '@hooks/reduxHooks';
import { Listing } from '@src/utils/data';
import { EImageVariants } from '@src/utils/enums';
import {
  FOOD_SIDE_DISH_OPTIONS,
  FOOD_SPECIAL_DIET_OPTIONS,
} from '@src/utils/options';
import { getDecorator, toNonAccentVietnamese } from '@src/utils/string';
import type { TKeyValue } from '@src/utils/types';
import { maxLength } from '@src/utils/validators';

import css from './ListingDetailModal.module.scss';

type TListingDetailModalProps = {
  isOpen: boolean;
  title: string;
  listing: any;
  requirement: string;
  onClose: () => void;
  onSelectFood: () => void;
  onChangeRequirement: (value: string) => void;
};

const ListingDetailModal: React.FC<TListingDetailModalProps> = (props) => {
  const {
    isOpen,
    listing,
    title,
    requirement,
    onClose,
    onChangeRequirement,
    onSelectFood,
  } = props;

  const intl = useIntl();
  const { form: foodSelectionForm, invalid } = useForm({
    onSubmit: () => {},
    initialValues: {
      requirement,
    },
  });
  const requirementField = useField(
    'requirement',
    foodSelectionForm,
    maxLength('Ghi chú không được vượt quá 500 kí tự', 500),
  );
  const packagingOptions = useAppSelector(
    (state) => state.SystemAttributes.packaging,
  );

  const listingObj = Listing(listing);
  const listingImages = Listing(listing).getImages() || [];

  const { description } = listingObj.getAttributes();
  const {
    sideDishes = [],
    allergicIngredients = [],
    specialDiets = [],
    packaging,
  } = listingObj.getPublicData();
  const packagingLabel = packagingOptions.find(
    ({ key }: TKeyValue) =>
      toNonAccentVietnamese(packaging, true) ===
      toNonAccentVietnamese(key, true),
  )?.label;

  const badges = specialDiets
    .slice(0, 3)
    .map((diet: string) =>
      FOOD_SPECIAL_DIET_OPTIONS.find((item) => item.key === diet),
    );
  const sideDishesText = sideDishes.reduce((res: any, dishKey: string) => {
    const suitableSideDish = FOOD_SIDE_DISH_OPTIONS.find(
      (d) => d.key === dishKey,
    );

    if (!isEmpty(suitableSideDish)) {
      return res.concat(<div key={dishKey}>{suitableSideDish.label}</div>);
    }

    return res;
  }, []);

  const hasDescription = !isEmpty(description);
  const hasAllergicIngredients = allergicIngredients.length > 0;

  const sliderSettings = {
    dots: true,
    dotsClass: classNames('slick-dots', css.dots),
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    draggable: true,
    arrows: false,
  };

  const handleChangeRequirement = (value: string) => {
    onChangeRequirement(value);
  };

  const fieldRequirement = {
    label: intl.formatMessage({
      id: 'ListingDetailModal.fieldRequirement.label',
    }),
    placeholder: intl.formatMessage({
      id: 'ListingDetailModal.fieldRequirement.placeholder',
    }),
  };

  return (
    <Modal
      id={`ListingDetailModal.${title}`}
      isOpen={isOpen}
      handleClose={onClose}
      contentClassName={css.modalContentWrapper}
      containerClassName={css.modalContainer}
      headerClassName={css.headerModal}>
      <div className={css.modalContent}>
        <div className={css.listingImage}>
          <RenderWhen condition={listingImages.length > 0}>
            <Slider {...sliderSettings}>
              {listingImages.map((image: any) => {
                return (
                  <ResponsiveImage
                    key={image}
                    image={image}
                    alt={title}
                    variants={[
                      EImageVariants.landscapeCrop6x,
                      EImageVariants.landscapeCrop4x,
                    ]}
                    emptyType="food"
                  />
                );
              })}
            </Slider>

            <RenderWhen.False>
              <div className={css.decoratorWrapper}>
                <img
                  src={getDecorator(listing.id?.uuid)}
                  alt={title}
                  className={css.decoratorImage}
                />
              </div>
            </RenderWhen.False>
          </RenderWhen>
        </div>

        <div className={css.section}>
          <div className={css.foodTitleWrapper}>
            <div className={css.foodTitle}>{title}</div>
            <RenderWhen condition={!isEmpty(packagingLabel)}>
              <div className={css.packagingSection}>
                <IconBox className={css.iconBox} />
                <div>{packagingLabel}</div>
              </div>
            </RenderWhen>
          </div>

          <RenderWhen condition={badges?.length > 0}>
            <div className={css.badgeContainer}>
              {badges.map((badge: any) => (
                <Badge
                  key={badge?.key}
                  label={badge?.label}
                  type={badge?.badgeType}
                />
              ))}
            </div>
          </RenderWhen>
        </div>

        <RenderWhen condition={hasDescription || hasAllergicIngredients}>
          <div className={css.section}>
            <RenderWhen condition={hasDescription}>
              <div className={css.description}>{description}</div>
            </RenderWhen>

            <RenderWhen condition={hasAllergicIngredients}>
              <div className={css.allergiesLabel}>
                <FormattedMessage id="ListingDetailModal.allergiesLabel" />
                <span className={css.allergyItem}>
                  {allergicIngredients
                    .map((item: string) => ` ${item}`)
                    .join(', ')}
                </span>
              </div>
            </RenderWhen>
          </div>
        </RenderWhen>

        <RenderWhen condition={!isEmpty(sideDishesText)}>
          <div className={css.section}>
            <div className={css.sideDishesLabel}>
              <FormattedMessage id="ListingDetailModal.sideDishesLabel" />
            </div>
            <div className={css.sideDishesContent}>{sideDishesText}</div>
          </div>
        </RenderWhen>

        <div className={css.requirementSection}>
          <div className={css.requirementLabel}>{fieldRequirement.label}</div>
          <FieldTextAreaComponent
            name="requirement"
            id="ListingDetailModal.requirement"
            className={css.fieldRequirement}
            input={requirementField.input}
            meta={requirementField.meta}
            placeholder={fieldRequirement.placeholder}
            onChange={handleChangeRequirement}
          />
        </div>

        <div className={css.selectFoodSection}>
          <Button
            disabled={invalid}
            className={css.selectFoodBtn}
            onClick={onSelectFood}>
            {intl.formatMessage({
              id: 'booker.orders.draft.foodDetailModal.addDish',
            })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ListingDetailModal;
