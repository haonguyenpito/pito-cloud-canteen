import React, { Fragment, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'react-toastify';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import { parseThousandNumber } from '@helpers/format';
import { getBillablePrice } from '@helpers/menuExtraFee';
import { EDayOfWeek } from '@src/utils/enums';
import { getLabelByKey, useFoodTypeOptionsByLocale } from '@src/utils/options';

import type { TMenuExtraFeeDayGroup } from './utils';
import {
  filterExtraFeeDayGroupsByPrice,
  parseExtraFeeInput,
  toFeeInputValue,
} from './utils';

const DAY_LABELS: Record<EDayOfWeek, string> = {
  [EDayOfWeek.mon]: 'Thứ 2',
  [EDayOfWeek.tue]: 'Thứ 3',
  [EDayOfWeek.wed]: 'Thứ 4',
  [EDayOfWeek.thu]: 'Thứ 5',
  [EDayOfWeek.fri]: 'Thứ 6',
  [EDayOfWeek.sat]: 'Thứ 7',
  [EDayOfWeek.sun]: 'Chủ nhật',
};

const COLUMN_COUNT = 6;

// globals.scss resets every input to `border: none`.
const NUMBER_INPUT_CLASS =
  'w-28 rounded-lg !border !border-solid !border-gray-300 px-2 py-1 text-right tabular-nums disabled:bg-gray-50';

const toPriceBound = (value: string) =>
  value === '' ? undefined : Number(value);

type TMenuExtraFeeStepProps = {
  dayGroups: TMenuExtraFeeDayGroup[];
  drafts: Record<string, string>;
  onDraftChange: (foodId: string, value: string) => void;
  disabled: boolean;
};

/**
 * Formats an amount in VND for display.
 * @param amount - The amount.
 * @returns e.g. `45.000đ`.
 */
const formatVnd = (amount: number) => `${parseThousandNumber(amount, '.')}đ`;

/**
 * First step of the menu review: the admin sets the extra fee per dish, day by
 * day. A dish served on several days shares one fee, so editing it on one day
 * updates every day.
 * @param props.dayGroups - The menu's dishes grouped by weekday.
 * @param props.drafts - Raw fee input per foodId.
 * @param props.onDraftChange - Called with a dish's new raw input.
 * @param props.disabled - Read-only once the menu is approved.
 */
const MenuExtraFeeStep: React.FC<TMenuExtraFeeStepProps> = ({
  dayGroups,
  drafts,
  onDraftChange,
  disabled,
}) => {
  const intl = useIntl();
  const foodTypeOptions = useFoodTypeOptionsByLocale();
  const foodIds = useMemo(
    () =>
      Array.from(
        new Set(dayGroups.flatMap(({ rows }) => rows.map((row) => row.foodId))),
      ),
    [dayGroups],
  );
  const feeCount = foodIds.filter(
    (foodId) => !!parseExtraFeeInput(drafts[foodId] || ''),
  ).length;

  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [bulkFee, setBulkFee] = useState('');
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const filteredDayGroups = useMemo(
    () =>
      filterExtraFeeDayGroupsByPrice(dayGroups, {
        min: toPriceBound(priceFrom),
        max: toPriceBound(priceTo),
      }),
    [dayGroups, priceFrom, priceTo],
  );
  const filteredFoodIds = useMemo(
    () =>
      Array.from(
        new Set(
          filteredDayGroups.flatMap(({ rows }) =>
            rows.map((row) => row.foodId),
          ),
        ),
      ),
    [filteredDayGroups],
  );
  // A dish hidden by the filter stays selected but is never changed.
  const targetFoodIds = filteredFoodIds.filter((foodId) =>
    selectedFoodIds.includes(foodId),
  );
  const isAllFilteredSelected =
    filteredFoodIds.length > 0 &&
    targetFoodIds.length === filteredFoodIds.length;

  const toggleFood = (foodId: string) => {
    setSelectedFoodIds((ids) =>
      ids.includes(foodId)
        ? ids.filter((id) => id !== foodId)
        : [...ids, foodId],
    );
  };

  const toggleAllFiltered = () => {
    setSelectedFoodIds((ids) =>
      isAllFilteredSelected
        ? ids.filter((id) => !filteredFoodIds.includes(id))
        : Array.from(new Set([...ids, ...filteredFoodIds])),
    );
  };

  const handleApplyBulkFee = () => {
    const fee = parseExtraFeeInput(bulkFee) ? bulkFee : '';
    targetFoodIds.forEach((foodId) => onDraftChange(foodId, fee));
    toast.success(
      intl.formatMessage(
        {
          id: fee
            ? 'MenuExtraFeeStep.bulkAppliedToast'
            : 'MenuExtraFeeStep.bulkClearedToast',
        },
        { count: targetFoodIds.length, fee: formatVnd(Number(fee)) },
      ),
    );
  };

  const clearPriceFilter = () => {
    setPriceFrom('');
    setPriceTo('');
  };

  return (
    <div className="py-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-medium">
          <FormattedMessage id="MenuExtraFeeStep.title" />
        </h3>
        <span className="text-sm text-gray-500">
          <FormattedMessage
            id="MenuExtraFeeStep.summary"
            values={{ feeCount, total: foodIds.length }}
          />
        </span>
      </div>
      <div className="mb-4 flex flex-col gap-3 text-sm text-gray-600">
        <p>
          <FormattedMessage
            id="MenuExtraFeeStep.scopeNote"
            values={{ b: (chunks: React.ReactNode) => <b>{chunks}</b> }}
          />
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={bulkFee}
              disabled={disabled}
              aria-label={intl.formatMessage({
                id: 'MenuExtraFeeStep.bulkFee',
              })}
              onChange={(e) => setBulkFee(toFeeInputValue(e.target.value))}
              className={classNames(NUMBER_INPUT_CLASS, 'h-12 w-36 pr-7')}
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
              đ
            </span>
          </div>
          <Button
            type="button"
            onClick={handleApplyBulkFee}
            disabled={disabled || bulkFee === '' || targetFoodIds.length === 0}>
            <FormattedMessage
              id="MenuExtraFeeStep.applyToSelected"
              values={{ count: targetFoodIds.length }}
            />
          </Button>
          <span>
            <FormattedMessage
              id="MenuExtraFeeStep.bulkHint"
              values={{ b: (chunks: React.ReactNode) => <b>{chunks}</b> }}
            />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            <FormattedMessage id="MenuExtraFeeStep.priceFilterLabel" />
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={intl.formatMessage({
              id: 'MenuExtraFeeStep.priceFrom',
            })}
            value={priceFrom}
            onChange={(e) => setPriceFrom(toFeeInputValue(e.target.value))}
            className={classNames(NUMBER_INPUT_CLASS, 'h-11')}
          />
          <span className="text-gray-400">–</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={intl.formatMessage({ id: 'MenuExtraFeeStep.priceTo' })}
            value={priceTo}
            onChange={(e) => setPriceTo(toFeeInputValue(e.target.value))}
            className={classNames(NUMBER_INPUT_CLASS, 'h-11')}
          />
          <Button
            type="button"
            size="medium"
            variant="secondary"
            onClick={clearPriceFilter}
            disabled={priceFrom === '' && priceTo === ''}>
            <FormattedMessage id="MenuExtraFeeStep.clearFilter" />
          </Button>
          <span>
            <FormattedMessage
              id="MenuExtraFeeStep.showingCount"
              values={{
                shown: filteredFoodIds.length,
                total: foodIds.length,
              }}
            />
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer align-middle"
                  checked={isAllFilteredSelected}
                  disabled={disabled || filteredFoodIds.length === 0}
                  aria-label={intl.formatMessage({
                    id: 'MenuExtraFeeStep.selectAll',
                  })}
                  onChange={toggleAllFiltered}
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <FormattedMessage id="MenuExtraFeeStep.foodName" />
              </th>
              <th className="px-4 py-3 font-medium">
                <FormattedMessage id="MenuExtraFeeStep.foodType" />
              </th>
              <th className="px-4 py-3 font-medium text-right">
                <FormattedMessage id="MenuExtraFeeStep.partnerPrice" />
              </th>
              <th className="px-4 py-3 font-medium text-right">
                <FormattedMessage id="MenuExtraFeeStep.extraFee" />
              </th>
              <th className="px-4 py-3 font-medium text-right">
                <FormattedMessage id="MenuExtraFeeStep.clientPrice" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDayGroups.length === 0 && (
              <tr className="border-t border-gray-100">
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-4 py-6 text-center text-gray-500">
                  <FormattedMessage id="MenuExtraFeeStep.noMatch" />
                </td>
              </tr>
            )}
            {filteredDayGroups.map(({ day, rows }) => (
              <Fragment key={day}>
                <tr className="border-t border-gray-200 bg-gray-50/60">
                  <td
                    colSpan={COLUMN_COUNT}
                    className="px-4 py-2 font-semibold text-gray-700">
                    {DAY_LABELS[day]}
                    <span className="ml-2 font-normal text-gray-500">
                      <FormattedMessage
                        id="MenuExtraFeeStep.dishCount"
                        values={{ count: rows.length }}
                      />
                    </span>
                  </td>
                </tr>
                {rows.map(({ foodId, title, foodType, partnerPrice }) => {
                  const draft = drafts[foodId] || '';
                  const fee = parseExtraFeeInput(draft);

                  return (
                    <tr
                      key={`${day}-${foodId}`}
                      className="border-t border-gray-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer align-middle"
                          checked={selectedFoodIds.includes(foodId)}
                          disabled={disabled}
                          aria-label={title}
                          onChange={() => toggleFood(foodId)}
                        />
                      </td>
                      <td className="px-4 py-3">{title}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {getLabelByKey(foodTypeOptions, foodType)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatVnd(partnerPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={draft}
                          disabled={disabled}
                          aria-label={intl.formatMessage(
                            { id: 'MenuExtraFeeStep.extraFeeOf' },
                            { title },
                          )}
                          placeholder="0"
                          onChange={(e) =>
                            onDraftChange(
                              foodId,
                              toFeeInputValue(e.target.value),
                            )
                          }
                          className={NUMBER_INPUT_CLASS}
                        />
                      </td>
                      <td
                        className={classNames(
                          'px-4 py-3 text-right font-semibold tabular-nums',
                          !!fee && 'text-orange-600',
                        )}>
                        {formatVnd(getBillablePrice(partnerPrice, fee))}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MenuExtraFeeStep;
