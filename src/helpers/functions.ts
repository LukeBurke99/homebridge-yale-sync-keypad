import { PLATFORM_NAME, PLUGIN_NAME } from '../settings.js';
import { resolve as DnsResolve } from 'dns';

/**
 * An async wait function that will wait for the specified number of milliseconds
 */
export async function wait(ms: number) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

/**
 * Combine the plugin info with the MAC Address of the panel to provide a good seed for a UUID
 * @param id The MAC Address of the panel
 * @returns The name to use to generate a UUID
 */
export function panelUUID(id: string) : string {
	return `${PLUGIN_NAME}.${PLATFORM_NAME}.panel.${id}`;
}



export function checkNetwork() : Promise<boolean> {
	return new Promise((resolve) => {
		DnsResolve('https://mob.yalehomesystem.co.uk', (err) => {

			if (err && err.code === 'ENOTFOUND') {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
}
export function checkNetworkResponse(): Promise<NodeJS.ErrnoException | null> {
	return new Promise((resolve) => {
		DnsResolve('https://mob.yalehomesystem.co.uk', (err) => {
			resolve(err);
		});
	});
}