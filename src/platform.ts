import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { AlarmSystemPlatformAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { YaleConfigHandler } from './helpers/platformConfig.js';
import { Yale } from 'yalesyncalarm';
import { Logger, LogLevel } from 'yalesyncalarm/dist/Logger.js';
import { panelUUID, wait } from './helpers/functions.js';
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
                // TODO: Rather than fetching the panel state here, just store the panel accessory and fetch the state in the accessory using the methods.
				const panelState = await this.yaleSyncApi.getPanelState();
                const panel = await this.yaleSyncApi.panel();
                if (!panel) {
                    this.log.error('Yale Sync Panel not found. Exiting lifecycle');
			        return;
                }

                // Get the accessory based on the panel identifier
                const uuid = this.api.hap.uuid.generate(panelUUID(panel.identifier));
                const accessory = this.accessories.get(uuid);
                if (!accessory) {
                    this.log.error('Accessory not found in cache. Exiting lifecycle');
                    return;
                }

                this.log.info('Updating accessory:', accessory.displayName, ' with context: ', JSON.stringify(accessory.context));

				const d = new Date();
                this.lastApiCall = new Date(d);

				// Check if the panel state has changed or it has been 10 minutes since the last log
				if (panelState.toString() !== this.panelData.lastValue || d.getTime() - this.panelData.lastUpdated.getTime() > (1000 * 60 * 10)) {
					this.log.info('Fetching Yale Sync Panel State: ', panelState);
					this.panelData = new LoggerContext(d, panelState.toString());
				}

                // If the user does not want to refresh the panel state, then break out of the loop
                if (!refresh) {
                    this.log.warn('Background refresh is disabled. Exiting lifecycle');
                    return;
                }
				
				await wait(refreshInterval * 1000);
			}
		} catch (error) {
			this.log.error('Error fetching Yale Sync Panel State');
			this.log.error('Error fetching Yale Sync Panel State');
			this.log.error('Error fetching Yale Sync Panel State');
			this.log.error('Error fetching Yale Sync Panel State');
			this.log.error('Error fetching Yale Sync Panel State: ', error);
		}
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
        this.log.info('Fetching Yale Sync Panel from your account');
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
            new AlarmSystemPlatformAccessory(this, existingPanelAccessory);
        } else {
            // Create the panel accessory and register it
            this.log.info('Adding new panel accessory:', panel.identifier);
            const panelAccessory = new this.api.platformAccessory(this.config.name!, uuid, this.api.hap.Categories.SECURITY_SYSTEM);
            panelAccessory.context = new KeypadContext(panel.identifier, 'panel', panel.state);
            new AlarmSystemPlatformAccessory(this, panelAccessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [panelAccessory]);
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
}



