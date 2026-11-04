import { describe, it, expect } from 'vitest';
import { migrateProject } from '../core/migrations/migrate';
import { SCHEMA_VERSION } from '../core/models/types';
import type { ProjectEnvelope } from '../core/models/types';

function v1Resume(): ProjectEnvelope {
  return {
    id: 'p1', type: 'resume', schemaVersion: 1, title: 'Old', createdAt: 0, updatedAt: 0, archived: false,
    data: { content: {}, templateId: 'modern', design: {}, sectionOrder: ['summary'], hiddenSections: [] },
  } as unknown as ProjectEnvelope;
}

describe('migrateProject', () => {
  it('upgrades a v1 resume by adding snapshots and bumping schemaVersion', () => {
    const { project, migrated } = migrateProject(v1Resume());
    expect(migrated).toBe(true);
    expect(project.schemaVersion).toBe(SCHEMA_VERSION);
    expect((project.data as { snapshots: unknown[] }).snapshots).toEqual([]);
  });

  it('flags projects from a newer schema without mutating them', () => {
    const future = { ...v1Resume(), schemaVersion: 999 };
    const { migrated, warnings } = migrateProject(future);
    expect(migrated).toBe(false);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('is a no-op for an already-current project', () => {
    const current = { ...v1Resume(), schemaVersion: SCHEMA_VERSION, data: { ...(v1Resume().data as object), snapshots: [] } };
    const { migrated } = migrateProject(current as ProjectEnvelope);
    expect(migrated).toBe(false);
  });
});
