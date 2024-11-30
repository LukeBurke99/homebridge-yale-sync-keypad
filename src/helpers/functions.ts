
/**
 * An async wait function that will wait for the specified number of milliseconds
 */
export async function wait(ms: number) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}
