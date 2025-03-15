'use client';

import { Alert, Button, Divider, Form, Input, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import { BRANDING_SITE } from '@/const/branding';
import { loginWithGoogle, registerUser } from '@/libs/firebase/auth';

import GoogleButton from '../../login/firebase/GoogleButton';

const { Text, Title } = Typography;

const FirebaseSignUp = () => {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onFinish = async (values: { displayName: string, email: string; password: string; }) => {
    try {
      setLoading(true);
      setError(null);
      
      await registerUser(values.email, values.password, values.displayName);
      
      // 注册成功后跳转到主页
      router.push('/');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      
      await loginWithGoogle();
      
      // 登录成功后跳转到主页
      router.push('/');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/login/firebase');
  };

  return (
    <Center padding={24} style={{ minHeight: '100vh' }}>
      <Flexbox style={{ maxWidth: 400, width: '100%' }}>
        <Title level={2} style={{ margin: '0 0 24px', textAlign: 'center' }}>
          {t('signup')}
        </Title>
        
        {error && (
          <Alert
            message={error}
            showIcon
            style={{ marginBottom: 24 }}
            type="error"
          />
        )}
        
        <Form layout="vertical" name="signupForm" onFinish={onFinish}>
          <Form.Item
            label={t('displayName')}
            name="displayName"
            rules={[{ message: t('displayNameRequired'), required: true }]}
          >
            <Input placeholder={t('displayNamePlaceholder')} size="large" />
          </Form.Item>
          
          <Form.Item
            label={t('email')}
            name="email"
            rules={[
              { message: t('emailRequired'), required: true },
              { message: t('emailInvalid'), type: 'email' },
            ]}
          >
            <Input placeholder={t('emailPlaceholder')} size="large" />
          </Form.Item>
          
          <Form.Item
            label={t('password')}
            name="password"
            rules={[{ message: t('passwordRequired'), required: true }]}
          >
            <Input.Password placeholder={t('passwordPlaceholder')} size="large" />
          </Form.Item>
          
          <Form.Item
            dependencies={['password']}
            label={t('confirmPassword')}
            name="confirmPassword"
            rules={[
              { message: t('confirmPasswordRequired'), required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password placeholder={t('confirmPasswordPlaceholder')} size="large" />
          </Form.Item>
          
          <Form.Item>
            <Button block htmlType="submit" loading={loading} size="large" type="primary">
              {t('signupButton')}
            </Button>
          </Form.Item>
          
          <Form.Item>
            <Button onClick={handleLogin} type="link">
              {t('alreadyHaveAccount')}
            </Button>
          </Form.Item>
        </Form>

        <Divider>{t('orContinueWith')}</Divider>
        
        <GoogleButton loading={googleLoading} onClick={handleGoogleLogin} />
        
        <Flexbox align="center" gap={8} style={{ marginTop: 24 }}>
          <Text type="secondary">
            {t('poweredBy')} <a href={BRANDING_SITE} rel="noreferrer" target="_blank">{t('brandName')}</a>
          </Text>
        </Flexbox>
      </Flexbox>
    </Center>
  );
};

export default FirebaseSignUp;
