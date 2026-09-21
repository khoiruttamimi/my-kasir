'use client';

import { FormItem } from '@/components/antd-wrapper';
import { Alert, Button, Card, Form, Input } from 'antd';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { LoginFormValues } from './types';
import { useRouter } from 'next/navigation';

const LoginContainer = () => {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const router = useRouter();

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setErrorText('');
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error && result.error === 'CredentialsSignin') {
      setErrorText('Invalid email or password');
      return;
    } else if (result?.error) {
      setErrorText('System error');
      return;
    }
    setErrorText('');
    router.push('/');
  };

  return (
    <Card style={{ width: 420 }}>
      <div style={{ textAlign: 'center' }}>
        <img
          src="/logo/logo_text.png"
          alt="logo"
          style={{ marginBottom: 16, height: 50, width: 190, objectFit: 'cover' }}
        />
      </div>
      <Form layout="vertical" onFinish={handleSubmit}>
        <FormItem
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Invalid email' },
          ]}
        >
          <Input placeholder="Enter your email" />
        </FormItem>

        <FormItem label="Password" name="password" rules={[{ required: true, message: 'Password is required' }]}>
          <Input.Password placeholder="Enter your password" />
        </FormItem>

        {errorText && <Alert message={errorText} type="error" showIcon />}

        <Button type="primary" htmlType="submit" block loading={loading} className="mt-16">
          Login
        </Button>
      </Form>
    </Card>
  );
};

export default LoginContainer;
