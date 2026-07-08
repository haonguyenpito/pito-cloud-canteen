import React, { Fragment } from 'react';
import { FieldArray } from 'react-final-form-arrays';
import { useIntl } from 'react-intl';

import { InlineTextButton } from '@components/Button/Button';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import IconAdd from '@components/Icons/IconAdd/IconAdd';
import IconDelete from '@components/Icons/IconDelete/IconDelete';
import { parseThousandNumber, removeNonNumeric } from '@helpers/format';
import { composeValidators, required } from '@utils/validators';

import css from './FieldPccFeeTiers.module.scss';

type TFieldPccFeeTiers = {
  id: string;
  name: string;
};

const positiveInteger =
  (message: string) =>
  (value: string): string | undefined => {
    if (!value && value !== '0') return message;
    const n = Number(removeNonNumeric(String(value)));
    if (!Number.isInteger(n) || n <= 0) return message;
    return undefined;
  };

const positiveNumber =
  (message: string) =>
  (value: string): string | undefined => {
    if (!value && value !== '0') return message;
    const n = Number(removeNonNumeric(String(value)));
    if (isNaN(n) || n <= 0) return message;
    return undefined;
  };

const quantityIncreasing =
  (message: string, index: number, name: string) =>
  (value: string, allValues: any): string | undefined => {
    if (index === 0) return undefined;
    const tiers: any[] = allValues?.[name] ?? [];
    const prev = tiers[index - 1];
    if (!prev) return undefined;
    const prevQty = Number(removeNonNumeric(String(prev.maxQuantity ?? '')));
    const currQty = Number(removeNonNumeric(String(value ?? '')));
    if (isNaN(prevQty) || isNaN(currQty)) return undefined;
    return currQty <= prevQty ? message : undefined;
  };

const FieldPccFeeTiers: React.FC<TFieldPccFeeTiers> = ({ id, name }) => {
  const intl = useIntl();

  const parseFee = (value: string) => parseThousandNumber(value);

  return (
    <FieldArray name={name} id={id}>
      {({ fields }: any) => {
        const addRow = () => {
          fields.push({ maxQuantity: '', price: '' });
        };

        const removeRow = (index: number) => () => {
          fields.remove(index);
        };

        const total = fields.length ?? 0;

        return (
          <div className={css.root}>
            <p className={css.title}>
              {intl.formatMessage({ id: 'FieldPccFeeTiers.tableTitle' })}
            </p>
            <div className={css.header}>
              <span className={css.colQuantity}>
                {intl.formatMessage({ id: 'FieldPccFeeTiers.colQuantity' })}
              </span>
              <span className={css.colPrice}>
                {intl.formatMessage({ id: 'FieldPccFeeTiers.colPrice' })}
              </span>
            </div>

            {fields.map((fieldName: string, index: number) => {
              const isLast = index === total - 1;
              const prevMaxQty =
                index > 0
                  ? fields.value?.[index - 1]?.maxQuantity ?? 0
                  : 0;

              return (
                <Fragment key={fieldName}>
                  <div className={css.row}>
                    <div className={css.quantityCell}>
                      <span className={css.rangePrefix}>
                        {index === 0
                          ? intl.formatMessage({
                              id: 'FieldPccFeeTiers.firstRowLabel',
                            })
                          : `${prevMaxQty} <`}
                      </span>
                      {isLast ? (
                        <span className={css.unbounded}>
                          {intl.formatMessage(
                            { id: 'FieldPccFeeTiers.unboundedLabel' },
                            { value: prevMaxQty },
                          )}
                        </span>
                      ) : (
                        <FieldTextInput
                          id={`${fieldName}.maxQuantity`}
                          name={`${fieldName}.maxQuantity`}
                          type="number"
                          placeholder={intl.formatMessage({
                            id: 'FieldPccFeeTiers.quantityPlaceholder',
                          })}
                          className={css.input}
                          validate={composeValidators(
                            required(
                              intl.formatMessage({
                                id: 'FieldPccFeeTiers.error.quantityRequired',
                              }),
                            ),
                            positiveInteger(
                              intl.formatMessage({
                                id: 'FieldPccFeeTiers.error.quantityPositiveInt',
                              }),
                            ),
                            quantityIncreasing(
                              intl.formatMessage({
                                id: 'FieldPccFeeTiers.error.quantityIncreasing',
                              }),
                              index,
                              name,
                            ),
                          )}
                        />
                      )}
                    </div>

                    <div className={css.priceCell}>
                      <FieldTextInput
                        id={`${fieldName}.price`}
                        name={`${fieldName}.price`}
                        placeholder={intl.formatMessage({
                          id: 'FieldPccFeeTiers.pricePlaceholder',
                        })}
                        className={css.input}
                        parse={parseFee}
                        format={parseFee}
                        validate={composeValidators(
                          required(
                            intl.formatMessage({
                              id: 'FieldPccFeeTiers.error.priceRequired',
                            }),
                          ),
                          positiveNumber(
                            intl.formatMessage({
                              id: 'FieldPccFeeTiers.error.pricePositive',
                            }),
                          ),
                        )}
                      />
                    </div>

                    {index !== 0 && (
                      <InlineTextButton
                        type="button"
                        onClick={removeRow(index)}
                        className={css.deleteButton}>
                        <IconDelete />
                      </InlineTextButton>
                    )}
                  </div>
                </Fragment>
              );
            })}

            <InlineTextButton
              type="button"
              onClick={addRow}
              className={css.addButton}>
              <IconAdd />
              <span>
                {intl.formatMessage({ id: 'FieldPccFeeTiers.addRow' })}
              </span>
            </InlineTextButton>
          </div>
        );
      }}
    </FieldArray>
  );
};

export default FieldPccFeeTiers;
