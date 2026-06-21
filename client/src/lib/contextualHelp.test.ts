import { describe, expect, it } from 'vitest';
import {
  auditedHelpStatusKeys,
  contextualHelpConfigs,
  findHelpStatus,
  type HelpModuleId,
} from './contextualHelp';

const moduleIds = Object.keys(contextualHelpConfigs) as HelpModuleId[];

describe('contextual help config', () => {
  it('defines complete help sections for every configured module', () => {
    for (const moduleId of moduleIds) {
      const config = contextualHelpConfigs[moduleId];

      expect(config.module).toBeTruthy();
      expect(config.shortDescription).toBeTruthy();
      expect(config.overview).toBeTruthy();
      expect(config.lifecycle.length).toBeGreaterThan(1);
      expect(config.statuses.length).toBeGreaterThan(0);
      expect(config.transitions.length).toBeGreaterThan(0);
      expect(config.readinessImpact.length).toBeGreaterThan(0);
      expect(config.nextActions.length).toBeGreaterThan(0);
      expect(config.faqs.length).toBeGreaterThan(0);
    }
  });

  it('does not contain duplicate status keys per module', () => {
    for (const moduleId of moduleIds) {
      const keys = contextualHelpConfigs[moduleId].statuses.map((status) => status.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('only documents statuses from the audited status registry', () => {
    for (const moduleId of moduleIds) {
      const audited = new Set(auditedHelpStatusKeys[moduleId]);

      for (const status of contextualHelpConfigs[moduleId].statuses) {
        expect(audited.has(status.key), `${moduleId}.${status.key}`).toBe(true);
      }
    }
  });

  it('covers every audited status key in user-facing help content', () => {
    for (const moduleId of moduleIds) {
      const documented = new Set(contextualHelpConfigs[moduleId].statuses.map((status) => status.key));

      for (const key of auditedHelpStatusKeys[moduleId]) {
        expect(documented.has(key), `${moduleId}.${key}`).toBe(true);
      }
    }
  });

  it('resolves current item statuses safely', () => {
    const tests = contextualHelpConfigs.tests;

    expect(findHelpStatus(tests, 'needs_remediation')?.label).toBe('Needs remediation');
    expect(findHelpStatus(tests, 'Needs remediation')?.key).toBe('needs_remediation');
    expect(findHelpStatus(tests, 'UNKNOWN_STATUS')).toBeNull();
    expect(findHelpStatus(tests, null)).toBeNull();
  });
});
