import { Img, Section } from '@react-email/components';

export function Logo() {
  return (
    <Section className="mt-[32px]">
      <Img
        src={'https://assets.gideondefender.com/logo.png'}
        width="45"
        height="45"
        alt="OpenComp"
        className="mx-auto my-0 block"
      />
    </Section>
  );
}
