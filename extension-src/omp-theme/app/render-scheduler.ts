export type UpdateClass = "immediate" | "coalesced" | "deferred" | "delayed-retry";
export interface SchedulerHost {
	requestRender(): void;
}

/**
 * Coalesce runtime updates onto the earliest pending paint. Pi already rate-limits
 * TUI paints, so one timer per urgency class can queue several paints for one
 * logical update. Immediate work keeps its microtask latency and supersedes a
 * delayed paint.
 */
export class RenderScheduler {
	private stopped = false;
	private immediateQueued = false;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private dueAt = 0;
	constructor(
		private readonly host: SchedulerHost,
		private readonly generation: number,
		private readonly isCurrent: (generation: number) => boolean = (current) => current === this.generation,
	) {}
	schedule(kind: UpdateClass): void {
		if (this.stopped || !this.isCurrent(this.generation)) return;
		if (kind === "immediate") {
			if (this.immediateQueued) return;
			if (this.timer !== undefined) {
				clearTimeout(this.timer);
				this.timer = undefined;
				this.dueAt = 0;
			}
			this.immediateQueued = true;
			queueMicrotask(() => {
				this.immediateQueued = false;
				this.render();
			});
			return;
		}
		// An immediate render is already queued for this turn. It supersedes every
		// timer and keeps the queue single-shot.
		if (this.immediateQueued) return;
		const delay = kind === "coalesced" ? 16 : kind === "deferred" ? 50 : 100;
		const dueAt = Date.now() + delay;
		if (this.timer !== undefined && this.dueAt <= dueAt) return;
		if (this.timer !== undefined) clearTimeout(this.timer);
		this.dueAt = dueAt;
		this.timer = setTimeout(() => {
			this.timer = undefined;
			this.dueAt = 0;
			this.render();
		}, delay);
	}
	private render(): void {
		if (!this.stopped && this.isCurrent(this.generation)) this.host.requestRender();
	}
	cancel(): void {
		this.stopped = true;
		if (this.timer !== undefined) clearTimeout(this.timer);
		this.timer = undefined;
		this.dueAt = 0;
	}
}
