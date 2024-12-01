import { PLATFORM_NAME, PLUGIN_NAME } from '../settings.js';

/**
 * An async wait function that will wait for the specified number of milliseconds
 */
export async function wait(ms: number) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}


export function panelUUID(id: string) : string {
	return `${PLUGIN_NAME}.${PLATFORM_NAME}.panel.${id}`;
}