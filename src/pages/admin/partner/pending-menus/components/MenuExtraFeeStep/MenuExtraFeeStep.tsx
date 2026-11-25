import React, { Fragment, useMemo } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { parseThousandNumber } from '@helpers/format';
import { getBillablePrice } from '@helpers/menuExtraFee';
import { EDayOfWeek } from '@src/utils/enums';
import { getLabelByKey, useFoodTypeOptionsByLocale } from '@src/utils/options';

import type { TMenuExtraFeeDayGroup } from './utils';
import { parseExtraFeeInput, toFeeInputValue } from './utils';

const DAY_LABELS: Record<EDayOfWeek, string> = {
  [EDayOfWeek.mon]: 'Thứ 2',
  [EDayOfWeek.tue]: 'Thứ 3',
  [EDayOfWeek.wed]: 'Thứ 4',
  [EDayOfWeek.thu]: 'Thứ 5',
  [EDayOfWeek.fri]: 'Thứ 6',
  [EDayOfWeek.sat]: 'Thứ 7',
  [EDayOfWeek.sun]: 'Chủ nhật',
};

const COLUMN_COUNT = 5;

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
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
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
            {dayGroups.map(({ day, rows }) => (
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

                  return (
                    <tr
                      key={`${day}-${foodId}`}
                      className="border-t border-gray-100">
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
                          // globals.scss resets every input to `border: none`.
                          className="w-28 rounded-lg !border !border-solid !border-gray-300 px-2 py-1 text-right tabular-nums disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatVnd(
                          getBillablePrice(
                            partnerPrice,
                            parseExtraFeeInput(draft),
                          ),
                        )}
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
