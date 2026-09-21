'use client';

import { Form, FormItemProps, Input, Typography } from 'antd';
import styles from './styles.module.scss';

export const Title = Typography.Title;
export const Text = Typography.Text;
export const Search = Input.Search;

export const FormItem = (props: FormItemProps) => (
  <Form.Item {...props} className={styles.wrapper}>
    {props.children}
  </Form.Item>
);
