/**
 * Lifetime token of an object whose asynchronous work may resume after the
 * object was closed or replaced.
 *
 * A continuation captures a token before it awaits and calls
 * {@link assertCurrent} once it resumes, so work that outlived its owner stops
 * instead of registering, reviving or releasing anything for a successor.
 * {@link advance} hands ownership to a successor; {@link close} ends the epoch
 * and runs every cleanup registered with {@link onClose}, which is how pending
 * waiters settle and half-built resources are reclaimed.
 */
export declare class OwnerEpoch {
    private readonly ownerName;
    private generation;
    private ended;
    private readonly cleanups;
    /** @param ownerName Names the owner in the errors a stale token raises. */
    constructor(ownerName: string);
    /** True once {@link close} has run. */
    get closed(): boolean;
    /** Token of the current owner generation. */
    current(): number;
    /** Starts a new generation, so every earlier token becomes stale. */
    advance(): number;
    isCurrent(token: number): boolean;
    /** Throws `InvalidState` unless `token` still names the live owner. */
    assertCurrent(token: number): void;
    /**
     * Registers `cleanup` to run when the epoch closes; runs it at once when the
     * epoch is already closed. Returns a function that unregisters it.
     */
    onClose(cleanup: () => void): () => void;
    /** Ends the epoch and runs every registered cleanup once. Idempotent. */
    close(): void;
}
