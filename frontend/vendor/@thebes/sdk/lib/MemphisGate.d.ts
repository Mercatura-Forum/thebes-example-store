/**
 * MemphisGate — open-demo wrapper with Memphis passkey sign-in on demand.
 *
 * Anyone can roam the storefront without signing in; passkey sign-in is offered
 * in the header (SignOutChip) on demand. Reads and writes work for guests too,
 * since the on-chain caller is the boundary's persisted browser key either way.
 */
import { type ReactNode } from 'react';
import { type MemphisAuth } from './useMemphis.js';
/** The Memphis session (signed in or guest). Throws if used outside the gate. */
export declare function useAuth(): MemphisAuth;
export declare function MemphisGate({ children }: {
    appName?: string;
    tagline?: string;
    children: ReactNode;
}): import("react").JSX.Element;
/** Header auth control: guests get a "Sign in" affordance, signed-in shoppers
 *  see their name and a sign-out link. */
export declare function SignOutChip({ className }: {
    className?: string;
}): import("react").JSX.Element;
