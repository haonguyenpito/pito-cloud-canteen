import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import IconArrow from '@components/Icons/IconArrow/IconArrow';
import type { TDefaultProps, TIconProps } from '@utils/types';

import css from './MultiLevelSidebar.module.scss';

const getDynamicPathParamsName = (pathname: string) => {
  const newPathname = pathname.split('/');
  const paramNames: string[] = [];
  newPathname.forEach((path: string) => {
    const paramsName = path.substring(
      path.indexOf('[') + 1,
      path.lastIndexOf(']'),
    );
    if (paramsName) {
      paramNames.push(paramsName);
    }
  });

  return paramNames;
};

export type TSidebarMenu = {
  id: string | number;
  label: string;
  Icon?: React.FC<TIconProps>;
  childrenMenus?: TSidebarMenu[];
  nameLink?: string;
  isFirstLevel?: boolean;
  highlightRefLinks?: string[];
  showOnActiveChildrenMenus?: TSidebarMenu[];
};

type TMenuWithClasses = {
  menuWrapperClassName?: string;
  subMenuWrapperClassName?: string;
  subMenuLayoutClassName?: string;
  menuLabelClassName?: string;
};

type TSubMenuProps = {
  menu: TSidebarMenu;
} & TMenuWithClasses;

type TMenuProps = {
  menus: TSidebarMenu[];
} & TMenuWithClasses;

type TMultiLevelSidebarProps = TDefaultProps & {
  menus: TSidebarMenu[];
} & TMenuWithClasses;

const SubMenu: React.FC<TSubMenuProps> = (props) => {
  const {
    menu,
    subMenuWrapperClassName,
    subMenuLayoutClassName,
    menuWrapperClassName,
    menuLabelClassName,
  } = props;

  const intl = useIntl();
  const router = useRouter();
  const { pathname, query } = router;

  const [isOpen, setIsOpen] = useState(false);

  const {
    Icon,
    label,
    childrenMenus,
    showOnActiveChildrenMenus,
    nameLink = '',
    isFirstLevel,
    highlightRefLinks,
  } = menu;

  const hasChildrenMenus =
    (showOnActiveChildrenMenus && showOnActiveChildrenMenus.length > 0) ||
    (childrenMenus && childrenMenus.length > 0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const childMenus = showOnActiveChildrenMenus || childrenMenus || [];

  const paramNames = getDynamicPathParamsName(nameLink);
  // Only get dynamic params not search params
  const newQueryParams = Object.keys(query).reduce((acc, key) => {
    if (paramNames.includes(key)) {
      return { ...acc, [key]: query[key] };
    }

    return acc;
  }, {});

  const nestedCheckChildrenActive = (menus: TSidebarMenu[] = []): boolean =>
    menus.some(
      (childMenu) =>
        childMenu.nameLink === pathname ||
        childMenu.highlightRefLinks?.includes(pathname) ||
        nestedCheckChildrenActive(childMenu?.childrenMenus || []),
    );

  const childIsActive = nestedCheckChildrenActive(childMenus);
  const isChildMenu = !isFirstLevel;
  const shouldShowMenuesOnActiveOnly =
    (childIsActive && showOnActiveChildrenMenus) ||
    (!showOnActiveChildrenMenus && childMenus.length > 0);

  useEffect(() => {
    if (childIsActive) {
      setIsOpen(true);
    }
  }, [childIsActive]);

  const subMenuWrapperClasses = classNames(
    css.subMenu,
    subMenuWrapperClassName,
    isChildMenu && css.subChildMenu,
  );

  const activeWithHighlightRefLinksLinks =
    highlightRefLinks?.includes(pathname);

  const isActive = activeWithHighlightRefLinksLinks || pathname === nameLink;

  const subMenuLayoutClasses = classNames(
    css.subMenuLayout,
    subMenuLayoutClassName,
    {
      [css.isOpen]:
        isFirstLevel &&
        ((isOpen && childIsActive) || (!hasChildrenMenus && isActive)),
      [css.childActive]: !isOpen && hasChildrenMenus && childIsActive,
    },
  );

  const shouldRenderChildMenues =
    isOpen && childMenus.length > 0 && shouldShowMenuesOnActiveOnly;

  const shouldShowArrowIcon =
    childMenus.length > 0 && shouldShowMenuesOnActiveOnly;

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (
      showOnActiveChildrenMenus ||
      (!showOnActiveChildrenMenus && !childrenMenus)
    ) {
      // router.query can lag behind the URL right after navigation (isReady
      // race) — bail rather than push a route with an unfilled [param] left
      // literally in the path.
      const hasAllParams = paramNames.every(
        (paramName) => (newQueryParams as Record<string, unknown>)[paramName],
      );
      if (!hasAllParams) return undefined;

      return router.push({ pathname: nameLink, query: newQueryParams });
    }

    return setIsOpen(!isOpen);
  };

  return (
    <div className={subMenuWrapperClasses}>
      <div className={subMenuLayoutClasses} onClick={handleMenuClick}>
        <div className={css.subMenuItem}>
          {Icon && <Icon className={css.entityIcon} />}
          <div
            className={classNames(
              css.label,
              menuLabelClassName,
              isChildMenu && css.isChildMenu,
              { [css.active]: isActive },
            )}>
            {intl.formatMessage({
              id: label,
            })}
          </div>
        </div>
        {shouldShowArrowIcon && (
          <IconArrow
            direction={isOpen ? 'up' : 'down'}
            className={css.menuArrowIcon}
          />
        )}
      </div>
      {/* render children menu */}
      {shouldRenderChildMenues && (
        // eslint-disable-next-line @typescript-eslint/no-use-before-define, no-use-before-define
        <Menu
          menus={childMenus}
          subMenuWrapperClassName={subMenuWrapperClassName}
          subMenuLayoutClassName={subMenuLayoutClassName}
          menuWrapperClassName={menuWrapperClassName}
          menuLabelClassName={menuLabelClassName}
        />
      )}
    </div>
  );
};

const Menu: React.FC<TMenuProps> = (props) => {
  const {
    menus,
    menuWrapperClassName,
    subMenuWrapperClassName,
    subMenuLayoutClassName,
    menuLabelClassName,
  } = props;

  const menuWrapperClasses = classNames(css.menuWrapper, menuWrapperClassName);

  return (
    <div className={menuWrapperClasses}>
      {menus.map((menu: TSidebarMenu) => {
        return (
          <SubMenu
            key={menu.id}
            menu={menu}
            menuWrapperClassName={menuWrapperClassName}
            subMenuWrapperClassName={subMenuWrapperClassName}
            subMenuLayoutClassName={subMenuLayoutClassName}
            menuLabelClassName={menuLabelClassName}
          />
        );
      })}
    </div>
  );
};

const MultiLevelSidebar: React.FC<TMultiLevelSidebarProps> = (props) => {
  const {
    menus,
    rootClassName,
    menuWrapperClassName,
    subMenuWrapperClassName,
    subMenuLayoutClassName,
    menuLabelClassName,
  } = props;
  const rootClasses = classNames(css.root, rootClassName);

  return (
    <div className={rootClasses}>
      <Menu
        menus={menus}
        menuWrapperClassName={menuWrapperClassName}
        subMenuWrapperClassName={subMenuWrapperClassName}
        subMenuLayoutClassName={subMenuLayoutClassName}
        menuLabelClassName={menuLabelClassName}
      />
    </div>
  );
};

export default MultiLevelSidebar;
