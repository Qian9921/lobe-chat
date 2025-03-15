import { PropsWithChildren } from 'react';

import { authEnv } from '@/config/auth';
import { enableFirebaseAuth } from '@/const/auth';

import Clerk from './Clerk';
import Firebase from './Firebase';
import NextAuth from './NextAuth';
import NoAuth from './NoAuth';

const AuthProvider = ({ children }: PropsWithChildren) => {
  if (enableFirebaseAuth) return <Firebase>{children}</Firebase>;

  if (authEnv.NEXT_PUBLIC_ENABLE_CLERK_AUTH) return <Clerk>{children}</Clerk>;

  if (authEnv.NEXT_PUBLIC_ENABLE_NEXT_AUTH) return <NextAuth>{children}</NextAuth>;

  return <NoAuth>{children}</NoAuth>;
};

export default AuthProvider;
