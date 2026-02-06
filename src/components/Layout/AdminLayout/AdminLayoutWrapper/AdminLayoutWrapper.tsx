/**
 * LayoutSingleColumn needs to have 2-3 children:
 * LayoutWrapperTopbar, LayoutWrapperMain, and possibly LayoutWrapperFooter.
 */
import type { ReactElement } from 'react';
import React from 'react';
import classNames from 'classnames';

import type { TDefaultProps } from '@utils/types';

import AdminLayoutContent from '../AdminLayoutContent/AdminLayoutContent';
import AdminLayoutSidebar from '../AdminLayoutSidebar/AdminLayoutSidebar';
import AdminLayoutTopbar from '../AdminLayoutTopbar/AdminLayoutTopbar';

import css from './AdminLayoutWrapper.module.scss';

const prepareChildren = (children: ReactElement[]) => {
  const childrenCount = React.Children.count(children);
  if (!(childrenCount === 2 || childrenCount === 3)) {
    throw new Error(
      `AdminLayoutWrapper needs to have 2 - 3 children:
      AdminLayoutTopbar, AdminLayoutContent.`,
    );
  }

  const childrenMap = {} as any;

  React.Children.forEach(children, (child: ReactElement) => {
    if (child.type === AdminLayoutTopbar) {
      childrenMap.layoutWrapperTopbar = child;
    } else if (child.type === AdminLayoutSidebar) {
      childrenMap.layoutWrapperSiderbar = child;
    } else if (child.type === AdminLayoutContent) {
      // LayoutWrapperMain needs different rootClassName
      const childWithAddedCSS = React.cloneElement(child, {
        rootClassName: css.layoutWrapperMain,
      });
      childrenMap.layoutWrapperMain = childWithAddedCSS;
    } else {
      throw new Error(
        `AdminLayoutWrapper has an unknown child.
      Only AdminLayoutTopbar ,AdminLayoutContent are allowed.`,
      );
    }
  });

  return childrenMap;
};

type TAdminLayoutWrapperProps = TDefaultProps & {
  children: ReactElement[];
  isMenuOpen?: boolean;
  onCloseMenu?: () => void;
};

const AdminLayoutWrapper = (props: TAdminLayoutWrapperProps) => {
  const { className, children, rootClassName, isMenuOpen, onCloseMenu } = props;
  const preparedChildren = prepareChildren(children);
  const classes = classNames(rootClassName || css.root, className, {
    [css.sidebarOpen]: isMenuOpen,
  });
  const maybeFooter = preparedChildren.layoutWrapperFooter || null;

  const handleOverlayClick = () => {
    if (onCloseMenu && isMenuOpen) {
      onCloseMenu();
    }
  };

  return (
    <div className={classes}>
      {isMenuOpen && (
        <div className={css.overlay} onClick={handleOverlayClick} />
      )}
      {preparedChildren.layoutWrapperSiderbar}
      <div className={css.main}>
        {preparedChildren.layoutWrapperTopbar}
        {preparedChildren.layoutWrapperMain}
      </div>
      {maybeFooter}
    </div>
  );
};

export default AdminLayoutWrapper;
