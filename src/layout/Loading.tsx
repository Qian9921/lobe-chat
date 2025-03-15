'use client';

import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { PropsWithChildren } from 'react';

export interface LoadingProps extends PropsWithChildren {
  description?: string;
  fullScreen?: boolean;
  loading?: boolean;
}

const Loading = ({ loading = true, fullScreen, children, description }: LoadingProps) => {
  const loadingIcon = <LoadingOutlined spin style={{ fontSize: 24 }} />;

  if (!loading) return children;

  const loadingContent = (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        height: fullScreen ? '100vh' : '100%',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Spin indicator={loadingIcon} tip={description} />
    </div>
  );

  return loadingContent;
};

export default Loading;
