/**
 * Owner Continue control flow.
 * Leave "Verifying…" the instant verify_owner_password returns.
 * Never await openAdminPanel — desk load must not keep the button stuck.
 */

import { setAdminSessionToken } from './admin-session';
import { verifyOwnerPassword, type OwnerVerifyResult } from './verify-owner-password';

export type OwnerGateContinueHooks = {
  password: string;
  restoreContinue: () => void;
  onSuccess: () => void;
  onDenied: () => void;
  openAdminPanel: () => void | Promise<void>;
};

export async function continueOwnerGate(hooks: OwnerGateContinueHooks): Promise<void> {
  let result: OwnerVerifyResult = { authorized: false, sessionToken: '' };
  try {
    result = await verifyOwnerPassword(hooks.password);
  } catch {
    result = { authorized: false, sessionToken: '' };
  }

  hooks.restoreContinue();

  if (result.authorized && result.sessionToken) {
    setAdminSessionToken(result.sessionToken);
    hooks.onSuccess();
    void Promise.resolve(hooks.openAdminPanel()).catch(() => {
      /* desk load must not reject Continue */
    });
    return;
  }

  hooks.onDenied();
}
