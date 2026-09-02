import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ACTION_FUNCTION,
  LIVE_SUPABASE_PROJECT_REF,
  MISSING_TOKEN_ERROR,
  assertAdminActionOnlyDeployArgs,
  buildAdminActionOnlyDeployCommand,
  formatDeployCommand,
  main,
  requireSupabaseAccessToken,
} from '../../scripts/deploy-admin-action-get-site-content.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = resolve(ROOT, 'scripts/deploy-admin-action-get-site-content.mjs');

describe('deploy admin-action only (get_site_content) — --use-api, not executed', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  const pkg = readFileSync(resolve(ROOT, 'package.json'), 'utf8');

  it('targets live project and only admin-action via --use-api (no Docker)', () => {
    expect(LIVE_SUPABASE_PROJECT_REF).toBe('wqbefjzpgsezzwdrvvua');
    expect(ADMIN_ACTION_FUNCTION).toBe('admin-action');
    const cmd = buildAdminActionOnlyDeployCommand();
    expect(cmd).toEqual([
      'npx',
      'supabase',
      'functions',
      'deploy',
      'admin-action',
      '--project-ref',
      'wqbefjzpgsezzwdrvvua',
      '--use-api',
      '--yes',
    ]);
    expect(formatDeployCommand(cmd)).toBe(
      'npx supabase functions deploy admin-action --project-ref wqbefjzpgsezzwdrvvua --use-api --yes',
    );
    expect(cmd).toContain('--use-api');
    expect(cmd).not.toContain('--all');
    expect(cmd.join(' ')).not.toMatch(/vercel/i);
  });

  it('refuses a different project-ref', () => {
    expect(() => buildAdminActionOnlyDeployCommand('some-other-ref')).toThrow(
      /wqbefjzpgsezzwdrvvua/,
    );
  });

  it('fails closed when SUPABASE_ACCESS_TOKEN is missing', () => {
    expect(() => requireSupabaseAccessToken({})).toThrow(MISSING_TOKEN_ERROR);
    expect(() => requireSupabaseAccessToken({ SUPABASE_ACCESS_TOKEN: '   ' })).toThrow(
      /SUPABASE_ACCESS_TOKEN is missing/,
    );
    expect(requireSupabaseAccessToken({ SUPABASE_ACCESS_TOKEN: 'local-only-token' })).toBe(
      'local-only-token',
    );
  });

  it('CLI without a token exits 1 and does not deploy', () => {
    const env = { ...process.env };
    delete env.SUPABASE_ACCESS_TOKEN;
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: ROOT,
      encoding: 'utf8',
      env,
    });
    expect(result.status).toBe(1);
    const out = `${result.stdout || ''}${result.stderr || ''}`;
    expect(out).toMatch(/SUPABASE_ACCESS_TOKEN is missing/);
    expect(out).not.toMatch(/Deploying ONLY/);
  });

  it('refuses Vercel, --all, homepage, and project-ref overrides', () => {
    expect(() =>
      assertAdminActionOnlyDeployArgs(['node', SCRIPT, '--all']),
    ).toThrow(/must not touch Vercel/);
    expect(() =>
      assertAdminActionOnlyDeployArgs(['node', SCRIPT, '--prod']),
    ).toThrow(/must not touch Vercel/);
    expect(() =>
      assertAdminActionOnlyDeployArgs(['node', SCRIPT, 'vercel']),
    ).toThrow(/must not touch Vercel/);
    expect(() =>
      assertAdminActionOnlyDeployArgs(['node', SCRIPT, '--project-ref']),
    ).toThrow(/project-ref/);
    expect(() =>
      assertAdminActionOnlyDeployArgs(['node', SCRIPT, '--homepage']),
    ).toThrow(/homepage/);
    expect(() =>
      assertAdminActionOnlyDeployArgs(['node', SCRIPT, '--execute']),
    ).not.toThrow();
  });

  it('with a token and without --execute prints the command and does not exec supabase', () => {
    const code = main(['node', SCRIPT], { SUPABASE_ACCESS_TOKEN: 'unit-test-token' });
    expect(code).toBe(0);
  });

  it('source never ships a homepage / Vercel / --all deploy', () => {
    expect(src).not.toContain('deploy-prod.mjs');
    expect(src).not.toMatch(/npx supabase functions deploy --all/);
    expect(src).not.toContain('npx vercel');
    expect(src).not.toContain('reset_landing_visit_counters');
    expect(src).toContain('wqbefjzpgsezzwdrvvua');
    expect(src).toContain('get_site_content');
    expect(src).toContain('--use-api');
    expect(src).toContain('SUPABASE_ACCESS_TOKEN is missing');
    expect(pkg).toContain('deploy:admin-action:get-site-content');
  });
});
