'use client';

import { Alert, Avatar, Button, Card, Divider, Form, Input, Spin, Typography } from 'antd';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import { logoutUser } from '@/libs/firebase/auth';
import { db } from '@/libs/firebase/firebase';
import { useFirebaseAuth } from '@/libs/firebase';

const { Text, Title } = Typography;

const FirebaseProfile = () => {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { user, userData, loading } = useFirebaseAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login/firebase');
    }
    
    if (userData) {
      form.setFieldsValue({
        displayName: userData.display_name,
        firstName: userData.first_name,
        lastName: userData.last_name,
      });
    }
  }, [user, userData, loading, router, form]);

  const onFinish = async (values: { displayName: string; firstName: string; lastName: string }) => {
    if (!user) return;
    
    try {
      setUpdateLoading(true);
      setError(null);
      setSuccess(null);
      
      // 更新 Firestore 中的用户数据
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        display_name: values.displayName,
        first_name: values.firstName,
        last_name: values.lastName,
      });
      
      setSuccess(t('profileUpdated'));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.push('/login/firebase');
    } catch (error) {
      setError((error as Error).message);
    }
  };

  if (loading) {
    return (
      <Center padding={24} style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Center>
    );
  }

  if (!user || !userData) {
    return null;
  }

  return (
    <Center padding={24} style={{ minHeight: '100vh' }}>
      <Flexbox style={{ maxWidth: 600, width: '100%' }}>
        <Title level={2} style={{ margin: '0 0 24px', textAlign: 'center' }}>
          {t('updateProfile')}
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
        
        <Card>
          <Flexbox align="center" gap={16}>
            <Avatar size={80} src={userData.photo_url || undefined}>
              {userData.display_name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Flexbox gap={4}>
              <Title level={4} style={{ margin: 0 }}>
                {userData.display_name}
              </Title>
              <Text type="secondary">{userData.email}</Text>
              {userData.role && <Text type="secondary">角色: {userData.role}</Text>}
            </Flexbox>
          </Flexbox>
          
          <Divider />
          
          <Form form={form} layout="vertical" name="profileForm" onFinish={onFinish}>
            <Form.Item
              label={t('displayName')}
              name="displayName"
              rules={[{ message: t('displayNameRequired'), required: true }]}
            >
              <Input />
            </Form.Item>
            
            <Form.Item label={t('firstName')} name="firstName">
              <Input />
            </Form.Item>
            
            <Form.Item label={t('lastName')} name="lastName">
              <Input />
            </Form.Item>
            
            <Form.Item>
              <Button htmlType="submit" loading={updateLoading} type="primary">
                {t('updateProfile')}
              </Button>
            </Form.Item>
          </Form>
          
          <Divider />
          
          <Button danger onClick={handleLogout} type="primary">
            {t('logout')}
          </Button>
        </Card>
      </Flexbox>
    </Center>
  );
};

export default FirebaseProfile;
