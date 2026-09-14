import { Pagination as AntdPagination } from 'antd';
import styles from './styles.module.scss';

type PaginationProps = {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
};

export default function PaginationTable({ page, limit, total, onChange }: PaginationProps) {
  return (
    <div className={styles.paginationWrapper}>
      <span>Total {total} items</span>
      <AntdPagination current={page} pageSize={limit} total={total} onChange={onChange} showSizeChanger />
    </div>
  );
}
