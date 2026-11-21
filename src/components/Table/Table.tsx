/* eslint-disable @typescript-eslint/no-shadow */
import type { ReactNode } from 'react';
import React from 'react';
import { Form as FinalForm, FormSpy } from 'react-final-form';
import { FormattedMessage } from 'react-intl';
import classNames from 'classnames';
import type { FormApi } from 'final-form';
import { useRouter } from 'next/router';

import Form from '@components/Form/Form';
import FieldCheckbox from '@components/FormFields/FieldCheckbox/FieldCheckbox';
import IconSort from '@components/Icons/IconSort/IconSort';
import Pagination from '@components/Pagination/Pagination';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import type { TDefaultProps, TObject, TPagination } from '@utils/types';

import CollapsibleRows from './CollapsibleRows/CollapsibleRows';

import css from './Table.module.scss';

export type TColumn = {
  key: string;
  label: string | ReactNode;
  render: (
    data: any,
    isChecked: boolean,
    collapseRowController?: TObject,
  ) => ReactNode;
  sortable?: boolean;
};

export type TRowData = {
  key: string | number;
  data: any;
};

type TTableProps = TDefaultProps & {
  columns: TColumn[];
  data: TRowData[];
  tableClassName?: string;
  tableHeadClassName?: string;
  tableHeadRowClassName?: string;
  tableHeadCellClassName?: string;
  tableHeadCellLabelClassName?: string;
  tableBodyClassName?: string;
  tableBodyRowClassName?: string;
  tableBodyCellClassName?: string;
  paginationLinksClassName?: string;
  paginationLinksRootClassName?: string;
  paginationPath?: string;
  pagePathParams?: any;
  pageSearchParams?: any;
  pagination?: TPagination | null;
  isLoading?: boolean;
  onSubmit?: (e: any) => void;
  initialValues?: any;
  hasCheckbox?: boolean;
  form?: FormApi;
  values?: any;
  exposeValues?: (e: any) => void;
  handleSort?: (columnName: string) => void;
  sortValue?: { columnName: string; type: 'asc' | 'desc' };
  customCheckboxChange?: (e: any) => void;
  afterCheckboxChangeHandler?: (e: any, rowCheckboxValues: any) => void;
  extraRows?: ReactNode;
  /**
   * Opt-in accordion: when a row's key matches, `renderExpandedContent` is
   * rendered in a full-width row directly beneath it. Both props absent means
   * the table behaves exactly as before — this is used by many screens.
   */
  expandedRowKey?: string | number | null;
  renderExpandedContent?: (row: TRowData) => ReactNode;
  tableWrapperClassName?: string;
  shouldReplacePathWhenChangePage?: boolean;
  onCustomPageChange?: (page: number, pageSize?: number) => void;
  paginationProps?: TObject;
};

const getUniqueString = (list: string[]) => {
  return list.filter((value, index, self) => {
    return self.indexOf(value) === index;
  });
};

