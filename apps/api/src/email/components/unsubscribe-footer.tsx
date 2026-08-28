import * as React from 'react';
import { Link, Section, Text } from '@react-email/components';
import { getUnsubscribeUrl } from '@gideon-defender/email';

interface Props {
  email: string;
  /**
   * Optional custom message prefix. Defaults to generic notifications text
   * to cover all API email types with a single component.
   */
  message?: string;
}

export function UnsubscribeFooter({ email, message = "Don't want to receive these notifications?" }: Props) {
  const url = getUnsubscribeUrl(email);
  return (
    <Section className="mt-[30px] mb-[20px]">
      <Text className="text-[12px] leading-[20px] text-[#666666]">
        {message}{' '}
        <Link href={url} className="text-[#121212] underline">
          Manage your email preferences
        </Link>
        .
      </Text>
    </Section>
  );
}
