import assert from "node:assert/strict";
import { test } from "node:test";
import { createPiOmpThemeApp } from "../extension-src/omp-theme/app/index.js";
import { RenderScheduler } from "../extension-src/omp-theme/app/render-scheduler.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("runtime app updates reach the host renderer through the scheduler", async () => {
	let renders = 0;
	const app = createPiOmpThemeApp();
	app.sessionStart({ mode: "rpc", hasUI: false, requestRender: () => renders++ });
	app.update({}, "deferred");
	await wait(70);
	try {
		assert.equal(renders, 1);
	} finally {
		app.sessionShutdown();
	}
});

test("scheduler keeps one earliest pending paint across update classes", async () => {
	let renders = 0;
	const scheduler = new RenderScheduler({ requestRender: () => renders++ }, 1);
	scheduler.schedule("deferred");
	scheduler.schedule("delayed-retry");
	scheduler.schedule("coalesced");
	await wait(30);
	assert.equal(renders, 1);
	await wait(90);
	assert.equal(renders, 1);
});

test("immediate scheduler work supersedes a delayed paint", async () => {
	let renders = 0;
	const scheduler = new RenderScheduler({ requestRender: () => renders++ }, 1);
	scheduler.schedule("delayed-retry");
	scheduler.schedule("immediate");
	await Promise.resolve();
	assert.equal(renders, 1);
	await wait(120);
	assert.equal(renders, 1);
});

test("cancelled or stale scheduler work never requests a render", async () => {
	let renders = 0;
	const cancelled = new RenderScheduler({ requestRender: () => renders++ }, 1);
	cancelled.schedule("coalesced");
	cancelled.cancel();
	const stale = new RenderScheduler({ requestRender: () => renders++ }, 2, () => false);
	stale.schedule("coalesced");
	await wait(30);
	assert.equal(renders, 0);
});
