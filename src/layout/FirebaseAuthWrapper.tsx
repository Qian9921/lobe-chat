'use client';

import { ReactNode } from 'react';

import { FirebaseAuthProvider } from '@/libs/firebase';

interface FirebaseAuthWrapperProps {
  children: ReactNode;
}

const FirebaseAuthWrapper = ({ children }: FirebaseAuthWrapperProps) => {
  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
};

export default FirebaseAuthWrapper;
