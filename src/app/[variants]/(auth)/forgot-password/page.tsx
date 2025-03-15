'use client';

import { Alert, Button, Form, Input, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import { BRANDING_SITE } from '@/const/branding';
import { resetPassword } from '@/libs/firebase/auth';

const { Text, Title } = Typography;

const ForgotPassword = () => {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string }) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await resetPassword(values.email);
      
      // 发送成功后显示成功信息
      setSuccess(t('resetPasswordEmailSent'));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login/firebase');
  };

  return (
    <Center padding={24} style={{ minHeight: '100vh' }}>
      <Flexbox style={{ maxWidth: 400, width: '100%' }}>
        <Title level={2} style={{ margin: '0 0 24px', textAlign: 'center' }}>
          {t('forgotPassword')}
        </Title>
        
        {error && (
          <Alert
            message={error}
            showIcon
            style={{ marginBottom: 24 }}
            type="error"
          />
        )}
        
        {success && (
          <Alert
            message={success}
            showIcon
            style={{ marginBottom: 24 }}
            type="success"
          />
        )}
        
        <Form layout="vertical" name="forgotPasswordForm" onFinish={onFinish}>
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
          
          <Form.Item>
            <Button block htmlType="submit" loading={loading} size="large" type="primary">
              {t('resetPassword')}
            </Button>
          </Form.Item>
          
          <Form.Item>
            <Button onClick={handleBackToLogin} type="link">
              {t('backToLogin')}
            </Button>
          </Form.Item>
        </Form>
        
        <Flexbox align="center" gap={8} style={{ marginTop: 24 }}>
          <Text type="secondary">
            {t('poweredBy')} <a href={BRANDING_SITE} rel="noreferrer" target="_blank">{t('brandName')}</a>
          </Text>
        </Flexbox>
      </Flexbox>
    </Center>
  );
};

export default ForgotPassword;
