import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { AlarmSystemPlatformAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { YaleConfigHandler } from './helpers/platformConfig.js';
import { Yale } from 'yalesyncalarm';
import { Logger, LogLevel } from 'yalesyncalarm/dist/Logger.js';
import { checkNetwork, checkNetworkResponse, panelUUID, wait } from './helpers/functions.js';
import { LoggerContext, KeypadContext } from './helpers/contexts.js';


/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class YaleSyncKeypadPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;
	public readonly yaleSyncApi?: Yale;
    public lastApiCall: Date | null = null;
	private panelData = new LoggerContext(new Date(), '');

    // this is used to track restored cached accessories
    private panel: AlarmSystemPlatformAccessory | null = null;
    public readonly accessories: Map<string, PlatformAccessory> = new Map();
    public readonly discoveredCacheUUIDs: string[] = [];


    constructor(
		public readonly log: Logging,
		public readonly config: PlatformConfig,
		public readonly api: API,
    ) {
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;

        // Get the Yale Sync Config and check if it is valid
        const yaleConfig = YaleConfigHandler.decode(config);
        const yaleConfigErrors = YaleConfigHandler.validate(yaleConfig);
		if (yaleConfigErrors) {
			this.log.error('Error in config.json: ', yaleConfigErrors);
			return;
		}

		// Initialize the Yale Sync API
		this.yaleSyncApi = new Yale(yaleConfig.username!, yaleConfig.password!, new Logger(LogLevel.Info | LogLevel.Error, this.log));

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', async () => {
            log.debug('Executed didFinishLaunching callback');

            // run the method to discover / register your devices as accessories
            await this.discoverDevices();

			// Start the lifecycle
			this.log.info('Starting Yale Sync Keypad lifecycle. Fetching data every ', yaleConfig.refreshInterval!, ' seconds');
			this.lifecycle(yaleConfig.backgroundRefresh!, yaleConfig.refreshInterval!);
        });
    }


    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to set up event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache: ', accessory.displayName);

        // add the restored accessory to the accessories cache, so we can track if it has already been registered
        this.accessories.set(accessory.UUID, accessory);
    }


    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() : Promise<void> {
        if (!this.yaleSyncApi) {
            this.log.error('Yale Sync API not initialized. Exiting discoverDevices');
            return;
        }
        
        
        // Search for the panel from the user's Yale Sync account
        this.log.info('Fetching \'Yale Sync Alarm Panel\' from your account');

        // Check if homebridge is connected to the internet
        const err = await checkNetworkResponse();
        this.log.info('First Check: ', JSON.stringify(err));
        const connected = await checkNetwork();
        if (!connected) {
            this.log.error('Error: Unable to reach Yale servers.');
            return;
        }

        await this.yaleSyncApi.getPanelState(); // Call this first to initially set the yale.panel property
        const panel = await this.yaleSyncApi.panel();
        if (!panel) {
            this.log.error('No panel found in Yale Sync account. Exiting discoverDevices');
            return;
        }
        this.log.info('Panel found in Yale Sync account: ', panel.identifier);


        // genereate a unique id for the accessory based on the panel's identifier. This is usually the mac address
        const uuid = this.api.hap.uuid.generate(panelUUID(panel.identifier)); 


        // Check if the panel has already been registered
        const existingPanelAccessory = this.accessories.get(uuid);
        if (existingPanelAccessory) {
            this.log.info('Restoring existing panel accessory from cache:', existingPanelAccessory.displayName);
            this.panel = new AlarmSystemPlatformAccessory(this, existingPanelAccessory);
        } else {
            // Create the panel accessory and register it
            this.log.info('Adding new panel accessory:', panel.identifier);
            const panelAccessory = new this.api.platformAccessory(this.config.name!, uuid, this.api.hap.Categories.SECURITY_SYSTEM);
            panelAccessory.context = new KeypadContext(panel.identifier, 'panel', panel.state);
            this.panel = new AlarmSystemPlatformAccessory(this, panelAccessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [panelAccessory]);
            this.log.info('Panel accessory added to cache: ', panelAccessory.displayName);
            this.accessories.set(panelAccessory.UUID, panelAccessory);
        }
        this.discoveredCacheUUIDs.push(uuid);
        this.removeOldAccessories();
    }


    /**
     * Remove accessories which are no longer present in the discovered cache.
     * This will remove accessories which have been manually removed from the Yale Sync account
     */
    private removeOldAccessories() {
        // For each accessory in the cache, check if it is in the 'discovered cache'
        for (const [uuid, accessory] of this.accessories) {
            if (!this.discoveredCacheUUIDs.includes(uuid)) {
                this.log.info('Removing existing accessory from cache:', accessory.displayName);
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
        }
    }


    /**
     * The lifecycle method is used to fetch the panel state from the Yale Sync API at regular intervals and update the accessory state
     * @param refresh True if the user wants to refresh the panel state in the background
     * @param refreshInterval The number of seconds to wait before refreshing the panel state
     * @returns Promise<void>
     */
	async lifecycle(refresh: boolean, refreshInterval: number) : Promise<void> {
		if (!this.yaleSyncApi) {
			this.log.error('Yale Sync API not initialized. Exiting lifecycle');
			return;
		}

		// Try outside of the loop to stop making calls if there is an error
		try {
			while (true) {
                // Check if the panel accessory has been set and use that to fetch the panel state.
                // If it hasn't, skip this lifecycle
                if (this.panel) {
                    const d = new Date();

                    // work out whether we need to show the logs to the user by checking if it has been more than 10 minutes since the last log
                    // if that panel state as changed, the logs will automatically show
                    const currentPanelState: string = this.panel.accessory.context.state;
                    const showLogs = d.getTime() - this.panelData.lastUpdated.getTime() > (1000 * 60 * 10);
                    // this.log.info(`Time Now: ${d.getTime()} | Last Updated: ${this.panelData.lastUpdated.getTime()} | Difference: ${d.getTime() - this.panelData.lastUpdated.getTime()} | Show Logs: ${showLogs}`);
                    if (showLogs) {
                        this.log.debug('Lifecycle logs are enabled. Fetching panel state');
                    }
                    await this.panel.getTargetState(showLogs);
                    const stateHasChanged = currentPanelState !== this.panel.accessory.context.state;

                    // if we have just shown the logs or the state has changed, then update the panel data so that the next time this cycle runs
                    // it will not log until 10 minutes have passed OR the state changes again
                    if (showLogs || stateHasChanged) {
                        if (!showLogs && stateHasChanged) {
                            this.log.info('Panel state has changed: ', this.panel.accessory.context.state);
                        }
                        this.panelData = new LoggerContext(d, this.panel.accessory.context.state);
                    }
                } else {
                    this.log.warn('Panel accessory not set. Exiting lifecyle');
                    return;
                }

                // If the user does not want to refresh the panel state, then break out of the loop
                if (!refresh) {
                    this.log.warn('Background refresh is disabled. Exiting lifecycle');
                    return;
                }

                await wait(refreshInterval * 1000); // delay the cycle for the number of seconds provided in the config
			}
		} catch (error) {
			this.log.error('Error fetching Yale Sync Panel State');
			this.log.error('Error fetching Yale Sync Panel State');
			this.log.error('Error fetching Yale Sync Panel State: ', error);
		}
	}
}