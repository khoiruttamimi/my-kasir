import { UserRole } from '@/models/user';
import { ShoppingCartOutlined, ShoppingOutlined, TeamOutlined } from '@ant-design/icons';

export const getMenus = (isHaveAccess: (role: UserRole) => boolean) => {
  const menus = [
    {
      key: '/dashboard/products',
      icon: <ShoppingOutlined />,
      label: 'Products',
      roles: ['admin', 'cashier'],
    },
    {
      key: '/dashboard/transactions',
      icon: <ShoppingCartOutlined />,
      label: 'Transactions',
      roles: ['admin', 'cashier'],
    },
    {
      key: '/dashboard/users',
      icon: <TeamOutlined />,
      label: 'Users',
      roles: ['admin'],
    },
  ];

  return menus.filter((menu) => menu.roles.some((role) => isHaveAccess(role as UserRole)));
};
