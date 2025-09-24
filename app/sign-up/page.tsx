"use client";

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <div className="flex justify-center">
            <img
              className="h-16 w-auto"
              src="/images/Logo-Final-Vector-22.png"
              alt="Halal Gelatin"
            />
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Halal Gelatin CRM System
          </p>
        </div>
        <div className="flex justify-center">
          <SignUp 
            appearance={{
              elements: {
                formButtonPrimary: 'bg-orange-600 hover:bg-orange-700 text-sm normal-case',
                card: 'shadow-lg',
                headerTitle: 'text-gray-900',
                headerSubtitle: 'text-gray-600',
                socialButtonsBlockButton: 'border-gray-300 hover:bg-gray-50',
                formFieldInput: 'border-gray-300 focus:border-orange-500 focus:ring-orange-500',
                footerActionLink: 'text-orange-600 hover:text-orange-700'
              }
            }}
            redirectUrl="/sso-callback"
            afterSignUpUrl="/sso-callback"
          />
        </div>
      </div>
    </div>
  );
}
