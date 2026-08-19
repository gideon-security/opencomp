'use client';

import { useTranslations } from 'next-intl';
import { Meta, ReportPage } from './report-page';

export function ReportCover() {
  const t = useTranslations('security');
  return (
    <ReportPage>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 6.5,
          fontWeight: 700,
          letterSpacing: '0.32em',
          color: '#3c3c3c',
          marginBottom: 26,
        }}
      >
        <span>C O M P&nbsp;&nbsp;A I</span>
        <span style={{ color: '#777' }}>
          {t('penTest.report.confidentiality')}
        </span>
      </div>
      <div style={{ fontSize: 7, color: '#777', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
        yourapp.example.com
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
          marginBottom: 4,
          color: '#111',
        }}
      >
        {t('penTest.report.title')}
      </div>
      <div style={{ fontSize: 8, color: '#555', marginBottom: 28 }}>
        {t('penTest.report.subtitle')}
      </div>
      <div
        style={{
          fontSize: 6,
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: '#888',
          paddingBottom: 6,
          borderBottom: '0.5px solid #ddd',
          marginBottom: 12,
        }}
      >
        {t('penTest.report.reportType')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, fontSize: 7, color: '#333' }}>
        <Meta label={t('penTest.report.assessmentPeriod')} value="May 5, 2026 — May 5, 2026" />
        <Meta label={t('penTest.report.reportDate')} value="May 5, 2026" />
        <Meta label={t('penTest.report.version')} value="1.0" />
        <Meta label={t('penTest.report.reference')} value="pentest-1777989012736" />
      </div>
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 5.5,
          color: '#888',
        }}
      >
        <span>{t('penTest.report.footerLabel')}</span>
        <span>1 of 33</span>
      </div>
    </ReportPage>
  );
}