const Table = (props: TTableProps) => {
  const {
    columns = [],
    data = [],
    tableHeadClassName,
    tableHeadRowClassName,
    tableHeadCellClassName,
    tableHeadCellLabelClassName,
    tableBodyClassName,
    tableBodyRowClassName,
    tableBodyCellClassName,
    paginationLinksClassName,
    pagination,
    isLoading,
    tableClassName,
    paginationPath,
    shouldReplacePathWhenChangePage = false,
    hasCheckbox,
    form,
    values,
    handleSort,
    sortValue,
    afterCheckboxChangeHandler,
    extraRows,
    expandedRowKey = null,
    renderExpandedContent,
    tableWrapperClassName,
    onCustomPageChange,
    paginationProps = {},
  } = props;
  const tableClasses = classNames(css.table, tableClassName);
  const router = useRouter();

  const onPageChange = (page: number, pageSize?: number) => {
    if (typeof onCustomPageChange === 'function') {
      onCustomPageChange(page, pageSize);
    } else {
      const params = {
        pathname: paginationPath,
        query: {
          ...router.query,
          page,
          ...(pageSize ? { perPage: pageSize } : {}),
        },
      };

      if (shouldReplacePathWhenChangePage) {
        router.replace(params);
      } else {
        router.push(params);
      }
    }
  };

  const customOnChangeCheckAllCheckbox = (e: any) => {
    const { checked, value, name } = e.target;
    form?.change(name, !checked ? [] : [value]);
    const { rowCheckbox = [] } = values;
    const newValues = [...rowCheckbox];
    data.forEach((val) => {
      newValues.push(val.key);
    });
    form?.change('rowCheckbox', !checked ? [] : getUniqueString(newValues));
    if (afterCheckboxChangeHandler) {
      afterCheckboxChangeHandler(e, rowCheckbox);
    }
  };

  const rowCheckboxChange = (e: any) => {
    const { checked, value, name } = e.target;
    const { rowCheckbox = [] } = values;
    const newValues = [...rowCheckbox];
    if (!checked) {
      const index = newValues.findIndex((val) => val === value);
      newValues.splice(index, 1);
      form?.change('checkAll', []);
    } else {
      newValues.push(value);
    }
    if (newValues.length === data.length) {
      form?.change('checkAll', ['checkAll']);
    }
    form?.change(name, newValues);
    if (afterCheckboxChangeHandler) {
      afterCheckboxChangeHandler(e, rowCheckbox);
    }
  };

  const sortData = (key: string) => () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    handleSort && handleSort(key);
  };

  return (
    <>
      <div className={classNames(css.tableWrapper, tableWrapperClassName)}>
        <table className={tableClasses}>
          <thead className={tableHeadClassName}>
            <tr className={classNames(css.headRow, tableHeadRowClassName)}>
              {hasCheckbox && (
                <td
                  className={classNames(tableHeadCellClassName, css.headCell)}>
                  <FieldCheckbox
                    labelClassName={css.checkboxLabel}
                    svgClassName={css.checkboxSvg}
                    customOnChange={customOnChangeCheckAllCheckbox}
                    name="checkAll"
                    id="checkAll"
                    value="checkAll"
                    label=" "
                  />
                </td>
              )}
              {columns.map((col: TColumn) => (
                <td
                  className={classNames(tableHeadCellClassName, css.headCell)}
                  key={col.key}>
                  <div
                    className={classNames(
                      css.headCellLabel,
                      tableHeadCellLabelClassName,
                    )}>
                    {col.label}
                    {col.sortable && (
                      <IconSort
                        onClick={sortData(col.key)}
                        className={css.sortIcon}
                        type={
                          col.key === sortValue?.columnName
                            ? sortValue?.type
                            : undefined
                        }
                      />
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </thead>
          {isLoading ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className={css.emptyCell}>
                  Loading...
                </td>
              </tr>
            </tbody>
          ) : data.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className={css.emptyCell}>
                  <FormattedMessage id="Table.noResults" />
                </td>
              </tr>
              {extraRows && <tr className={css.bodyRow}>{extraRows}</tr>}
            </tbody>
          ) : (
            <tbody className={tableBodyClassName}>
              {data.map((row: TRowData) => (
                <React.Fragment key={row.key}>
                  <RenderWhen
                    key={row.key}
                    condition={Boolean(row.data.isParent)}>
                    <CollapsibleRows
                      row={row}
                      columns={columns}
                      hasCheckbox={hasCheckbox}
                      tableBodyRowClassName={tableBodyRowClassName}
                      tableBodyCellClassName={tableBodyCellClassName}
                      rowCheckboxChange={rowCheckboxChange}
                      values={values}
                    />
                    <RenderWhen.False>
                      <tr
                        className={classNames(
                          tableBodyRowClassName,
                          css.bodyRow,
                        )}
                        key={row.key}>
                        {hasCheckbox && (
                          <td
                            className={classNames(
                              tableBodyCellClassName,
                              css.bodyCell,
                            )}>
                            <FieldCheckbox
                              labelClassName={css.checkboxLabel}
                              svgClassName={css.checkboxSvg}
                              name="rowCheckbox"
                              id={`rowCheckbox.${row.key}`}
                              value={row.key as any}
                              label=" "
                              customOnChange={rowCheckboxChange}
                            />
                          </td>
                        )}
                        {columns.map((col: TColumn) => {
                          const rowCheckbox = values?.rowCheckbox || [];
                          const isChecked = rowCheckbox.includes(row.key);

                          return (
                            <td
                              className={classNames(
                                tableBodyCellClassName,
                                css.bodyCell,
                              )}
                              data-label={col.label}
                              key={col.key}>
                              {col.render(row.data, isChecked)}
                            </td>
                          );
                        })}
                      </tr>
                    </RenderWhen.False>
                  </RenderWhen>
                  {renderExpandedContent && expandedRowKey === row.key && (
                    <tr className={css.expandedRow}>
                      <td
                        className={css.expandedCell}
                        colSpan={columns.length + (hasCheckbox ? 1 : 0)}>
                        {renderExpandedContent(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {extraRows && <tr className={css.bodyRow}>{extraRows}</tr>}
            </tbody>
          )}
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          className={paginationLinksClassName}
          total={pagination.totalItems}
          pageSize={pagination.perPage}
          current={pagination.page}
          onChange={onPageChange}
          {...paginationProps}
        />
      )}
    </>
  );
};

export const TableForm: React.FC<TTableProps> = (props) => {
  const { rootClassName, onSubmit, initialValues, exposeValues, ...rest } =
    props;
  const rootClasses = classNames(css.root, rootClassName);

  return (
    <FinalForm
      onSubmit={onSubmit || (() => {})}
      initialValues={initialValues}
      render={(fieldRenderProps) => {
        const { handleSubmit, form, values } = fieldRenderProps;

        return (
          <Form onSubmit={handleSubmit} className={rootClasses}>
            <FormSpy
              subscription={{ values: true, valid: true }}
              onChange={(state) => {
                const { values, valid } = state;
                if (exposeValues) {
                  exposeValues({ values, valid });
                }
              }}
            />
            <Table {...rest} form={form} values={values} />
          </Form>
        );
      }}
    />
  );
};

export default Table;
